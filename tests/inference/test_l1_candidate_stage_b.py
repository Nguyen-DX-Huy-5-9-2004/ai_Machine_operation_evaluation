from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pandas as pd

from inference.online.l1_candidate_c import validate_partitioned_candidate_package
from inference.online.l1_candidate_source_snapshot import FACT_COLUMNS, logical_hash, parquet_backend, write_json, write_parquet_atomic


def _package(tmp_path: Path, success: bool = True) -> Path:
    root = tmp_path / "l1_candidate_c_fixture"; manifests = root / "manifests"; manifests.mkdir(parents=True)
    for name in ["source_snapshot_reference.json", "future_label_coverage.json", "candidate_configs_manifest.json", "summary.json", "split_event_manifest.parquet", "split_window_manifest.parquet"]:
        (manifests / name).write_text("{}")
    (manifests / "canonical_manifest.json").write_text(json.dumps({"machine_count": 2}))
    (manifests / "split_leakage_report.json").write_text(json.dumps({"result": "PASS"}))
    for machine in [1, 2]:
        folder = root / "canonical" / f"machine_id={machine}"; folder.mkdir(parents=True)
        (folder / "events.parquet").write_bytes(b"fixture")
        if success: (folder / "_SUCCESS").write_text("")
    for profile in ["lenient", "strict"]:
        for split in ["train", "calibration", "valid", "test"]:
            folder = root / profile / split / "machine_id=1"; folder.mkdir(parents=True); (folder / "events.parquet").write_bytes(b"fixture")
    return root


def test_partitioned_validator_does_not_require_monolithic_files(tmp_path: Path):
    assert validate_partitioned_candidate_package(_package(tmp_path))["result"] == "L1_CANDIDATE_C_PACKAGE_READY_FOR_COLAB_TRAINING"


def test_partitioned_validator_detects_missing_success(tmp_path: Path):
    report = validate_partitioned_candidate_package(_package(tmp_path, success=False))
    assert report["result"] == "L1_CANDIDATE_C_PACKAGE_NOT_READY"
    assert "missing_canonical_success" in report["errors"]


def test_notebook_is_fail_fast_and_has_no_shell_python():
    notebook = Path("modeling/l1_tcn/notebooks/OBAD_L1_Candidate_C_Colab.ipynb").read_text(encoding="utf-8")
    assert "subprocess.run" in notebook and "check=True" in notebook
    assert "!python" not in notebook


def _two_machine_snapshot(tmp_path: Path) -> Path:
    backend, _ = parquet_backend()
    snapshot = tmp_path / "fixture_snapshot"
    dims = snapshot / "dimensions"
    machine_ids = [1, 2]
    total_rows = 0
    for machine_id in machine_ids:
        start = pd.Timestamp("2026-01-01 00:00:00")
        rows = []
        for offset in range(100):
            event_time = start + pd.Timedelta(minutes=offset)
            raw_end = event_time + pd.Timedelta(seconds=30) if offset < 99 else pd.NaT
            rows.append([
                machine_id * 1000 + offset,
                machine_id,
                2,
                event_time,
                raw_end,
                float(offset),
                float(offset) + 0.5,
                None,
            ])
        frame = pd.DataFrame(rows, columns=FACT_COLUMNS)
        partition = snapshot / "fact" / f"machine_id={machine_id}"
        payload = write_parquet_atomic(frame, partition / "events.parquet", backend)
        payload.update({"machine_id": machine_id, "source_max_event_id": 2099, "result": "PASS"})
        write_json(partition / "partition_manifest.json", payload)
        (partition / "_SUCCESS").write_text("", encoding="utf-8")
        total_rows += len(frame)

    write_parquet_atomic(pd.DataFrame({"id": machine_ids, "machine_group_id": [1, 1]}), dims / "data_machine.parquet", backend)
    write_parquet_atomic(pd.DataFrame({"id": [2], "status_name": ["RunPdNoLoad"]}), dims / "data_machine_status.parquet", backend)
    write_parquet_atomic(pd.DataFrame({"id": [3], "location_name": ["Fixture"]}), dims / "data_location.parquet", backend)
    write_parquet_atomic(pd.DataFrame({"machine_id": machine_ids, "location_id": [3, 3], "start_time": [pd.Timestamp("2025-01-01")] * 2, "end_time": [pd.NaT] * 2}), dims / "machine_location_his.parquet", backend)
    write_json(snapshot / "source_watermark.json", {"source_max_event_id": 2099, "source_row_count": total_rows, "source_machine_ids": machine_ids})
    write_json(snapshot / "snapshot_manifest.json", {"backend": backend})
    return snapshot


