from __future__ import annotations

import numpy as np
import pandas as pd

from inference.online.l2_scorer import L2Scorer
from inference.online.score_new_events import canary_selection_log, select_local_canary_row, summarize_l1_unready_reasons
from inference.online.validation import build_summary


class _NamedFrameModel:
    def __init__(self) -> None:
        self.received: pd.DataFrame | None = None

    def predict_proba(self, frame: pd.DataFrame) -> np.ndarray:
        self.received = frame
        return np.array([[0.2, 0.8]], dtype=float)


def test_l2_predict_preserves_named_feature_dataframe() -> None:
    model = _NamedFrameModel()
    scorer = L2Scorer.__new__(L2Scorer)
    scorer.models = {"future_fault_within_10_events": model}
    scorer.features = {"future_fault_within_10_events": ["first", "second"]}
    scorer.categorical_features = {"future_fault_within_10_events": set()}
    scorer.thresholds = {"future_fault_within_10_events": 0.5}

    result = scorer.predict(pd.DataFrame({"first": [1], "second": [2]}))

    assert list(model.received.columns) == ["first", "second"]
    assert result.loc[0, "risk_fault_10_events"] == 0.8


def test_l1_unready_summary_identifies_window_history_only() -> None:
    summary = summarize_l1_unready_reasons(
        pd.DataFrame({"readiness_reason": ["INSUFFICIENT_HISTORY_IN_SEGMENT"] * 60}),
        window_size=20,
    )

    assert summary["l1_unready_count"] == 60
    assert summary["l1_window_size"] == 20
    assert summary["feature_related_unready_count"] == 0
    assert summary["only_insufficient_history_in_segment"] is True


def test_generic_audit_marks_a_completed_model_dry_run_as_full_ai_pass(tmp_path) -> None:
    processed = pd.DataFrame(
        {
            "event_id": [1],
            "machine_id": [11],
            "is_open_event": [0],
            "status_type_code": [1],
            "current_signal_code": [2],
            "location_id": [4],
            "sequence_segment_id": [1],
            "event_order_in_segment": [20],
        }
    )
    summary = build_summary(
        cfg={"runtime": {}},
        mode="dry-run",
        audit_root=tmp_path,
        raw_candidates=processed,
        raw_context=processed,
        processed_features=processed,
        features_closed=processed,
        historical_compare=pd.DataFrame(),
        historical_compare_meta={},
        l1_mode="candidate_a_read_only",
        l2_mode="selected_lightgbm_read_only",
        write_sql_enabled=False,
        location_mapping_mode="event_time",
        l2_missing_features={},
        l1_contract_report={"result": "PASS"},
        l2_contract_report={"result": "PASS"},
        invariant_report={"result": "PASS"},
        model_execution_result="FULL_AI_DRY_RUN_PASS",
        model_scored_rows=1,
    )

    assert summary["overall_mode_result"] == "FULL_AI_DRY_RUN_PASS"
    assert summary["result"] == "FULL_AI_DRY_RUN_PASS"
    assert summary["scored_rows_if_any"] == 1


def test_local_canary_selects_only_the_first_policy_ready_event() -> None:
    output = pd.DataFrame(
        {
            "event_id": [30, 10, 20],
            "machine_id": [3, 1, 2],
            "source_event_start_time": pd.to_datetime(["2026-01-03", "2026-01-01", "2026-01-02"]),
            "policy_ready_flag": [1, 0, 1],
        }
    )
    selected = select_local_canary_row(output)
    log = canary_selection_log(pd.DataFrame({"event_id": range(500)}), 240, 2, selected)

    assert selected["event_id"].tolist() == [20]
    assert log == {
        "scanned_candidates": 500,
        "l1_ready_count": 240,
        "policy_ready_count": 2,
        "selected_event_id": 20,
        "selected_machine_id": "2",
    }
