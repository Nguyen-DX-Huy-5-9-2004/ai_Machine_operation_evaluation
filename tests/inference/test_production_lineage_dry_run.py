from __future__ import annotations

import inspect
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

import inference.online.production_lineage_dry_run as runtime
from inference.online.l2_scorer import TARGET_SHORT
from inference.online.l2_scorer import L2Scorer
from inference.online.l1_shadow import L1_MODEL_FEATURES
from inference.online.policy_engine import apply_policy_v2


ROOT = Path(__file__).resolve().parents[2]


def _policy_frame() -> pd.DataFrame:
    row = {
        "is_sensitive_warning": 1,
        "is_behavior_anomaly": 0,
        "known_fault_status": 0,
        "known_repair_status": 0,
        "known_maintenance_status": 0,
        "off_with_fault_status": 0,
    }
    row.update({f"risk_{short}": 0.0 for short in TARGET_SHORT.values()})
    return pd.DataFrame([row])


def test_candidate_a_paths_are_locked_and_candidate_c_is_rejected():
    expected = ROOT / "modeling/l1_tcn/artifacts/lenient"
    assert runtime.assert_candidate_a_artifact_dir(ROOT, expected, "lenient") == expected.resolve()
    with pytest.raises(ValueError, match="candidate artifacts are forbidden"):
        runtime.assert_candidate_a_artifact_dir(ROOT, ROOT / "modeling/l1_tcn/artifacts_candidates/example/lenient", "lenient")


def test_production_selection_contains_exactly_six_l2_targets():
    _, _, selected = runtime._selected_l2(ROOT)
    assert set(selected) == set(TARGET_SHORT)
    assert len(selected) == 6
    assert all(item["model_path"].name == "model.joblib" for item in selected.values())


def test_l2_scorer_loads_all_six_locked_selected_models():
    scorer = L2Scorer({
        "obad_root": str(ROOT),
        "l2_artifact_dir": "modeling/l2_fault_classifier/artifacts/l2_multilabel_20260711_043347",
        "l2_production_selection": "data/dataModel/l2/model_report/l2_multilabel_20260711_043347/production_profile_selection.json",
        "l2_feature_policy": "data/dataModel/l2/prepared_report/l2_feature_policy.json",
    })
    assert set(scorer.models) == set(TARGET_SHORT)


def test_production_artifact_hashes_are_unchanged_by_lineage_validation():
    artifact = ROOT / "modeling/l1_tcn/artifacts/lenient/model_best.pt"
    before = runtime._sha256(artifact)
    report = runtime.production_artifact_contract(ROOT)
    after = runtime._sha256(artifact)
    assert report["result"] == "PASS"
    assert before == after


