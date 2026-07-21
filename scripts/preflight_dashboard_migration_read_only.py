"""Read-only SQL dashboard migration preflight. Never executes DDL or DML."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from inference.online.artifacts import load_config
from inference.online.db import connect


ONLINE = "dbo.ai_l2_fault_judgment_online_v2"
HISTORICAL = "dbo.ai_l2_fault_judgment_policy_v2_full"
CHECKPOINT = "dbo.ai_inference_checkpoint"
RUN_LOG = "dbo.ai_inference_run_log"
ERROR_LOG = "dbo.ai_inference_error_log"
ACTION_VALUES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
SIX_PROBABILITIES = (
    "risk_fault_10_events", "risk_fault_30_events", "risk_fault_30min",
    "risk_fault_60min", "risk_maintenance_30_events", "risk_repair_30_events",
)
HISTORICAL_VIEW_COLUMNS = (
    "event_id", "machine_id", "machine_group_id", "location_id", "event_start_time", "event_end_time",
    "status_id", "status_type_code", "current_signal_code", *SIX_PROBABILITIES,
    "operational_action_level", "operational_judgment", "operational_overall_risk_score",
    "quality_action_level", "quality_judgment", "quality_risk_score", "is_behavior_anomaly",
    "is_sensitive_warning", "behavior_anomaly_score", "behavior_sensitive_score", "behavior_combined_score",
    "data_quality_issue_flag", "energy_inconsistency_flag", "kwh_quality_issue_flag", "time_quality_issue_flag",
    "kwh_delta", "kwh_rate_per_hour", "kwh_available_flag", "kwh_missing_flag", "kwh_imputed_flag",
    "loaded_zero_kwh_flag", "loaded_without_kwh_flag", "duration_sec", "gap_from_prev_sec", "overlap_sec",
    "final_reason_v2", "l2_run_id", "policy_version",
)
# Historical production output intentionally does not retain all raw event
# telemetry.  The dashboard view may expose those fields as typed NULLs, but
# must never reference a column that was not exported by the historical run.
HISTORICAL_SOURCE_ALIASES = {
    "event_start_time": "source_event_start_time",
    "event_end_time": "source_event_end_time",
}
HISTORICAL_TYPED_NULL_FALLBACKS = {
    "machine_group_id", "location_id", "event_start_time", "event_end_time",
    "kwh_delta", "kwh_rate_per_hour", "kwh_available_flag", "kwh_missing_flag",
    "kwh_imputed_flag", "loaded_zero_kwh_flag", "loaded_without_kwh_flag",
    "duration_sec", "gap_from_prev_sec", "overlap_sec",
}
PROPOSED_INDEXES = {
    "machine_time": {"keys": [("machine_id", "ASC"), ("source_event_start_time", "DESC")], "include": []},
    "action_time": {"keys": [("operational_action_level", "ASC"), ("source_event_start_time", "DESC")], "include": []},
    "quality_time": {"keys": [("quality_action_level", "ASC"), ("source_event_start_time", "DESC")], "include": []},
    "location_time": {"keys": [("location_id", "ASC"), ("source_event_start_time", "DESC")], "include": []},
    "run_time": {"keys": [("runtime_run_id", "ASC"), ("scored_time", "DESC")], "include": []},
    "source_event": {"keys": [("event_source", "ASC"), ("event_id", "ASC")], "include": []},
    "event_uid": {"keys": [("event_uid", "ASC")], "include": []},
}


def _rows(cursor: Any, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    cursor.execute(sql, params)
    names = [description[0] for description in cursor.description]
    return [dict(zip(names, row, strict=True)) for row in cursor.fetchall()]


def _object_id(cursor: Any, name: str) -> int | None:
    return _rows(cursor, "SELECT OBJECT_ID(?) AS object_id", (name,))[0]["object_id"]


def _columns(cursor: Any, object_name: str) -> list[dict[str, Any]]:
    return _rows(cursor, """
SELECT c.column_id, c.name, t.name AS type_name, c.max_length, c.precision, c.scale, c.is_nullable,
       dc.definition AS default_definition, c.collation_name
