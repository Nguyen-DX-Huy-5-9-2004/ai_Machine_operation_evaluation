from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Iterable, Mapping, Sequence

import pandas as pd

from .runtime_contract import EventSource
from .sql_queries import quote_name, table_name


WRITE_CONFIRMATION_VALUE = "I_UNDERSTAND_THIS_WRITES_PRODUCTION_AI_RESULTS"
LOCAL_CANARY_WRITE_CONFIRMATION_VALUE = "I_UNDERSTAND_THIS_WRITES_ONE_LOCAL_CANARY_EVENT"
SQL_MANAGED_ONLINE_COLUMNS = frozenset({"scored_time"})
REQUIRED_ONLINE_WRITE_COLUMNS = frozenset({"event_source", "event_uid", "event_id", "policy_ready_flag", "operational_action_level"})
REQUIRED_ONLINE_WRITE_VALUES = frozenset({"event_source", "event_uid", "event_id"})


@dataclass(frozen=True)
class WriteGate:
    enabled: bool
    reasons: tuple[str, ...]

    def require_enabled(self) -> None:
        if not self.enabled:
            raise PermissionError("SQL_WRITE_BLOCKED: " + "; ".join(self.reasons))


def evaluate_write_gate(
    cfg: Mapping[str, Any],
    *,
    cli_enable: bool,
    cli_confirmation: str | None,
    lineage_ok: bool,
    environment_ok: bool,
    artifact_integrity_ok: bool,
    dry_run: bool,
    env: Mapping[str, str] | None = None,
) -> WriteGate:
    env = env or os.environ
    runtime = cfg.get("runtime", {})
    database = cfg.get("database", {})
    server = str(database.get("server", "")).strip().lower()
    database_name = str(database.get("database", "")).strip().lower()
    allowlist = {str(value).strip().lower() for value in runtime.get("sql_write_target_allowlist", [])}
    target = f"{server}/{database_name}"
    checks = {
        "explicit --enable-sql-write flag missing": cli_enable,
        "runtime.enable_sql_write is false": bool(runtime.get("enable_sql_write", False)),
        "explicit confirmation value missing": cli_confirmation == WRITE_CONFIRMATION_VALUE,
        "OBAD_ALLOW_PRODUCTION_SQL_WRITE is not YES": str(env.get("OBAD_ALLOW_PRODUCTION_SQL_WRITE", "")).upper() == "YES",
        "production lineage hash did not pass": lineage_ok,
        "runtime environment did not pass": environment_ok,
        "artifact integrity did not pass": artifact_integrity_ok,
        "dry-run is still enabled": not dry_run,
        "database target is not allowlisted": target in allowlist,
    }
    reasons = tuple(reason for reason, passed in checks.items() if not passed)
    return WriteGate(enabled=not reasons, reasons=reasons)


def evaluate_local_canary_write_gate(
    cfg: Mapping[str, Any],
    *,
    cli_enable: bool,
    cli_confirmation: str | None,
    lineage_ok: bool,
    environment_ok: bool,
    artifact_integrity_ok: bool,
    dry_run: bool,
    env: Mapping[str, str] | None = None,
) -> WriteGate:
    """Gate a one-row local SQL canary without enabling bulk writes."""
    invocation_gate = evaluate_local_canary_invocation_gate(
        cfg,
        cli_enable=cli_enable,
        cli_confirmation=cli_confirmation,
        effective_dry_run=dry_run,
        env=env,
    )
    prerequisite_checks = {
        "production lineage hash did not pass": lineage_ok,
        "runtime environment did not pass": environment_ok,
        "artifact integrity did not pass": artifact_integrity_ok,
    }
    reasons = (*invocation_gate.reasons, *(reason for reason, passed in prerequisite_checks.items() if not passed))
    return WriteGate(enabled=not reasons, reasons=reasons)


def evaluate_local_canary_invocation_gate(
    cfg: Mapping[str, Any],
    *,
    cli_enable: bool,
    cli_confirmation: str | None,
    effective_dry_run: bool,
    env: Mapping[str, str] | None = None,
) -> WriteGate:
    """Fail closed before SQL reads or model scoring for a local canary invocation."""
    env = env or os.environ
    runtime = cfg.get("runtime", {})
    database = cfg.get("database", {})
    target = f"{str(database.get('server', '')).strip().lower()}/{str(database.get('database', '')).strip().lower()}"
    allowlist = {str(value).strip().lower() for value in runtime.get("local_canary_sql_write_target_allowlist", [])}
    checks = {
        "explicit --local-sql-write-canary flag missing": cli_enable,
        "runtime.dry_run must be false for local canary": runtime.get("dry_run", True) is False,
        "effective dry-run is enabled": not effective_dry_run,
        "runtime.enable_sql_write must remain false for local canary": not bool(runtime.get("enable_sql_write", False)),
        "runtime.enable_local_canary_sql_write is false": bool(runtime.get("enable_local_canary_sql_write", False)),
        "runtime.local_canary_max_write_rows must equal 1": int(runtime.get("local_canary_max_write_rows", 0)) == 1,
        "local canary confirmation value missing": cli_confirmation == LOCAL_CANARY_WRITE_CONFIRMATION_VALUE,
        "OBAD_ALLOW_LOCAL_CANARY_SQL_WRITE is not YES": str(env.get("OBAD_ALLOW_LOCAL_CANARY_SQL_WRITE", "")).upper() == "YES",
        "database target is not allowlisted for local canary": target in allowlist,
    }
    reasons = tuple(reason for reason, passed in checks.items() if not passed)
    return WriteGate(enabled=not reasons, reasons=reasons)


