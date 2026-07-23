from __future__ import annotations

import json
import os
import uuid
import ctypes
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable, Mapping

import pandas as pd

from .types import ProcessedReplayBatch, ReplayConfig, ReplayWatermark


STORE_SCHEMA_VERSION = "1.0.0"


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime, pd.Timestamp)):
        return value.isoformat()
    if hasattr(value, "item"):
        return value.item()
    raise TypeError(f"Cannot serialize {type(value)!r}")


def atomic_json(path: Path, value: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + f".{uuid.uuid4().hex}.tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, default=_json_default)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def atomic_parquet(path: Path, frame: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + f".{uuid.uuid4().hex}.tmp")
    frame.to_parquet(temporary, index=False)
    descriptor = os.open(str(temporary), os.O_RDWR)
    try:
        _flush_file_descriptor(descriptor)
    finally:
        os.close(descriptor)
    os.replace(temporary, path)


class ReplayEventStore:
    """Append-only local event store; SQL is intentionally absent from this class."""

    BATCH_KINDS = ("raw_batches", "canonical_batches", "l1_batches", "l2_policy_batches", "frontend_batches")

    def __init__(self, root: str | Path, replay_run_id: str) -> None:
        self.root = Path(root) / replay_run_id
        self.replay_run_id = replay_run_id
        self.manifest_path = self.root / "manifest.json"
        self.checkpoint_path = self.root / "checkpoint.json"
        self._manifest: dict[str, Any] | None = None

    def create_or_open(self, config: ReplayConfig, *, artifact_fingerprint: str = "unknown") -> dict[str, Any]:
        self.root.mkdir(parents=True, exist_ok=True)
        for kind in self.BATCH_KINDS:
            (self.root / kind).mkdir(exist_ok=True)
        if self.manifest_path.exists():
            self._manifest = self._read_json(self.manifest_path)
            self._recover_uncheckpointed_batches()
            return self._manifest
        self._manifest = {
            "schema_version": STORE_SCHEMA_VERSION,
            "replay_run_id": self.replay_run_id,
            "pipeline_name": config.pipeline_name,
            "replay_mode": config.replay_mode,
            "created_time": utc_now(),
            "artifact_fingerprint": artifact_fingerprint,
            "batches": [],
        }
        atomic_json(self.manifest_path, self._manifest)
        atomic_json(self.root / "replay_config_snapshot.redacted.json", _redact_config(config.as_dict()))
        return self._manifest

    def checkpoint(self) -> dict[str, Any]:
        return self._read_json(self.checkpoint_path) if self.checkpoint_path.exists() else {}

    def commit_batch(
        self,
        *,
        batch_sequence: int,
        virtual_time: datetime,
        watermark: ReplayWatermark | None,
        processed: ProcessedReplayBatch,
        source_watermark: ReplayWatermark | None,
    ) -> dict[str, Any]:
        if self._manifest is None:
            raise RuntimeError("ReplayEventStore.create_or_open must be called before commit_batch")
        batch_id = f"batch_{batch_sequence:06d}"
        persist_started = time.perf_counter()
        previous_checkpoint = self.checkpoint()
        filenames = {
            "raw_batches": processed.raw if processed.raw is not None else processed.canonical,
            "canonical_batches": processed.canonical,
            "l1_batches": processed.l1,
            "l2_policy_batches": processed.output,
            "frontend_batches": processed.output,
        }
        for kind, frame in filenames.items():
            atomic_parquet(self.root / kind / f"{batch_id}.parquet", frame)

        output = processed.output
        entry = {
            "batch_id": batch_id,
            "batch_sequence": batch_sequence,
            "row_count": int(len(output)),
            "event_uid_count": int(output.get("event_uid", pd.Series(dtype="object")).nunique()),
            "event_start_min": _time_string(output.get("source_event_start_time")),
            "event_start_max": _time_string(output.get("source_event_start_time"), maximum=True),
            "virtual_time": virtual_time.isoformat(),
            "watermark": watermark.as_dict() if watermark else None,
            "committed_time": utc_now(),
        }
        self._manifest["batches"].append(entry)
        self._manifest["updated_time"] = utc_now()
        atomic_json(self.manifest_path, self._manifest)
        persist_latency_ms = round((time.perf_counter() - persist_started) * 1000, 2)
        self._append_jsonl("metrics.jsonl", {"batch_sequence": batch_sequence, "virtual_time": virtual_time, **processed.metrics, "persist_file_latency_ms": persist_latency_ms})
        self._append_jsonl("state_changes.jsonl", {"kind": "BATCH_COMMITTED", **entry})
        checkpoint = {
            "schema_version": STORE_SCHEMA_VERSION,
            "replay_run_id": self.replay_run_id,
            "pipeline_name": self._manifest["pipeline_name"],
            "source_watermark": source_watermark.as_dict() if source_watermark else None,
            **(watermark.as_dict() if watermark else {"last_event_start_time": None, "last_event_id": None}),
            "virtual_time": virtual_time.isoformat(),
            "batch_sequence": batch_sequence,
            "processed_count": sum(int(item["row_count"]) for item in self._manifest["batches"]),
            "l1_ready_count": int(previous_checkpoint.get("l1_ready_count", 0)) + _flag_sum(output, "l1_score_available_flag"),
            "l1_unready_count": int(previous_checkpoint.get("l1_unready_count", 0)) + int(len(output) - _flag_sum(output, "l1_score_available_flag")),
            "l2_ready_count": int(previous_checkpoint.get("l2_ready_count", 0)) + _flag_sum(output, "l2_ready_flag"),
            "l2_unready_count": int(previous_checkpoint.get("l2_unready_count", 0)) + int(len(output) - _flag_sum(output, "l2_ready_flag")),
            "policy_ready_count": int(previous_checkpoint.get("policy_ready_count", 0)) + _flag_sum(output, "policy_ready_flag"),
            "last_successful_batch": batch_id,
            "artifact_fingerprint": self._manifest["artifact_fingerprint"],
            "updated_time": utc_now(),
        }
        # Checkpoint is the commit marker and is written only after all batch files rename.
        atomic_json(self.checkpoint_path, checkpoint)
        return checkpoint

    def append_error(self, error: Mapping[str, Any]) -> None:
        self._append_jsonl("errors.jsonl", {"time": utc_now(), **error})

    def append_activity(self, activity: Mapping[str, Any]) -> None:
        """Append operator-facing replay progress without involving SQL."""
        self._append_jsonl("activity.jsonl", {"time": utc_now(), **activity})

    def events(
        self,
        *,
        after_sequence: int = 0,
        machine_id: int | None = None,
        limit: int = 200,
    ) -> pd.DataFrame:
        manifest = self._manifest or self._read_json(self.manifest_path)
        batches = [item for item in manifest.get("batches", []) if int(item["batch_sequence"]) > after_sequence]
        frames: list[pd.DataFrame] = []
        for item in batches:
            path = self.root / "frontend_batches" / f"{item['batch_id']}.parquet"
            if not path.exists():
                continue
            frame = pd.read_parquet(path)
            if machine_id is not None and "machine_id" in frame:
                frame = frame[pd.to_numeric(frame["machine_id"], errors="coerce").eq(machine_id)]
            if not frame.empty:
                frame["replay_sequence"] = int(item["batch_sequence"])
                frames.append(frame)
            if sum(len(frame) for frame in frames) >= limit:
                break
        if not frames:
            return pd.DataFrame()
        return pd.concat(frames, ignore_index=True).head(limit)

    def _recover_uncheckpointed_batches(self) -> None:
        assert self._manifest is not None
        checkpoint_sequence = int(self.checkpoint().get("batch_sequence", 0))
        known = {int(item["batch_sequence"]) for item in self._manifest.get("batches", [])}
        recovered = False
        for path in sorted((self.root / "frontend_batches").glob("batch_*.parquet")):
            sequence = int(path.stem.split("_")[-1])
            if sequence in known or sequence <= checkpoint_sequence:
                continue
            frame = pd.read_parquet(path)
            if frame.empty or "event_uid" not in frame or frame["event_uid"].duplicated().any():
                continue
            self._manifest["batches"].append({
                "batch_id": path.stem,
                "batch_sequence": sequence,
                "row_count": int(len(frame)),
                "event_uid_count": int(frame["event_uid"].nunique()),
                "event_start_min": _time_string(frame.get("source_event_start_time")),
                "event_start_max": _time_string(frame.get("source_event_start_time"), maximum=True),
                "virtual_time": None,
                "watermark": None,
                "committed_time": utc_now(),
                "recovered": True,
            })
            recovered = True
        latest_manifest_sequence = max((int(item["batch_sequence"]) for item in self._manifest.get("batches", [])), default=0)
        needs_checkpoint_rebuild = latest_manifest_sequence > checkpoint_sequence
        if recovered:
            self._manifest["batches"].sort(key=lambda item: int(item["batch_sequence"]))
            self._manifest["updated_time"] = utc_now()
            atomic_json(self.manifest_path, self._manifest)
        if recovered or needs_checkpoint_rebuild:
            # A process may fail after immutable batch files are renamed but before the
            # checkpoint commit marker is written. Rebuild it from the final durable
            # frontend batch so a resumed reader cannot rescan those events.
            latest = self._manifest["batches"][-1]
            latest_path = self.root / "frontend_batches" / f"{latest['batch_id']}.parquet"
            if not latest_path.exists():
                raise RuntimeError(f"Cannot recover replay checkpoint: committed manifest batch is missing {latest_path}")
            latest_frame = pd.read_parquet(latest_path)
            ordered = latest_frame.sort_values(["source_event_start_time", "event_id"])
            last = ordered.iloc[-1]
            last_time = pd.Timestamp(last["source_event_start_time"]).isoformat()
            atomic_json(
                self.checkpoint_path,
                {
                    "schema_version": STORE_SCHEMA_VERSION,
                    "replay_run_id": self.replay_run_id,
                    "pipeline_name": self._manifest["pipeline_name"],
                    "source_watermark": {"last_event_start_time": last_time, "last_event_id": int(last["event_id"])},
                    "last_event_start_time": last_time,
                    "last_event_id": int(last["event_id"]),
                    "virtual_time": latest.get("virtual_time") or last_time,
                    "batch_sequence": int(latest["batch_sequence"]),
                    "processed_count": sum(int(item["row_count"]) for item in self._manifest["batches"]),
                    "l1_ready_count": _flag_sum(latest_frame, "l1_score_available_flag"),
                    "l1_unready_count": int(len(latest_frame) - _flag_sum(latest_frame, "l1_score_available_flag")),
                    "l2_ready_count": _flag_sum(latest_frame, "l2_ready_flag"),
                    "l2_unready_count": int(len(latest_frame) - _flag_sum(latest_frame, "l2_ready_flag")),
                    "policy_ready_count": _flag_sum(latest_frame, "policy_ready_flag"),
                    "last_successful_batch": latest["batch_id"],
                    "artifact_fingerprint": self._manifest["artifact_fingerprint"],
                    "recovered": True,
                    "updated_time": utc_now(),
                },
            )

    def _append_jsonl(self, name: str, value: Mapping[str, Any]) -> None:
        path = self.root / name
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(value, ensure_ascii=False, default=_json_default) + "\n")
            handle.flush()
            os.fsync(handle.fileno())

    @staticmethod
    def _read_json(path: Path) -> dict[str, Any]:
        return json.loads(path.read_text(encoding="utf-8"))


def _redact_config(value: Mapping[str, Any]) -> dict[str, Any]:
    return {key: "***" if key.lower() in {"password", "username"} else item for key, item in value.items()}


def _time_string(series: pd.Series | None, *, maximum: bool = False) -> str | None:
    if series is None or series.empty:
        return None
    parsed = pd.to_datetime(series, errors="coerce").dropna()
    if parsed.empty:
        return None
    return (parsed.max() if maximum else parsed.min()).isoformat()


def _flag_sum(frame: pd.DataFrame, column: str) -> int:
    if column not in frame:
        return 0
    return int(pd.to_numeric(frame[column], errors="coerce").fillna(0).sum())


def _flush_file_descriptor(descriptor: int) -> None:
    """Use the native flush primitive where Windows does not support os.fsync."""
    if os.name != "nt":
        os.fsync(descriptor)
        return
    import msvcrt

    handle = msvcrt.get_osfhandle(descriptor)
    if not ctypes.windll.kernel32.FlushFileBuffers(handle):  # type: ignore[attr-defined]
        raise OSError(ctypes.get_last_error(), "FlushFileBuffers failed")