FROM sys.columns c
JOIN sys.types t ON c.user_type_id=t.user_type_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id=dc.object_id
WHERE c.object_id=OBJECT_ID(?)
ORDER BY c.column_id
""", (object_name,))


def _constraints(cursor: Any, object_name: str) -> dict[str, Any]:
    return {
        "primary_and_unique": _rows(cursor, """
SELECT kc.name, kc.type_desc, i.name AS index_name,
       STRING_AGG(CONCAT(c.name, CASE WHEN ic.is_descending_key=1 THEN ' DESC' ELSE ' ASC' END), ', ')
           WITHIN GROUP (ORDER BY ic.key_ordinal) AS key_columns
FROM sys.key_constraints kc
JOIN sys.indexes i ON kc.parent_object_id=i.object_id AND kc.unique_index_id=i.index_id
JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id AND ic.key_ordinal>0
JOIN sys.columns c ON ic.object_id=c.object_id AND ic.column_id=c.column_id
WHERE kc.parent_object_id=OBJECT_ID(?)
GROUP BY kc.name,kc.type_desc,i.name
ORDER BY kc.type_desc,kc.name
""", (object_name,)),
        "check": _rows(cursor, "SELECT name, definition, is_disabled, is_not_trusted FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(?) ORDER BY name", (object_name,)),
        "foreign_keys": _rows(cursor, """
SELECT fk.name, OBJECT_SCHEMA_NAME(fk.referenced_object_id)+'.'+OBJECT_NAME(fk.referenced_object_id) AS referenced_object,
       fk.delete_referential_action_desc, fk.update_referential_action_desc, fk.is_disabled
FROM sys.foreign_keys fk WHERE fk.parent_object_id=OBJECT_ID(?) ORDER BY fk.name
""", (object_name,)),
    }


def _indexes(cursor: Any, object_name: str) -> list[dict[str, Any]]:
    rows = _rows(cursor, """
SELECT i.index_id,i.name,i.type_desc,i.is_unique,i.is_primary_key,i.is_unique_constraint,i.is_disabled,i.has_filter,i.filter_definition,
       ic.key_ordinal,ic.is_included_column,ic.is_descending_key,c.name AS column_name
