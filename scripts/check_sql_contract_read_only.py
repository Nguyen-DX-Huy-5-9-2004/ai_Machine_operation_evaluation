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


REQUIRED_OBJECTS = {
    "dbo.data_iot_convert": "U",
    "dbo.data_machine_status": "U",
    "dbo.data_machine": "U",
    "dbo.machine_location_his": "U",
    "dbo.data_location": "U",
    "dbo.ai_l1_operation_event_sequence": "U",
    "dbo.ai_l2_fault_confidence_event": "U",
    "dbo.ai_l2_fault_judgment_policy_v2_full": "U",
    "dbo.ai_l2_fault_judgment_online_v2": "U",
    "dbo.ai_inference_run_log": "U",
    "dbo.vw_ai_dashboard_events_source_aware_v2": "V",
}
REQUIRED_VIEW_COLUMNS = {"event_uid", "event_source", "dataset_mode", "event_id", "machine_id", "event_start_time"}
REQUIRED_ONLINE_COLUMNS = {"event_uid", "event_source", "event_id", "raw_source_fingerprint", "runtime_run_id"}
REQUIRED_INDEXES = {
    "UX_ai_online_source_event",
    "IX_ai_online_machine_time",
    "IX_ai_online_action_time",
    "IX_ai_online_quality_time",
    "IX_ai_online_location_time",
    "IX_ai_online_run",
}


def rows(cursor: Any, sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
    cursor.execute(sql, params or [])
    names = [item[0] for item in cursor.description]
    return [dict(zip(names, row, strict=True)) for row in cursor.fetchall()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only SQL object and permission contract audit.")
    parser.add_argument("--config", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    output = Path(args.output_dir).resolve()
    output.mkdir(parents=True, exist_ok=True)
    cfg = load_config(args.config)
    database_cfg = dict(cfg["database"])
    database_cfg["read_only"] = True
    connectivity: dict[str, Any] = {"result": "FAIL", "read_only_connection_requested": True, "sql_writes": 0}
    inventory: dict[str, Any] = {"objects": [], "indexes": []}
    missing: list[dict[str, Any]] = []
    try:
        with connect(database_cfg) as conn:
            cursor = conn.cursor()
            server = rows(cursor, "SELECT DB_NAME() database_name, @@SERVERNAME server_name, SUSER_SNAME() login_name, SYSDATETIME() server_time")[0]
            connectivity.update({"result": "PASS", **server})
            for name, expected_type in REQUIRED_OBJECTS.items():
                record = rows(
                    cursor,
                    "SELECT ? object_name, OBJECT_ID(?) object_id, COALESCE(o.type, '') object_type, HAS_PERMS_BY_NAME(?, 'OBJECT', 'SELECT') can_select, HAS_PERMS_BY_NAME(?, 'OBJECT', 'INSERT') can_insert FROM sys.objects o WHERE o.object_id = OBJECT_ID(?) UNION ALL SELECT ?, NULL, '', 0, 0 WHERE OBJECT_ID(?) IS NULL",
                    [name, name, name, name, name, name, name],
                )[0]
                record["object_type"] = str(record["object_type"]).strip()
                record["expected_type"] = expected_type
                record["available"] = record["object_id"] is not None and record["object_type"] == expected_type
                inventory["objects"].append(record)
                if not record["available"] or not bool(record["can_select"]):
                    missing.append({"object": name, "reason": "MISSING_OR_WRONG_TYPE" if not record["available"] else "SELECT_PERMISSION_MISSING"})

            columns = rows(cursor, "SELECT OBJECT_SCHEMA_NAME(object_id)+'.'+OBJECT_NAME(object_id) object_name, name column_name FROM sys.columns WHERE object_id IN (OBJECT_ID('dbo.vw_ai_dashboard_events_source_aware_v2'),OBJECT_ID('dbo.ai_l2_fault_judgment_online_v2'))")
            by_object: dict[str, set[str]] = {}
            for row in columns:
                by_object.setdefault(str(row["object_name"]), set()).add(str(row["column_name"]).lower())
            for object_name, required in [("dbo.vw_ai_dashboard_events_source_aware_v2", REQUIRED_VIEW_COLUMNS), ("dbo.ai_l2_fault_judgment_online_v2", REQUIRED_ONLINE_COLUMNS)]:
                absent = sorted(required - by_object.get(object_name, set()))
                inventory.setdefault("column_contract", []).append({"object": object_name, "required": sorted(required), "missing": absent, "result": "PASS" if not absent else "FAIL"})
                missing.extend({"object": object_name, "column": column, "reason": "REQUIRED_COLUMN_MISSING"} for column in absent)

            index_rows = rows(cursor, "SELECT name, is_unique, is_disabled FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.ai_l2_fault_judgment_online_v2') AND name IS NOT NULL")
            inventory["indexes"] = index_rows
            found_indexes = {str(row["name"]) for row in index_rows if not bool(row["is_disabled"])}
            for index_name in sorted(REQUIRED_INDEXES - found_indexes):
                missing.append({"object": "dbo.ai_l2_fault_judgment_online_v2", "index": index_name, "reason": "REQUIRED_INDEX_MISSING"})
    except Exception as exc:
        connectivity.update({"result": "FAIL", "error_type": type(exc).__name__, "error": str(exc)})
        missing.append({"object": "SQL_CONNECTION", "reason": type(exc).__name__})

    contract = {
        "result": "PASS" if connectivity["result"] == "PASS" and not missing else "FAIL",
        "generated_at": datetime.now().isoformat(),
        "read_only": True,
        "sql_writes": 0,
        "required_object_count": len(REQUIRED_OBJECTS),
        "missing_count": len(missing),
        "dba_scripts_if_missing": [
            "sql/01_create_realtime_inference_tables.sql",
            "sql/02_create_unified_dashboard_view.sql",
            "sql/04_recommended_dashboard_indexes.sql",
            "sql/03_verify_dashboard_contract.sql",
        ] if missing else [],
    }
    for name, payload in [
        ("sql_connectivity.json", connectivity),
        ("sql_object_inventory.json", inventory),
        ("missing_sql_objects.json", {"items": missing}),
        ("sql_contract_validation.json", contract),
    ]:
        (output / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(json.dumps(contract, ensure_ascii=False, indent=2))
    return 0 if contract["result"] == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
