from __future__ import annotations

import json

from backend.app.services.api_service import runtime_static_status


def test_runtime_static_gate_accepts_verified_detailed_pass_status(tmp_path, monkeypatch) -> None:
    runtime_dir = tmp_path / "runtime"
    runtime_dir.mkdir()
    (runtime_dir / "ai_production_lineage_manifest.json").write_text(json.dumps({"artifact_contract_result": "PASS"}), encoding="utf-8")
    (runtime_dir / "ai_runtime_environment.json").write_text(json.dumps({"artifact_serialization_warning_status": "PASS_RUNTIME_SKLEARN_VERSION_MATCHES_TRAINING"}), encoding="utf-8")
    audit_dir = tmp_path / "audit" / "runtime_relocation_check_1"
    audit_dir.mkdir(parents=True)
    (audit_dir / "00_summary.json").write_text(json.dumps({"result": "PASS"}), encoding="utf-8")

    class Settings:
        runtime_manifest_dir = runtime_dir
        realtime_audit_root = tmp_path / "audit"

    status = runtime_static_status(Settings())
    assert status["runtimeEnvironmentStatus"] == "PASS"
    assert status["staticGatePass"] is True


def test_runtime_static_gate_keeps_non_pass_environment_explained(tmp_path) -> None:
    runtime_dir = tmp_path / "runtime"
    runtime_dir.mkdir()
    (runtime_dir / "ai_production_lineage_manifest.json").write_text(json.dumps({"artifact_contract_result": "PASS"}), encoding="utf-8")
    (runtime_dir / "ai_runtime_environment.json").write_text(json.dumps({"artifact_serialization_warning_status": "WARNING_RUNTIME_SKLEARN_VERSION_MISMATCH"}), encoding="utf-8")

    class Settings:
        runtime_manifest_dir = runtime_dir
        realtime_audit_root = tmp_path / "audit"

    status = runtime_static_status(Settings())
    assert status["runtimeEnvironmentStatus"] == "WARNING"
    assert status["staticGatePass"] is False
