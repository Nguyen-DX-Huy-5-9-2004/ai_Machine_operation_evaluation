from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.app.config import get_settings
from backend.app.db import fetch_all, get_connection


OBJECTS = [
    "dbo.vw_ai_dashboard_events_source_aware_v2", "dbo.ai_l2_fault_judgment_policy_v2_full",
    "dbo.ai_l2_fault_judgment_online_v2", "dbo.ai_inference_run_log", "dbo.data_iot_convert",
    "dbo.data_machine", "dbo.data_machine_status", "dbo.machine_location_his", "dbo.data_location",
    "dbo.data_machine_repair", "dbo.data_machine_issue", "dbo.data_machine_maintenance_his",
    "dbo.data_maintenance", "dbo.data_error", "dbo.data_error_group", "dbo.data_machine_component",
    "dbo.data_machine_group", "dbo.data_cabinetglobal_kwh", "dbo.data_cabinetglobal_kwh_daily",
    "dbo.data_electric_cabinetglobal", "dbo.data_electric_cabinet",
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    settings = get_settings()
    records: list[dict[str, Any]] = []
    with get_connection(settings) as conn:
        for name in OBJECTS:
            rows = fetch_all(conn, """
SELECT o.object_id, o.type_desc,
       COALESCE((SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id=o.object_id AND p.index_id IN (0,1)), 0) row_estimate
FROM sys.objects o WHERE o.object_id=OBJECT_ID(?)
""", [name], timeout_seconds=30)
            if not rows:
                records.append({"objectName": name, "available": False, "objectType": None, "rowCountEstimate": None, "columns": [], "primaryOrUniqueKeys": []})
                continue
            object_id = int(rows[0]["object_id"])
            columns = fetch_all(conn, """
SELECT c.name, t.name type_name, c.max_length, c.precision, c.scale, c.is_nullable
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=? ORDER BY c.column_id
""", [object_id], timeout_seconds=30)
            keys = fetch_all(conn, """
SELECT i.name, i.is_primary_key, i.is_unique,
       STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) columns
FROM sys.indexes i JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id
JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
WHERE i.object_id=? AND (i.is_primary_key=1 OR i.is_unique=1) AND ic.key_ordinal>0
GROUP BY i.name,i.is_primary_key,i.is_unique
""", [object_id], timeout_seconds=30)
            column_names = {str(row["name"]) for row in columns}
            records.append({
                "objectName": name, "objectType": rows[0]["type_desc"], "available": True,
                "rowCountEstimate": int(rows[0]["row_estimate"] or 0), "columns": columns,
                "primaryOrUniqueKeys": keys,
                "useCase": "dashboard fact" if "dashboard_events" in name else "master/enrichment or runtime contract",
                "joinKeys": [key for key in ("event_id", "machine_id", "location_id") if key in column_names],
                "temporalJoinRequired": name.endswith("machine_location_his"),
                "allowedForMachineLevel": not any(token in name for token in ("cabinetglobal", "electric_cabinet")),
                "notes": "Cabinet energy is not assigned to a machine without a validated bridge." if "cabinet" in name else None,
            })
    payload = {"generatedAt": datetime.now(timezone.utc).isoformat(), "readOnly": True, "sqlWrites": 0, "objects": records}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    print(json.dumps({"result": "PASS", "available": sum(bool(row["available"]) for row in records), "total": len(records)}))


if __name__ == "__main__":
    main()
