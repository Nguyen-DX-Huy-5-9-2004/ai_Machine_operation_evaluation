from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Iterable, Mapping, Sequence

import pandas as pd

from .runtime_contract import EventSource
from .sql_queries import quote_name, table_name


WRITE_CONFIRMATION_VALUE = "I_UNDERSTAND_THIS_WRITES_PRODUCTION_AI_RESULTS"


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
    required = {"event_source", "event_id", "event_uid"}
    missing = sorted(required - set(rows.columns))
    if missing:
        raise ValueError(f"controlled writer missing source-aware keys: {missing}")
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

    columns = list(rows.columns)
    mutable = [column for column in columns if column not in {"event_source", "event_id", "event_uid"}]
    update_set = ", ".join(f"{quote_name(column)} = ?" for column in mutable)
    insert_columns = ", ".join(quote_name(column) for column in columns)
    insert_values = ", ".join("?" for _ in columns)
    upsert_sql = f"""
UPDATE {table_name(result_table)} WITH (UPDLOCK, HOLDLOCK)
SET {update_set}
WHERE [event_source] = ? AND [event_id] = ?;
IF @@ROWCOUNT = 0
BEGIN
    INSERT INTO {table_name(result_table)} ({insert_columns})
    VALUES ({insert_values});
    SELECT CAST(1 AS INT) AS inserted;
END
ELSE
    SELECT CAST(0 AS INT) AS inserted;
"""

    cursor = conn.cursor()
    inserted = updated = 0
    try:
        for record in rows.to_dict(orient="records"):
            params = [*_clean_values(record.get(column) for column in mutable), record["event_source"], int(record["event_id"])]
            params.extend(_clean_values(record.get(column) for column in columns))
            cursor.execute(upsert_sql, params)
            result = cursor.fetchone()
            was_inserted = bool(result[0]) if result is not None else False
            inserted += int(was_inserted)
            updated += int(not was_inserted)

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

        run_sql = f"""
INSERT INTO {table_name(run_log_table)}
    (runtime_run_id, pipeline_name, started_time, ended_time, status,
     raw_candidate_count, context_count, canonical_count,
     l1_ready_count, l1_unready_count, l2_ready_count, l2_unready_count,
     policy_ready_count, inserted_count, updated_count,
     skipped_duplicate_count, failed_count, error_summary,
     model_lineage_hash, policy_version, sql_write_enabled)
VALUES (?, ?, ?, SYSUTCDATETIME(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""
        cursor.execute(
            run_sql,
            [
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
            ],
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        if hasattr(cursor, "close"):
            cursor.close()
    return {"inserted": inserted, "updated": updated, "skipped_duplicate": 0}


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
