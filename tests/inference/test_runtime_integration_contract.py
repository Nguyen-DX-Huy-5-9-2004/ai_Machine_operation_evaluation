from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from inference.online.controlled_writer import (
    LOCAL_CANARY_WRITE_CONFIRMATION_VALUE,
    WriteGate,
    evaluate_local_canary_invocation_gate,
    evaluate_local_canary_write_gate,
    evaluate_write_gate,
    write_one_local_canary_transactionally,
    write_results_transactionally,
)
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


def test_local_canary_gate_requires_explicit_local_only_controls() -> None:
    cfg = {
        "runtime": {
            "dry_run": False,
            "enable_sql_write": False,
            "enable_local_canary_sql_write": True,
            "local_canary_sql_write_target_allowlist": ["local/obad_ai_local"],
            "local_canary_max_write_rows": 1,
        },
        "database": {"server": "local", "database": "obad_ai_local"},
    }
    gate = evaluate_local_canary_write_gate(
        cfg,
        cli_enable=True,
        cli_confirmation=LOCAL_CANARY_WRITE_CONFIRMATION_VALUE,
        lineage_ok=True,
        environment_ok=True,
        artifact_integrity_ok=True,
        dry_run=False,
        env={"OBAD_ALLOW_LOCAL_CANARY_SQL_WRITE": "YES"},
    )
    assert gate.enabled is True

    blocked = evaluate_local_canary_write_gate(
        cfg,
        cli_enable=True,
        cli_confirmation=None,
        lineage_ok=True,
        environment_ok=True,
        artifact_integrity_ok=True,
        dry_run=False,
        env={},
    )
    assert blocked.enabled is False
    assert "local canary confirmation value missing" in blocked.reasons


def test_local_canary_invocation_fails_closed_before_model_work() -> None:
    cfg = {
        "runtime": {
            "dry_run": True,
            "enable_sql_write": False,
            "enable_local_canary_sql_write": False,
            "local_canary_sql_write_target_allowlist": ["local/obad_ai_local"],
            "local_canary_max_write_rows": 1,
        },
        "database": {"server": "local", "database": "obad_ai_local"},
    }
    gate = evaluate_local_canary_invocation_gate(
        cfg,
        cli_enable=True,
        cli_confirmation="wrong",
        effective_dry_run=True,
        env={},
    )
    assert gate.enabled is False
    assert "runtime.dry_run must be false for local canary" in gate.reasons
    assert "runtime.enable_local_canary_sql_write is false" in gate.reasons
    assert "local canary confirmation value missing" in gate.reasons
    assert "OBAD_ALLOW_LOCAL_CANARY_SQL_WRITE is not YES" in gate.reasons


class _Cursor:
    def __init__(self, connection: "_Connection") -> None:
        self.connection = connection
        self.state = connection.state
        self._query_result: tuple[int] | None = None
        self._is_query = False
        self.rowcount = -1
        self.closed = False

    def execute(self, sql: str, params: list[object]) -> None:
        self.connection.executed_sql.append(sql)
        self._query_result = None
        self._is_query = False
        self.rowcount = -1
        if self.connection.fail_on and self.connection.fail_on in sql:
            raise RuntimeError(f"simulated write failure at {self.connection.fail_on}")
        if "FROM sys.columns AS c" in sql:
            self._is_query = True
            self._query_result = (0, 0, "bigint")
        elif "SELECT ISNULL(MAX([run_log_id]), 0) + 1 AS next_run_log_id" in sql:
            self._is_query = True
            self._query_result = (max(self.connection.pending_run_log_ids, default=0) + 1,)
        elif "SELECT TOP (1) 1 AS row_exists" in sql:
            self._is_query = True
            key = (str(params[0]), int(params[1]))
            self._query_result = (1,) if key in self.connection.pending_state else None
        elif "UPDATE [dbo].[result]" in sql:
            key = (str(params[-2]), int(params[-1]))
            self.rowcount = int(key in self.connection.pending_state)
        elif "INSERT INTO [dbo].[result]" in sql:
            key = (str(params[0]), int(params[2]))
            self.connection.pending_state.add(key)
            self.connection.pending_scored_times[key] = "SIMULATED_UTC_TIMESTAMP"
            self.rowcount = 1
        elif "UPDATE [dbo].[checkpoint]" in sql:
            self.connection.pending_checkpoint = int(params[0])
            self.rowcount = 1
        elif "INSERT INTO [dbo].[run_log]" in sql:
            has_manual_id = "[run_log_id]" in sql
            if has_manual_id:
                self.connection.pending_run_log_ids.append(int(params[0]))
            self.connection.pending_run_logs.append(str(params[1] if has_manual_id else params[0]))
            self.rowcount = 1

    def fetchone(self):
        if not self._is_query:
            raise RuntimeError("No results. Previous SQL was not a query.")
        return self._query_result

    def close(self) -> None:
        self.closed = True


