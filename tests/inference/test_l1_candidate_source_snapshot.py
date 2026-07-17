from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from inference.online.l1_candidate_source_snapshot import FACT_COLUMNS, logical_hash, parquet_backend, validate_source_snapshot, write_json, write_parquet_atomic


def _snapshot(tmp_path: Path, complete: bool = True) -> Path:
    backend, _ = parquet_backend()
    root = tmp_path / "snapshot"; part = root / "fact" / "machine_id=1"; dims = root / "dimensions"
    frame = pd.DataFrame([[1, 1, 1, pd.Timestamp("2026-01-01"), pd.NaT, 1.0, 2.0, None]], columns=FACT_COLUMNS)
    payload = write_parquet_atomic(frame, part / "events.parquet", backend)
    payload.update({"machine_id": 1, "source_max_event_id": 1, "result": "PASS"})
    write_json(part / "partition_manifest.json", payload)
    if complete: (part / "_SUCCESS").write_text("")
    for name in ["data_machine", "data_machine_status", "data_location", "machine_location_his"]:
        write_parquet_atomic(pd.DataFrame({"id": [1]}), dims / f"{name}.parquet", backend)
    write_json(root / "source_watermark.json", {"source_max_event_id": 1, "source_row_count": 1, "source_machine_ids": [1]})
    write_json(root / "snapshot_manifest.json", {"backend": backend})
    return root


def test_logical_hash_is_reproducible():
    frame = pd.DataFrame({"event_id": [1, 2], "machine_id": [1, 1]})
    assert logical_hash(frame) == logical_hash(frame.copy())


def test_parquet_atomic_roundtrip_and_snapshot_validator(tmp_path: Path):
    root = _snapshot(tmp_path)
    assert validate_source_snapshot(root)["result"] == "L1_CANDIDATE_SOURCE_SNAPSHOT_READY"


def test_snapshot_validator_rejects_incomplete_partition(tmp_path: Path):
    root = _snapshot(tmp_path, complete=False)
    report = validate_source_snapshot(root)
    assert report["result"] == "L1_CANDIDATE_SOURCE_SNAPSHOT_NOT_READY"
    assert any("incomplete_machine" in item for item in report["errors"])