def write_one_local_canary_transactionally(
    conn: Any,
    *,
    result_table: str,
    checkpoint_table: str,
    run_log_table: str,
    pipeline_name: str,
    runtime_run_id: str,
    rows: pd.DataFrame,
    checkpoint_event_id: int | None,
    checkpoint_event_time: Any,
    run_summary: Mapping[str, Any],
    gate: WriteGate,
) -> dict[str, int]:
    """Write exactly one policy-ready row for the local database canary."""
    gate.require_enabled()
    if len(rows) != 1:
        raise ValueError(f"local canary requires exactly one policy-ready row, received {len(rows)}")
    if "machine_id" not in rows.columns or rows["machine_id"].nunique(dropna=True) != 1:
        raise ValueError("local canary requires exactly one machine")
    return write_results_transactionally(
        conn,
        result_table=result_table,
        checkpoint_table=checkpoint_table,
        run_log_table=run_log_table,
        pipeline_name=pipeline_name,
        runtime_run_id=runtime_run_id,
        rows=rows,
        checkpoint_event_id=checkpoint_event_id,
        checkpoint_event_time=checkpoint_event_time,
        run_summary=run_summary,
        gate=gate,
    )


def write_results_transactionally(
    conn: Any,
    *,
    result_table: str,
    checkpoint_table: str,
    run_log_table: str,
    pipeline_name: str,
    runtime_run_id: str,
    rows: pd.DataFrame,
    checkpoint_event_id: int | None,
    checkpoint_event_time: Any,
    run_summary: Mapping[str, Any],
    gate: WriteGate,
) -> dict[str, int]:
    """Idempotent update/insert and checkpoint in one transaction.

    No commit occurs before all result rows, checkpoint and run log succeed.
    """
    gate.require_enabled()
    if rows.empty:
        return {"inserted": 0, "updated": 0, "skipped_duplicate": 0}
    required = REQUIRED_ONLINE_WRITE_COLUMNS
    missing = sorted(required - set(rows.columns))
    if missing:
        raise ValueError(f"controlled writer missing required columns: {missing}")
    missing_values = [
        column
        for column in sorted(REQUIRED_ONLINE_WRITE_VALUES)
        if rows[column].isna().any() or rows[column].astype(str).str.strip().eq("").any()
    ]
    if missing_values:
        raise ValueError(f"controlled writer required columns contain null or blank values: {missing_values}")
    if not rows["event_source"].eq(EventSource.CURRENT.value).all():
        raise ValueError("controlled writer only accepts ONLINE_CURRENT_SQL rows")
    if rows[["event_source", "event_id"]].duplicated().any() or rows["event_uid"].duplicated().any():
        raise ValueError("controlled writer input contains duplicate source-aware keys")
    if "policy_ready_flag" not in rows.columns or not pd.to_numeric(rows["policy_ready_flag"], errors="coerce").eq(1).all():
        raise ValueError("controlled writer accepts policy-ready rows only; unready rows remain audit-only")
    allowed_actions = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    actions = set(rows["operational_action_level"].dropna().astype(str)) if "operational_action_level" in rows.columns else set()
    if not actions or not actions.issubset(allowed_actions):
        raise ValueError(f"controlled writer received invalid operational actions: {sorted(actions - allowed_actions)}")

    columns = [column for column in rows.columns if column not in SQL_MANAGED_ONLINE_COLUMNS]
    mutable = [column for column in columns if column not in {"event_source", "event_id", "event_uid"}]
    update_set = ", ".join([*(f"{quote_name(column)} = ?" for column in mutable), "[scored_time] = SYSUTCDATETIME()"])
    insert_columns = ", ".join([*(quote_name(column) for column in columns), "[scored_time]"])
    insert_values = ", ".join([*("?" for _ in columns), "SYSUTCDATETIME()"])
    exists_sql = f"""
SELECT TOP (1) 1 AS row_exists
FROM {table_name(result_table)} WITH (UPDLOCK, HOLDLOCK)
WHERE [event_source] = ? AND [event_id] = ?;
"""
    update_sql = f"""
UPDATE {table_name(result_table)}
SET {update_set}
WHERE [event_source] = ? AND [event_id] = ?;
"""
    insert_sql = f"""
INSERT INTO {table_name(result_table)} ({insert_columns})
VALUES ({insert_values});
"""

    cursor = conn.cursor()
    inserted = updated = 0
    try:
        for record in rows.to_dict(orient="records"):
            params = [*_clean_values(record[column] for column in mutable), record["event_source"], int(record["event_id"])]
            cursor.execute(exists_sql, [record["event_source"], int(record["event_id"])])
            exists = cursor.fetchone() is not None
            if exists:
                cursor.execute(update_sql, params)
                updated += max(int(cursor.rowcount), 0)
            else:
                cursor.execute(insert_sql, _clean_values(record[column] for column in columns))
                inserted += max(int(cursor.rowcount), 0)

        if checkpoint_event_id is not None:
            checkpoint_sql = f"""
UPDATE {table_name(checkpoint_table)} WITH (UPDLOCK, HOLDLOCK)
SET last_event_id = ?, last_event_time = ?, updated_time = SYSUTCDATETIME()
WHERE pipeline_name = ?;
IF @@ROWCOUNT = 0
    INSERT INTO {table_name(checkpoint_table)}
        (pipeline_name, last_event_id, last_event_time, updated_time)
    VALUES (?, ?, ?, SYSUTCDATETIME());
"""
            cursor.execute(
                checkpoint_sql,
                [checkpoint_event_id, _clean_value(checkpoint_event_time), pipeline_name, pipeline_name, checkpoint_event_id, _clean_value(checkpoint_event_time)],
            )

        run_log_id = _next_required_run_log_id(cursor, run_log_table)
        run_values: list[Any] = [
            runtime_run_id,
            pipeline_name,
            _clean_value(run_summary.get("started_at", datetime.now(UTC))),
            run_summary.get("status", "SUCCESS"),
            int(run_summary.get("raw_candidate_count", 0)),
            int(run_summary.get("context_count", 0)),
            int(run_summary.get("canonical_count", 0)),
            int(run_summary.get("l1_ready_count", 0)),
            int(run_summary.get("l1_unready_count", 0)),
            int(run_summary.get("l2_ready_count", 0)),
            int(run_summary.get("l2_unready_count", 0)),
            int(run_summary.get("policy_ready_count", len(rows))),
            inserted,
            updated,
            int(run_summary.get("skipped_duplicate_count", 0)),
            int(run_summary.get("failed_count", 0)),
            run_summary.get("error_summary"),
            run_summary.get("model_lineage_hash"),
            run_summary.get("policy_version"),
            1,
        ]
        if run_log_id is not None:
            run_values.insert(0, run_log_id)
        run_log_id_column = "[run_log_id], " if run_log_id is not None else ""
        run_log_id_value = "?, " if run_log_id is not None else ""
        run_sql = f"""
INSERT INTO {table_name(run_log_table)}
    ({run_log_id_column}runtime_run_id, pipeline_name, started_time, ended_time, status,
      raw_candidate_count, context_count, canonical_count,
      l1_ready_count, l1_unready_count, l2_ready_count, l2_unready_count,
      policy_ready_count, inserted_count, updated_count,
      skipped_duplicate_count, failed_count, error_summary,
      model_lineage_hash, policy_version, sql_write_enabled)
VALUES ({run_log_id_value}?, ?, ?, SYSUTCDATETIME(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""
        cursor.execute(
            run_sql,
            run_values,
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        if hasattr(cursor, "close"):
            cursor.close()
    return {"inserted": inserted, "updated": updated, "skipped_duplicate": 0}


def _next_required_run_log_id(cursor: Any, run_log_table: str) -> int | None:
    """Return a manual key only for legacy local run-log schemas that need one."""
    metadata_sql = """