class _Connection:
    def __init__(self, *, fail_on: str | None = None) -> None:
        self.state: set[tuple[str, int]] = set()
        self.pending_state: set[tuple[str, int]] = set()
        self.scored_times: dict[tuple[str, int], str] = {}
        self.pending_scored_times: dict[tuple[str, int], str] = {}
        self.checkpoint: int | None = None
        self.pending_checkpoint: int | None = None
        self.run_logs: list[str] = []
        self.pending_run_logs: list[str] = []
        self.run_log_ids: list[int] = []
        self.pending_run_log_ids: list[int] = []
        self.error_logs: list[str] = []
        self.fail_on = fail_on
        self.commits = 0
        self.rollbacks = 0
        self.executed_sql: list[str] = []

    def cursor(self) -> _Cursor:
        return _Cursor(self)

    def commit(self) -> None:
        self.state = self.pending_state.copy()
        self.scored_times = self.pending_scored_times.copy()
        self.checkpoint = self.pending_checkpoint
        self.run_logs = self.pending_run_logs.copy()
        self.run_log_ids = self.pending_run_log_ids.copy()
        self.commits += 1

    def rollback(self) -> None:
        self.pending_state = self.state.copy()
        self.pending_scored_times = self.scored_times.copy()
        self.pending_checkpoint = self.checkpoint
        self.pending_run_logs = self.run_logs.copy()
        self.pending_run_log_ids = self.run_log_ids.copy()
        self.rollbacks += 1


def _write_rows(event_id: int = 7) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "event_source": [EventSource.CURRENT.value],
            "event_uid": [make_event_uid(EventSource.CURRENT, event_id)],
            "event_id": [event_id],
            "machine_id": ["WC-047"],
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


def test_local_canary_rejects_more_than_one_policy_ready_row() -> None:
    rows = pd.concat([_write_rows(), _write_rows()], ignore_index=True)
    with pytest.raises(ValueError, match="exactly one policy-ready row"):
        write_one_local_canary_transactionally(
            _Connection(),
            result_table="dbo.result",
            checkpoint_table="dbo.checkpoint",
            run_log_table="dbo.run_log",
            pipeline_name="obad",
            runtime_run_id="canary-1",
            rows=rows,
            checkpoint_event_id=7,
            checkpoint_event_time=pd.Timestamp("2026-01-01"),
            run_summary={},
            gate=WriteGate(True, ()),
        )