FROM sys.indexes i
LEFT JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id
LEFT JOIN sys.columns c ON ic.object_id=c.object_id AND ic.column_id=c.column_id
WHERE i.object_id=OBJECT_ID(?) AND i.index_id>0
ORDER BY i.index_id,ic.is_included_column,ic.key_ordinal,ic.index_column_id
""", (object_name,))
    grouped: dict[int, dict[str, Any]] = {}
    for row in rows:
        index_id = int(row["index_id"])
        item = grouped.setdefault(index_id, {key: row[key] for key in ("index_id", "name", "type_desc", "is_unique", "is_primary_key", "is_unique_constraint", "is_disabled", "has_filter", "filter_definition")})
        item.setdefault("keys", [])
        item.setdefault("include", [])
        if row["column_name"] is not None:
            if row["is_included_column"]:
                item["include"].append(str(row["column_name"]))
            else:
                item["keys"].append({"column": str(row["column_name"]), "direction": "DESC" if row["is_descending_key"] else "ASC", "ordinal": row["key_ordinal"]})
    return list(grouped.values())


def _scalar(cursor: Any, sql: str) -> dict[str, Any]:
    return _rows(cursor, sql)[0]


def _has_column(columns: list[dict[str, Any]], name: str) -> bool:
    return name.lower() in {str(column["name"]).lower() for column in columns}


def _profile_online(cursor: Any, columns: list[dict[str, Any]]) -> dict[str, Any]:
    names = {str(item["name"]).lower() for item in columns}
    event_time = "source_event_start_time" if "source_event_start_time" in names else None
    score_columns = [name for name in ("score_lenient", "score_strict", *SIX_PROBABILITIES) if name in names]
    select = ["COUNT_BIG(*) AS total_rows", "MIN(event_id) AS min_event_id", "MAX(event_id) AS max_event_id", "SUM(CASE WHEN event_id IS NULL THEN 1 ELSE 0 END) AS null_event_id"]
    if event_time:
        select += [f"MIN({event_time}) AS min_event_time", f"MAX({event_time}) AS max_event_time"]
    select += [f"SUM(CASE WHEN {column} IS NULL THEN 1 ELSE 0 END) AS null_{column}" for column in score_columns]
    return _scalar(cursor, f"SELECT {', '.join(select)} FROM {ONLINE}")


def _duplicate_profile(cursor: Any, columns: list[dict[str, Any]]) -> dict[str, Any]:
    names = {str(item["name"]).lower() for item in columns}
    result = {
        "duplicate_event_id_group_count": _scalar(cursor, f"SELECT COUNT_BIG(*) AS value FROM (SELECT event_id FROM {ONLINE} WHERE event_id IS NOT NULL GROUP BY event_id HAVING COUNT_BIG(*)>1) d")["value"],
        "duplicate_event_id_extra_rows": _scalar(cursor, f"SELECT COALESCE(SUM(c-1),0) AS value FROM (SELECT COUNT_BIG(*) c FROM {ONLINE} WHERE event_id IS NOT NULL GROUP BY event_id HAVING COUNT_BIG(*)>1) d")["value"],
    }
    for name, group in (("source_event", ["event_source", "event_id"]), ("event_uid", ["event_uid"])):
        if all(column in names for column in group):
            rendered = ", ".join(group)
            result[f"duplicate_{name}_group_count"] = _scalar(cursor, f"SELECT COUNT_BIG(*) AS value FROM (SELECT {rendered} FROM {ONLINE} GROUP BY {rendered} HAVING COUNT_BIG(*)>1) d")["value"]
        else:
            result[f"duplicate_{name}_group_count"] = None
    return result


def _readiness(cursor: Any, table: str, columns: list[dict[str, Any]]) -> dict[str, Any]:
    names = {str(item["name"]).lower() for item in columns}
    l1_fields = [name for name in ("score_lenient", "score_strict", "behavior_anomaly_score", "behavior_combined_score") if name in names]
    probability_fields = [name for name in SIX_PROBABILITIES if name in names]
    select = ["COUNT_BIG(*) AS total_rows"]
    for field in l1_fields + probability_fields + ["operational_action_level", "l1_score_available_flag", "l2_ready_flag", "policy_ready_flag", "readiness_reason"]:
        if field in names:
            select.append(f"SUM(CASE WHEN {field} IS NULL THEN 1 ELSE 0 END) AS null_{field}")
    profile = _scalar(cursor, f"SELECT {', '.join(select)} FROM {table}")
    profile["l1_fields_available"] = l1_fields
    profile["six_probability_fields_available"] = probability_fields
    profile["six_probability_contract_complete"] = len(probability_fields) == 6
    for field in ("l1_score_available_flag", "l2_ready_flag", "policy_ready_flag"):
        if field in names:
            profile[f"{field}_distribution"] = _rows(
                cursor,
                f"SELECT CAST({field} AS INT) AS value, COUNT_BIG(*) AS row_count "
                f"FROM {table} GROUP BY CAST({field} AS INT) ORDER BY value",
            )
    return profile


def _historical_projection(columns: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_name = {str(item["name"]).lower(): item for item in columns}
    output: list[dict[str, Any]] = []
    for name in HISTORICAL_VIEW_COLUMNS:
        source_name = HISTORICAL_SOURCE_ALIASES.get(name, name)
        actual = by_name.get(source_name.lower())
        fallback = name in HISTORICAL_TYPED_NULL_FALLBACKS
        output.append({
            "view_output_column": name,
            "historical_source_column": source_name if actual else None,
            "actual_type": None if not actual else actual["type_name"],
            "available": actual is not None or fallback,
            "conversion_required": bool(actual and str(actual["type_name"]).lower() in {"varchar", "char", "nvarchar", "nchar"}),
            "fallback_policy": "DIRECT_CAST_IN_VIEW" if actual else "TYPED_NULL_HISTORICAL_NOT_EXPORTED" if fallback else "BLOCK_CREATE_VIEW",
        })
    return output


def _index_equivalence(indexes: list[dict[str, Any]], row_count: int | None) -> list[dict[str, Any]]:
    result = []
    for name, proposed in PROPOSED_INDEXES.items():
        exact = []
        prefix = []
        for existing in indexes:
            keys = [(str(key["column"]), str(key["direction"])) for key in existing.get("keys", [])]
            if keys == proposed["keys"]:
                exact.append(existing["name"])
            elif keys[:len(proposed["keys"])] == proposed["keys"] or proposed["keys"][:len(keys)] == keys:
                prefix.append(existing["name"])
        recommendation = "KEEP_EXISTING" if exact else "REVIEW_EXISTING_PREFIX" if prefix else "DO_NOT_CREATE_UNTIL_APPROVED"
        result.append({
            "logical_index": name, "proposed_keys": proposed["keys"], "existing_exact_equivalent": exact,
            "existing_prefix_or_subset": prefix, "recommendation": recommendation,
            "row_count_context": row_count, "reason": "Compare key order, direction, include columns, filter and workload before any CREATE INDEX.",
        })
    return result


def _json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only preflight for SQL dashboard migration.")
    parser.add_argument("--config", default="inference/online/config.local.yaml")
    parser.add_argument("--output-root", default="data/realtime_audit")
    args = parser.parse_args()
    output = Path(args.output_root) / f"sql_dashboard_migration_preflight_{datetime.now():%Y%m%d_%H%M%S}"
    output.mkdir(parents=True, exist_ok=False)
    cfg = load_config(args.config)
    database = dict(cfg["database"])
    database["read_only"] = True
    database.pop("password", None)
    failures: list[str] = []
    try:
        # Keep the credential in the in-memory loaded config only; never serialize it.
        runtime_database = dict(cfg["database"])
        runtime_database["read_only"] = True
        with connect(runtime_database) as conn:
            cursor = conn.cursor()
            environment = _scalar(cursor, """