SELECT c.is_identity,
       CASE WHEN c.default_object_id = 0 THEN 0 ELSE 1 END AS has_default,
       t.name AS type_name
FROM sys.columns AS c
JOIN sys.types AS t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(?) AND c.name = N'run_log_id';
"""
    cursor.execute(metadata_sql, [run_log_table])
    metadata = cursor.fetchone()
    if metadata is None:
        return None
    is_identity, has_default, type_name = metadata
    if bool(is_identity) or bool(has_default):
        return None
    if str(type_name).lower() not in {"bigint", "int", "smallint", "tinyint"}:
        raise ValueError(f"run_log_id requires an unsupported manual key type: {type_name}")
    next_id_sql = f"SELECT ISNULL(MAX([run_log_id]), 0) + 1 AS next_run_log_id FROM {table_name(run_log_table)} WITH (UPDLOCK, HOLDLOCK);"
    cursor.execute(next_id_sql, [])
    next_id = cursor.fetchone()
    if next_id is None or next_id[0] is None:
        raise RuntimeError("unable to allocate required run_log_id")
    return int(next_id[0])


def _clean_values(values: Iterable[Any]) -> list[Any]:
    return [_clean_value(value) for value in values]


def _clean_value(value: Any) -> Any:
    if value is None or pd.isna(value):
        return None
    if hasattr(value, "to_pydatetime"):
        return value.to_pydatetime()
    if isinstance(value, bool):
        return int(value)
    return value.item() if hasattr(value, "item") else value