def test_local_canary_writes_one_result_checkpoint_and_run_log_only_once() -> None:
    conn = _Connection()
    result = write_one_local_canary_transactionally(
        conn,
        result_table="dbo.result",
        checkpoint_table="dbo.checkpoint",
        run_log_table="dbo.run_log",
        pipeline_name="obad",
        runtime_run_id="canary-1",
        rows=_write_rows(),
        checkpoint_event_id=7,
        checkpoint_event_time=pd.Timestamp("2026-01-01"),
        run_summary={},
        gate=WriteGate(True, ()),
    )

    assert result == {"inserted": 1, "updated": 0, "skipped_duplicate": 0}
    assert sum("INSERT INTO [dbo].[result]" in sql for sql in conn.executed_sql) == 1
    assert sum("UPDATE [dbo].[checkpoint]" in sql for sql in conn.executed_sql) == 1
    assert sum("INSERT INTO [dbo].[run_log]" in sql for sql in conn.executed_sql) == 1
    assert conn.run_log_ids == [1]
    assert not any("error_log" in sql.lower() for sql in conn.executed_sql)


def test_insert_generates_scored_time_for_event_61204_when_row_omits_it() -> None:
    conn = _Connection()
    rows = _write_rows(61204)
    assert "scored_time" not in rows.columns

    write_one_local_canary_transactionally(
        conn,
        result_table="dbo.result",
        checkpoint_table="dbo.checkpoint",
        run_log_table="dbo.run_log",
        pipeline_name="obad",
        runtime_run_id="canary-61204",
        rows=rows,
        checkpoint_event_id=61204,
        checkpoint_event_time=pd.Timestamp("2026-01-01"),
        run_summary={},
        gate=WriteGate(True, ()),
    )

    key = (EventSource.CURRENT.value, 61204)
    assert key in conn.state
    assert conn.scored_times[key] is not None
    insert_sql = next(sql for sql in conn.executed_sql if "INSERT INTO [dbo].[result]" in sql)
    assert "[scored_time]" in insert_sql
    assert "SYSUTCDATETIME()" in insert_sql


def test_source_aware_view_projects_online_scored_time_as_scored_at() -> None:
    view_sql = Path("sql/02_create_unified_dashboard_view.sql").read_text(encoding="utf-8")
    assert "CAST(o.scored_time AS DATETIME2) AS scored_at" in view_sql


def test_missing_required_online_column_fails_before_any_sql_write() -> None:
    conn = _Connection()
    rows = _write_rows().drop(columns=["event_uid"])
    with pytest.raises(ValueError, match=r"missing required columns: \['event_uid'\]"):
        write_one_local_canary_transactionally(
            conn,
            result_table="dbo.result",
            checkpoint_table="dbo.checkpoint",
            run_log_table="dbo.run_log",
            pipeline_name="obad",
            runtime_run_id="missing-column",
            rows=rows,
            checkpoint_event_id=7,
            checkpoint_event_time=pd.Timestamp("2026-01-01"),
            run_summary={},
            gate=WriteGate(True, ()),
        )
    assert conn.executed_sql == []


def test_pyodbc_style_fetchone_after_non_query_raises() -> None:
    cursor = _Connection().cursor()
    cursor.execute("INSERT INTO [dbo].[run_log] (runtime_run_id) VALUES (?)", ["run-1"])
    with pytest.raises(RuntimeError, match=r"No results\. Previous SQL was not a query"):
        cursor.fetchone()


def test_transaction_failure_rolls_back_online_checkpoint_and_run_log() -> None:
    conn = _Connection(fail_on="INSERT INTO [dbo].[run_log]")
    with pytest.raises(RuntimeError, match="simulated write failure"):
        write_one_local_canary_transactionally(
            conn,
            result_table="dbo.result",
            checkpoint_table="dbo.checkpoint",
            run_log_table="dbo.run_log",
            pipeline_name="obad",
            runtime_run_id="canary-failing-run",
            rows=_write_rows(),
            checkpoint_event_id=7,
            checkpoint_event_time=pd.Timestamp("2026-01-01"),
            run_summary={},
            gate=WriteGate(True, ()),
        )

    assert conn.commits == 0
    assert conn.rollbacks == 1
    assert conn.state == set()  # online result rows
    assert conn.checkpoint is None
    assert conn.run_logs == []
    assert conn.run_log_ids == []
    assert conn.error_logs == []


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
