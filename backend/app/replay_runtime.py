from __future__ import annotations

import json
import math
import threading
from collections import OrderedDict, defaultdict, deque
from pathlib import Path
from typing import Any

import pandas as pd


class ReplayRuntimeIndex:
    """Bounded file-first cache for replay API reads; it never accesses SQL."""

    def __init__(self, root: Path, *, max_batches: int = 32, per_machine_limit: int = 500) -> None:
        self.root = root
        self.max_batches = max_batches
        self.per_machine_limit = per_machine_limit
        self._manifests: dict[str, tuple[float, dict[str, Any]]] = {}
        self._batches: OrderedDict[tuple[str, int], pd.DataFrame] = OrderedDict()
        self._machine_rings: dict[tuple[str, int], deque[dict[str, Any]]] = defaultdict(lambda: deque(maxlen=self.per_machine_limit))
        self._lock = threading.Lock()
        self.hits = 0; self.misses = 0

    def runs(self) -> list[dict[str, Any]]:
        if not self.root.exists():
            return []
        run_paths = [path for path in self.root.iterdir() if (path / "manifest.json").exists()]
        run_paths.sort(key=lambda path: (path / "checkpoint.json").stat().st_mtime if (path / "checkpoint.json").exists() else path.stat().st_mtime, reverse=True)
        return [self.status(path.name) for path in run_paths]

    def status(self, run_id: str) -> dict[str, Any]:
        manifest = self._manifest(run_id)
        checkpoint_path = self.root / run_id / "checkpoint.json"
        checkpoint = json.loads(checkpoint_path.read_text(encoding="utf-8")) if checkpoint_path.exists() else {}
        return {
            "replayRunId": run_id,
            "mode": manifest.get("replay_mode", "file_only"),
            "pipelineName": manifest.get("pipeline_name"),
            "batchSequence": checkpoint.get("batch_sequence", 0),
            "processedCount": checkpoint.get("processed_count", 0),
            "policyReadyCount": checkpoint.get("policy_ready_count", 0),
            "l1ReadyCount": checkpoint.get("l1_ready_count", 0),
            "l1UnreadyCount": checkpoint.get("l1_unready_count", 0),
            "l2ReadyCount": checkpoint.get("l2_ready_count", 0),
            "l2UnreadyCount": checkpoint.get("l2_unready_count", 0),
            "replayState": "PAUSED" if checkpoint.get("paused") else "LIVE",
            "latestSequence": checkpoint.get("batch_sequence", 0),
            "sourceWatermark": checkpoint.get("source_watermark"),
            "lastError": None,
            "virtualTime": checkpoint.get("virtual_time"),
            "sqlWrites": 0,
            "cache": {"batchEntries": len(self._batches), "hits": self.hits, "misses": self.misses},
        }

    def events(
        self,
        run_id: str,
        *,
        after_sequence: int = 0,
        machine_id: int | None = None,
        limit: int = 200,
        initial_snapshot: bool = False,
    ) -> tuple[list[dict[str, Any]], int]:
        manifest = self._manifest(run_id)
        batches = [item for item in manifest.get("batches", []) if int(item["batch_sequence"]) > after_sequence]
        records: list[dict[str, Any]] = []
        latest = after_sequence
        # A browser needs a useful current picture immediately.  Read a bounded
        # tail of committed batches and move the cursor to the current batch so
        # SSE only appends future deltas rather than replaying the whole run.
        entries = list(reversed(batches)) if initial_snapshot else batches
        for entry in entries:
            sequence = int(entry["batch_sequence"])
            frame = self._batch(run_id, sequence, entry["batch_id"])
            if machine_id is not None and "machine_id" in frame:
                frame = frame[pd.to_numeric(frame["machine_id"], errors="coerce").eq(machine_id)]
            remaining = max(0, limit - len(records))
            window = frame.tail(remaining) if initial_snapshot else frame.head(remaining)
            for item in window.to_dict(orient="records"):
                item["replay_sequence"] = sequence
                records.append(_json_safe(item))
                if machine_id is not None:
                    self._machine_rings[(run_id, machine_id)].append(item)
            latest = max(latest, sequence)
            if len(records) >= limit:
                break
        if initial_snapshot:
            records.sort(key=lambda item: (str(item.get("source_event_start_time") or ""), int(item.get("event_id") or 0)))
            latest = max((int(item["batch_sequence"]) for item in manifest.get("batches", [])), default=after_sequence)
        return records, latest

    def _manifest(self, run_id: str) -> dict[str, Any]:
        path = self.root / run_id / "manifest.json"
        if not path.exists():
            raise FileNotFoundError(run_id)
        mtime = path.stat().st_mtime
        cached = self._manifests.get(run_id)
        if cached and cached[0] == mtime:
            return cached[1]
        value = json.loads(path.read_text(encoding="utf-8"))
        self._manifests[run_id] = (mtime, value)
        return value

    def _batch(self, run_id: str, sequence: int, batch_id: str) -> pd.DataFrame:
        key = (run_id, sequence)
        with self._lock:
            cached = self._batches.get(key)
            if cached is not None:
                self._batches.move_to_end(key); self.hits += 1
                return cached
        frame = pd.read_parquet(self.root / run_id / "frontend_batches" / f"{batch_id}.parquet")
        with self._lock:
            self.misses += 1
            self._batches[key] = frame
            while len(self._batches) > self.max_batches:
                self._batches.popitem(last=False)
        return frame


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if value is pd.NA:
        return None
    try:
        if bool(pd.isna(value)):
            return None
    except (TypeError, ValueError):
        pass
    if hasattr(value, "item"):
        return _json_safe(value.item())
    return value