def test_colab_runner_prepare_resume_subprocess(tmp_path: Path):
    snapshot = _two_machine_snapshot(tmp_path)
    adaptation = tmp_path / "adaptation"
    adaptation.mkdir()
    package = tmp_path / "l1_candidate_c_fixture"
    command = [
        sys.executable,
        "modeling/l1_tcn/scripts/run_candidate_c_colab.py",
        "prepare",
        "--source-mode", "snapshot",
        "--source-snapshot-dir", str(snapshot),
        "--adaptation-audit-dir", str(adaptation),
        "--candidate-run-id", "l1_candidate_c_fixture",
        "--candidate-package-dir", str(package),
        "--resume",
    ]
    first = subprocess.run(command, text=True, capture_output=True, check=False)
    assert first.returncode == 0, first.stdout + "\n" + first.stderr
    assert '"resume": true' in first.stdout
    assert "--resume" in first.stdout
    assert (package / "run_state.json").exists()
    assert (package / "canonical" / "machine_id=1" / "events.parquet").exists()
    assert (package / "canonical" / "machine_id=1" / "_SUCCESS").exists()

    # Simulate an interrupted run with stale global manifests. Machine 1 is
    # complete; machine 2 must be rebuilt while finalization counts both.
    (package / "manifests" / "summary.json").write_text(json.dumps({"canonical_rows": 1, "closed_rows": 1}), encoding="utf-8")
    (package / "manifests" / "package_validation.json").write_text(json.dumps({"canonical_rows": 1, "closed_rows": 1}), encoding="utf-8")
    (package / "canonical" / "machine_id=2" / "_SUCCESS").unlink()
    (package / "run_state.json").write_text(json.dumps({"run_id": "l1_candidate_c_fixture", "machines": {"1": "COMPLETE", "2": "FAILED"}}), encoding="utf-8")

    second = subprocess.run(command, text=True, capture_output=True, check=False)
    assert second.returncode == 0, second.stdout + "\n" + second.stderr
    assert "status=SKIPPED_COMPLETE" in second.stdout
    state = json.loads((package / "run_state.json").read_text(encoding="utf-8"))
    assert state["machines"] == {"1": "COMPLETE", "2": "COMPLETE"}
    summary = json.loads((package / "manifests" / "summary.json").read_text(encoding="utf-8"))
    assert summary["raw_rows"] == 200
    assert summary["canonical_rows"] == 198
    assert summary["closed_rows"] == 198
    assert summary["dropped_rows"] == 2
    attrition = json.loads((package / "manifests" / "attrition_report.json").read_text(encoding="utf-8"))
    assert attrition["reason_counts"] == {"OPEN_EVENT": 2}

    validate = subprocess.run(
        [
            sys.executable,
            "modeling/l1_tcn/scripts/run_candidate_c_colab.py",
            "validate-package",
            "--candidate-package-dir", str(package),
        ],
        text=True,
        capture_output=True,
        check=False,
    )
    assert validate.returncode == 0, validate.stdout + "\n" + validate.stderr
    assert "L1_CANDIDATE_C_PACKAGE_READY_FOR_COLAB_TRAINING" in validate.stdout


def test_colab_runner_help_lists_resume():
    result = subprocess.run(
        [sys.executable, "modeling/l1_tcn/scripts/run_candidate_c_colab.py", "--help"],
        text=True,
        capture_output=True,
        check=True,
    )
    assert "--resume" in result.stdout