def test_l2_feature_order_and_non_finite_values_fail(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    metadata_path = tmp_path / "metadata.json"
    metadata_path.write_text('{"features": ["a", "b"], "categorical_features": []}', encoding="utf-8")
    selection = {"targets": [{"target": "future_fault_within_10_events", "selected_profile": "safe"}]}
    policy = {"feature_profiles": {"safe": ["a", "b"]}}
    selected = {"future_fault_within_10_events": {"profile": "safe", "metadata_path": metadata_path, "model_path": tmp_path / "model.joblib", "selection": selection["targets"][0]}}
    monkeypatch.setattr(runtime, "_selected_l2", lambda root: (selection, policy, selected))
    good = runtime.validate_selected_l2_feature_contract(pd.DataFrame({"a": [1.0], "b": [2.0]}), tmp_path)
    assert good["result"] == "PASS"
    wrong_order = {"feature_profiles": {"safe": ["b", "a"]}}
    monkeypatch.setattr(runtime, "_selected_l2", lambda root: (selection, wrong_order, selected))
    assert runtime.validate_selected_l2_feature_contract(pd.DataFrame({"a": [1.0], "b": [2.0]}), tmp_path)["result"] == "FAIL"
    monkeypatch.setattr(runtime, "_selected_l2", lambda root: (selection, policy, selected))
    assert runtime.validate_selected_l2_feature_contract(pd.DataFrame({"a": [np.inf], "b": [2.0]}), tmp_path)["result"] == "FAIL"


def test_policy_has_no_monitor_and_strict_only_does_not_uplift_action():
    thresholds = {target: 1.0 for target in TARGET_SHORT}
    report = runtime._policy_contract(apply_policy_v2(_policy_frame(), thresholds), thresholds)
    assert report["result"] == "PASS"
    assert report["no_monitor_assertion"] is True
    assert report["strict_only_count"] == 1
    assert report["strict_only_action_uplift_count"] == 0


def test_runtime_module_has_no_sql_writer_or_training_execution_path():
    source = inspect.getsource(runtime)
    assert "pyodbc" not in source
    assert "bulk_insert_dataframe" not in source
    assert "train.py" not in source
    assert "connect(" not in source


def test_sha256_is_deterministic(tmp_path: Path):
    path = tmp_path / "manifest_input.txt"
    path.write_text("immutable", encoding="utf-8")
    assert runtime._sha256(path) == runtime._sha256(path)
    assert runtime.manifest_content_sha256({"generated_at": "first", "files": ["a"]}) == runtime.manifest_content_sha256({"generated_at": "second", "files": ["a"]})


def _readiness_fixture() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    ready_ids = list(range(1, 10))
    scored = pd.DataFrame({
        "event_id": [*ready_ids, 10],
        "window_ready_flag": [1] * 9 + [0],
        "not_scored_reason": ["READY"] * 9 + ["INSUFFICIENT_HISTORY_IN_SEGMENT"],
        "score_lenient": [0.1] * 9 + [np.nan],
        "score_strict": [0.2] * 9 + [np.nan],
        "score_lenient_normalized": [0.3] * 9 + [np.nan],
        "score_strict_normalized": [0.4] * 9 + [np.nan],
        "is_sensitive_warning": [0] * 9 + [0],
        "is_behavior_anomaly": [0] * 9 + [0],
    })
    ready = pd.DataFrame({
        "event_id": ready_ids,
        "l2_ready_flag": [1] * 9,
        "operational_action_level": ["LOW"] * 9,
        "operational_judgment": ["NORMAL"] * 9,
        **{column: [0.1] * 9 for column in runtime.L2_PROBABILITY_COLUMNS},
    })
    unready = pd.DataFrame({
        "event_id": [10],
        "l1_score_available_flag": [0],
        "l2_ready_flag": [0],
        "readiness_reason": ["INSUFFICIENT_HISTORY_IN_SEGMENT"],
        "operational_action_level": [pd.NA],
        "operational_judgment": [pd.NA],
        **{column: [np.nan] for column in runtime.L2_PROBABILITY_COLUMNS},
    })
    return scored, ready, unready


def test_expected_missing_values_on_unready_rows_do_not_fail_dry_run():
    scored, ready, unready = _readiness_fixture()
    l1 = runtime._l1_runtime_readiness_summary(scored, {"result": "PASS"})
    l2 = runtime._l2_runtime_readiness_summary(ready, unready)
    assert l1["result"] == "PASS"
    assert l1["ready_l1_score_nan_or_inf_count"] == 0
    assert l1["unready_l1_expected_missing_value_count"] == 4
    assert l2["result"] == "PASS"
    assert l2["ready_l2_probability_nan_or_inf_count"] == 0
    assert l2["unready_l2_expected_missing_value_count"] == 6
    assert unready["operational_action_level"].isna().all()
    assert unready["readiness_reason"].notna().all()
    assert unready["readiness_reason"].str.strip().ne("").all()
    assert runtime._dry_run_result(l1, l2, {"result": "PASS"}) == "PASS"


def test_non_finite_values_on_ready_rows_fail_dry_run():
    scored, ready, unready = _readiness_fixture()
    scored.loc[0, "score_lenient"] = np.nan
    assert runtime._l1_runtime_readiness_summary(scored, {"result": "PASS"})["result"] == "FAIL"
    _, ready, unready = _readiness_fixture()
    ready.loc[0, runtime.L2_PROBABILITY_COLUMNS[0]] = np.inf
    assert runtime._l2_runtime_readiness_summary(ready, unready)["result"] == "FAIL"


def test_runtime_environment_manifest_records_sklearn_training_requirement(tmp_path: Path):
    environment = runtime.build_runtime_environment_manifest(tmp_path)
    assert environment["scikit_learn_required_version"] == "1.6.1"
    assert (tmp_path / "data/runtime_manifest/ai_runtime_environment.json").exists()


def _write_relocation_fixture(root: Path, *, corrupt_hash: bool = False, candidate_c_path: bool = False) -> None:
    requirements = root / "requirements2.txt"
    requirements.write_text("scikit-learn==1.6.1\n", encoding="utf-8")
    environment = root / "data/runtime_manifest/ai_runtime_environment.json"
    environment.parent.mkdir(parents=True, exist_ok=True)
    environment.write_text(json.dumps({
        "scikit_learn_required_version": "1.6.1",
        "artifact_serialization_warning_status": "WARNING_RUNTIME_SKLEARN_VERSION_DIFFERS_FROM_TRAINING",
    }), encoding="utf-8")
    payload = root / ("modeling/l1_tcn/artifacts_candidates/forbidden.txt" if candidate_c_path else "inference/online/runtime.py")
    payload.parent.mkdir(parents=True, exist_ok=True)
    payload.write_text("immutable", encoding="utf-8")
    paths = [requirements, environment, payload]
    records = [{"path": str(path.relative_to(root)).replace("\\", "/"), "sha256": runtime._sha256(path)} for path in paths]
    if corrupt_hash:
        records[-1]["sha256"] = "0" * 64
    bundle = root / "data/runtime_manifest/ai_runtime_bundle_manifest.json"
    bundle.write_text(json.dumps({"files": records}), encoding="utf-8")


def test_runtime_bundle_manifest_includes_requirements2(tmp_path: Path):
    for relative in [
        "a", "b", "c", "d", "e",
        "data/runtime_manifest/ai_production_lineage_manifest.json",
        "modeling/l1_tcn/configs/base.yaml",
    ]:
        path = tmp_path / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(relative, encoding="utf-8")
    runtime.build_runtime_environment_manifest(tmp_path)
    (tmp_path / "requirements2.txt").write_text("scikit-learn==1.6.1\n", encoding="utf-8")
    lineage = {
        "candidate_a": {"lenient": {"files": {"model": {"path": "a"}}}},
        "l2_selected_models": {},
        "production_profile_selection": {"path": "b"},
        "l2_feature_policy": {"path": "c"},
        "l1_score_clip_stats_train_only": {"path": "d"},
        "policy_l2": {"path": "e"},
        "code_files": {},
    }
    bundle = runtime.build_runtime_bundle_manifest(tmp_path, lineage)
    assert any(record["path"] == "requirements2.txt" for record in bundle["files"])
    assert any(record["path"] == "data/runtime_manifest/ai_runtime_environment.json" for record in bundle["files"])


def test_relocation_verification_fails_hash_mismatch_and_warns_sklearn_version(tmp_path: Path):
    _write_relocation_fixture(tmp_path, corrupt_hash=True)
    report = runtime.verify_runtime_bundle_integrity(tmp_path)
    assert report["result"] == "FAIL"
    assert report["hash_mismatches"] == ["inference/online/runtime.py"]
    assert report["environment_check"]["result"] == "WARNING_RUNTIME_SKLEARN_VERSION_MISMATCH"


def test_relocation_verification_rejects_candidate_c_runtime_path(tmp_path: Path):
    _write_relocation_fixture(tmp_path, candidate_c_path=True)
    report = runtime.verify_runtime_bundle_integrity(tmp_path)
    assert report["candidate_c_excluded"] is False
    assert report["candidate_c_paths_found"] == ["modeling/l1_tcn/artifacts_candidates/forbidden.txt"]


def test_l2_input_readiness_excludes_non_finite_rows_from_l2_and_policy(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    metadata = tmp_path / "metadata.json"
    metadata.write_text('{"features": ["required_feature"]}', encoding="utf-8")
    selected = {"future_fault_within_10_events": {"metadata_path": metadata}}
    monkeypatch.setattr(runtime, "_selected_l2", lambda root: ({}, {}, selected))
    ready, reasons = runtime._l2_input_readiness(pd.DataFrame({"required_feature": [1.0, np.nan]}), tmp_path)
    assert ready.tolist() == [True, False]
    assert reasons.tolist() == ["READY", "L2_NON_FINITE_REQUIRED_FEATURE:required_feature"]


def test_multi_machine_ready_sampling_stays_inside_machine_and_segment():
    for machine_id in range(1, 15):
        frame = pd.DataFrame({
            "event_id": list(range(machine_id * 1000, machine_id * 1000 + 70)),
            "machine_id": [machine_id] * 70,
            "sequence_segment_id": [1] * 70,
            "event_order_in_segment": list(range(1, 71)),
            "event_start_time": pd.date_range("2026-01-01", periods=70, freq="s"),
            "is_open_event": [0] * 70,
        })
        for column in L1_MODEL_FEATURES:
            frame[column] = 0
        candidate_ids = runtime._choose_l1_ready_candidate_ids(frame, 50)
        manifest = runtime.build_window_manifest(frame, candidate_ids, window_size=20)
        assert len(candidate_ids) == 50
        assert manifest["window_ready_flag"].eq(1).all()
        assert runtime._window_boundary_violations(frame, manifest) == {
            "cross_machine": 0,
            "cross_segment": 0,
            "missing_source_events": 0,
        }
