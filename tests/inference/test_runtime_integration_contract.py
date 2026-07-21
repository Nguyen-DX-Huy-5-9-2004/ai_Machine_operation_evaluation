from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from inference.online.controlled_writer import WriteGate, evaluate_write_gate, write_results_transactionally
from inference.online.explainability import CONTRIBUTION_METHODOLOGY, build_explanation, explanation_json
from inference.online.runtime_contract import DatasetMode, EventSource, add_source_identity, make_event_uid


def test_historical_and_current_event_ids_have_distinct_namespaces() -> None:
    assert make_event_uid(EventSource.HISTORICAL, 48043) != make_event_uid(EventSource.CURRENT, 48043)
    historical = add_source_identity(pd.DataFrame({"event_id": [1]}), EventSource.HISTORICAL)
    current = add_source_identity(pd.DataFrame({"event_id": [1]}), EventSource.CURRENT)
    combined = pd.concat([historical, current], ignore_index=True)
    assert len(combined) == 2
    assert combined.event_uid.nunique() == 2
    assert set(DatasetMode) == {DatasetMode.HISTORICAL, DatasetMode.CURRENT}


def test_explanation_is_deterministic_policy_evidence_not_shap() -> None:
    row = {
        "l1_score_available_flag": 1,
        "l2_ready_flag": 1,
        "score_lenient_normalized": 1.2,
        "score_strict_normalized": 1.3,
        "is_behavior_anomaly": 0,
        "is_sensitive_warning": 1,
        "risk_fault_10_events": 0.7,
        "operational_action_level": "HIGH",
        "policy_ready_flag": 1,
    }
    thresholds = {"future_fault_within_10_events": 0.5}
    first = explanation_json(row, thresholds)
    second = explanation_json(row, thresholds)
    assert first == second
    parsed = json.loads(first)
    assert parsed["methodology"] == CONTRIBUTION_METHODOLOGY
    assert parsed["notShap"] is True
    assert parsed["policyDecision"]["suppressedReasons"] == ["STRICT_ONLY_AUDIT_NO_ACTION_UPLIFT"]
    assert sum(item["percent"] for item in parsed["decisionContributions"]) == pytest.approx(100.0, abs=1e-4)


def test_missing_explanation_fields_stay_unavailable() -> None:
    value = build_explanation({}, {}, historical=True)
    assert value["availability"] is False
    assert value["l1Activation"]["scoreLenientRaw"] is None
    assert value["policyDecision"]["operationalActionLevel"] is None
    assert value["decisionContributions"] == []


def test_controlled_writer_is_disabled_without_every_gate() -> None:
    cfg = {"runtime": {"enable_sql_write": False, "sql_write_target_allowlist": []}, "database": {"server": "db", "database": "obad"}}
    gate = evaluate_write_gate(
        cfg,
        cli_enable=False,
        cli_confirmation=None,
        lineage_ok=True,
        environment_ok=True,
        artifact_integrity_ok=True,
        dry_run=True,
        env={},
    )
    assert gate.enabled is False
    with pytest.raises(PermissionError, match="SQL_WRITE_BLOCKED"):
        gate.require_enabled()


class _Cursor:
    def __init__(self, state: set[tuple[str, int]]) -> None:
        self.state = state
        self._inserted = False
        self.closed = False

    def execute(self, sql: str, params: list[object]) -> None:
        if "UPDATE [dbo].[result]" in sql:
            # Writer parameters put source/event immediately before all insert values.
            insert_width = sql.split("VALUES (", 1)[1].split(")", 1)[0].count("?") if "VALUES (" in sql else 0
            source = str(params[-insert_width - 2])
            event_id = int(params[-insert_width - 1])
            key = (source, event_id)
            self._inserted = key not in self.state
            self.state.add(key)

    def fetchone(self):
        return (1 if self._inserted else 0,)

    def close(self) -> None:
        self.closed = True


class _Connection:
    def __init__(self) -> None:
        self.state: set[tuple[str, int]] = set()
        self.commits = 0
        self.rollbacks = 0

    def cursor(self) -> _Cursor:
        return _Cursor(self.state)

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


def _write_rows() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "event_source": [EventSource.CURRENT.value],
            "event_uid": [make_event_uid(EventSource.CURRENT, 7)],
            "event_id": [7],
            "policy_ready_flag": [1],
            "operational_action_level": ["LOW"],
        }
    )


def test_controlled_writer_is_idempotent_and_commits_checkpoint_with_results() -> None:
    conn = _Connection()
    gate = WriteGate(True, ())
    kwargs = dict(
        result_table="dbo.result",
        checkpoint_table="dbo.checkpoint",
        run_log_table="dbo.run_log",
        pipeline_name="obad",
        runtime_run_id="run-1",
        rows=_write_rows(),
        checkpoint_event_id=7,
        checkpoint_event_time=pd.Timestamp("2026-01-01"),
        run_summary={},
        gate=gate,
    )
    first = write_results_transactionally(conn, **kwargs)
    second = write_results_transactionally(conn, **{**kwargs, "runtime_run_id": "run-2"})
    assert first == {"inserted": 1, "updated": 0, "skipped_duplicate": 0}
    assert second == {"inserted": 0, "updated": 1, "skipped_duplicate": 0}
    assert conn.commits == 2
    assert conn.rollbacks == 0


def test_controlled_writer_rejects_unready_and_monitor_rows() -> None:
    conn = _Connection()
    rows = _write_rows()
    rows.loc[0, "policy_ready_flag"] = 0
    with pytest.raises(ValueError, match="policy-ready"):
        write_results_transactionally(
            conn,
            result_table="dbo.result",
            checkpoint_table="dbo.checkpoint",
            run_log_table="dbo.run_log",
            pipeline_name="obad",
            runtime_run_id="run",
            rows=rows,
            checkpoint_event_id=7,
            checkpoint_event_time=None,
            run_summary={},
            gate=WriteGate(True, ()),
        )
    rows = _write_rows()
    rows.loc[0, "operational_action_level"] = "MONITOR"
    with pytest.raises(ValueError, match="invalid operational"):
        write_results_transactionally(
            conn,
            result_table="dbo.result",
            checkpoint_table="dbo.checkpoint",
            run_log_table="dbo.run_log",
            pipeline_name="obad",
            runtime_run_id="run",
            rows=rows,
            checkpoint_event_id=7,
            checkpoint_event_time=None,
            run_summary={},
            gate=WriteGate(True, ()),
        )


def test_candidate_c_path_is_rejected_without_loading_artifacts(tmp_path: Path) -> None:
    from inference.online.l1_scorer import L1Scorer

    with pytest.raises(ValueError, match="Candidate C"):
        L1Scorer({"obad_root": str(tmp_path), "l1_artifact_dir": "modeling/l1_tcn/artifacts_candidates/run"})