SELECT DB_NAME() AS database_name, @@SERVERNAME AS server_name, @@VERSION AS sql_server_version,
       CAST(DATABASEPROPERTYEX(DB_NAME(),'CompatibilityLevel') AS INT) AS compatibility_level,
       SUSER_SNAME() AS current_login, ORIGINAL_LOGIN() AS original_login
""")
            targets = [ONLINE, HISTORICAL, CHECKPOINT, RUN_LOG, ERROR_LOG, "dbo.vw_ai_dashboard_events_source_aware_v2"]
            permissions = _rows(cursor, """
SELECT ? AS object_name, HAS_PERMS_BY_NAME(?, 'OBJECT', 'SELECT') AS can_select,
       HAS_PERMS_BY_NAME(?, 'OBJECT', 'ALTER') AS can_alter
""", (ONLINE, ONLINE, ONLINE))
            object_permissions = []
            for target in targets:
                object_permissions.extend(_rows(cursor, "SELECT ? AS object_name, HAS_PERMS_BY_NAME(?, 'OBJECT', 'SELECT') AS can_select, HAS_PERMS_BY_NAME(?, 'OBJECT', 'ALTER') AS can_alter", (target, target, target)))
            ddl_permissions = {
                "database_create_table": _scalar(cursor, "SELECT HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE TABLE') AS allowed")["allowed"],
                "database_create_view": _scalar(cursor, "SELECT HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE VIEW') AS allowed")["allowed"],
                "schema_alter": _scalar(cursor, "SELECT HAS_PERMS_BY_NAME('dbo', 'SCHEMA', 'ALTER') AS allowed")["allowed"],
                "schema_control": _scalar(cursor, "SELECT HAS_PERMS_BY_NAME('dbo', 'SCHEMA', 'CONTROL') AS allowed")["allowed"],
                "object_permissions": object_permissions,
                "ddl_attempted": False,
            }
            online_columns = _columns(cursor, ONLINE)
            historical_columns = _columns(cursor, HISTORICAL)
            checkpoint_columns = _columns(cursor, CHECKPOINT)
            run_log_columns = _columns(cursor, RUN_LOG)
            error_log_columns = _columns(cursor, ERROR_LOG)
            online_profile = _profile_online(cursor, online_columns)
            online_constraints = _constraints(cursor, ONLINE)
            online_indexes = _indexes(cursor, ONLINE)
            duplicate_profile = _duplicate_profile(cursor, online_columns)
            online_readiness = _readiness(cursor, ONLINE, online_columns)
            historical_readiness = _readiness(cursor, HISTORICAL, historical_columns)
            projection = _historical_projection(historical_columns)
            missing_projection = [row["view_output_column"] for row in projection if not row["available"]]
            if missing_projection:
                failures.append("HISTORICAL_VIEW_SOURCE_COLUMNS_MISSING")
            online_names = {str(item["name"]).lower() for item in online_columns}
            missing_online_contract = sorted({"event_source", "event_uid", "l2_ready_flag", "policy_ready_flag", "readiness_reason", "raw_source_fingerprint", "runtime_run_id"} - online_names)
            primary_keys = online_constraints["primary_and_unique"]
            event_uid_primary = any(
                row["type_desc"] == "PRIMARY_KEY_CONSTRAINT" and str(row["key_columns"]).lower() == "event_uid asc"
                for row in primary_keys
            )
            if missing_online_contract or not event_uid_primary:
                failures.append("ONLINE_SCHEMA_REQUIRES_DBA_MIGRATION")
            ready_fields = {str(item["name"]).lower() for item in historical_columns}
            if "l1_score_available_flag" in ready_fields or "l2_ready_flag" in ready_fields or "policy_ready_flag" in ready_fields:
                historical_conclusion = "HISTORICAL_READINESS_DERIVABLE"
            elif historical_readiness["six_probability_contract_complete"] and historical_readiness.get("null_operational_action_level") == 0:
                historical_conclusion = "HISTORICAL_TABLE_CONTAINS_ONLY_READY_ROWS"
            else:
                historical_conclusion = "HISTORICAL_READINESS_NOT_PROVABLE"
            historical_readiness["conclusion"] = historical_conclusion
            equivalent = _index_equivalence(online_indexes, int(online_profile["total_rows"] or 0))
            risk = {
                "online_row_count": online_profile["total_rows"],
                "duplicate_profile": duplicate_profile,
                "historical_missing_projection_columns": missing_projection,
                "missing_online_contract_columns": missing_online_contract,
                "event_uid_primary_key_present": event_uid_primary,
                "historical_readiness_conclusion": historical_conclusion,
                "migration_risks": [
                    "Existing online rows require deterministic source/event UID backfill before NOT NULL or unique constraints.",
                    "Do not set l2_ready_flag=1 for legacy rows without all six stored probabilities.",
                    "Create view only after every historical source column is verified or an explicit fallback is approved.",
                    "Existing index equivalence must be reviewed by key/include/filter, not index name.",
                ],
            }
            _json(output / "database_environment.json", environment)
            _json(output / "ddl_permissions.json", ddl_permissions)
            _json(output / "online_table_row_profile.json", online_profile)
            _json(output / "online_table_columns.json", online_columns)
            _json(output / "online_table_constraints.json", online_constraints)
            _json(output / "online_table_indexes.json", online_indexes)
            _json(output / "online_table_duplicate_profile.json", duplicate_profile)
            _json(output / "online_table_readiness_profile.json", online_readiness)
            _json(output / "run_log_columns.json", run_log_columns)
            _json(output / "checkpoint_columns.json", checkpoint_columns)
            _json(output / "error_log_columns.json", error_log_columns)
            _json(output / "historical_table_columns.json", historical_columns)
            _json(output / "historical_readiness_profile.json", historical_readiness)
            _json(output / "historical_view_projection_compatibility.json", projection)
            _json(output / "index_equivalence_report.json", equivalent)
            _json(output / "migration_risk_report.json", risk)
            summary = {
                "result": "PASS_READ_ONLY_PREFLIGHT" if not failures else "BLOCKED_SCHEMA_MISMATCH",
                "generated_at": datetime.now().isoformat(), "output_directory": str(output),
                "sql_writes": 0, "ddl_executed": False, "connection_application_intent": "ReadOnly",
                "failures": failures, "historical_readiness_conclusion": historical_conclusion,
            }
    except Exception as exc:
        summary = {"result": "TECHNICAL_FAILURE", "generated_at": datetime.now().isoformat(), "sql_writes": 0, "ddl_executed": False, "error_type": type(exc).__name__, "error": str(exc)}
    _json(output / "00_summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["result"] == "PASS_READ_ONLY_PREFLIGHT" else 2


if __name__ == "__main__":
    raise SystemExit(main())
