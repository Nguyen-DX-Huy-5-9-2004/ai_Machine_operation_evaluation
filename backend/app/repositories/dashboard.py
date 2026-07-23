from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Protocol

from backend.app.config import Settings, get_settings
from backend.app.db import fetch_all, fetch_one, get_connection
from inference.online.runtime_contract import DatasetMode, EventSource
from inference.online.sql_queries import table_name


ACTION_LEVELS = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
QUALITY_LEVELS = ("QUALITY_OK", "CHECK_DATA_DETAIL", "CHECK_DATA", "CHECK_ENERGY", "CHECK_DATA_AND_ENERGY")


@dataclass(frozen=True)
class QueryFilters:
    dataset_mode: DatasetMode = DatasetMode.HISTORICAL
    date_from: datetime | None = None
    date_to: datetime | None = None
    machine_ids: tuple[int, ...] = ()
    location_ids: tuple[int, ...] = ()
    machine_group_ids: tuple[int, ...] = ()
    operational_action_levels: tuple[str, ...] = ()
    quality_action_levels: tuple[str, ...] = ()
    status_ids: tuple[int, ...] = ()

    def validate(self, settings: Settings) -> None:
        if self.date_from and self.date_to:
            if self.date_from > self.date_to:
                raise ValueError("from must be before or equal to to")
            if self.date_to - self.date_from > timedelta(days=settings.max_date_range_days):
                raise ValueError(f"date range exceeds {settings.max_date_range_days} days")
        invalid_actions = set(self.operational_action_levels) - set(ACTION_LEVELS)
        if invalid_actions:
            raise ValueError(f"invalid operational action levels: {sorted(invalid_actions)}")
        invalid_quality = set(self.quality_action_levels) - set(QUALITY_LEVELS)
        if invalid_quality:
            raise ValueError(f"invalid quality action levels: {sorted(invalid_quality)}")


class DashboardRepository(Protocol):
    data_mode: str

    def health(self) -> dict[str, Any]: ...
    def filters(self, filters: QueryFilters) -> dict[str, Any]: ...
    def overview(self, filters: QueryFilters) -> dict[str, Any]: ...
    def risk_distribution(self, filters: QueryFilters) -> list[dict[str, Any]]: ...
    def risk_trend(self, filters: QueryFilters, grain: str) -> list[dict[str, Any]]: ...
    def top_machines(self, filters: QueryFilters, sort_by: str, limit: int) -> list[dict[str, Any]]: ...
    def l1_status(self, filters: QueryFilters) -> dict[str, Any]: ...
    def l2_confidence(self, filters: QueryFilters) -> dict[str, Any]: ...
    def quality_trend(self, filters: QueryFilters, grain: str) -> list[dict[str, Any]]: ...
    def data_quality_overview(self, filters: QueryFilters) -> dict[str, Any]: ...
    def alerts(self, filters: QueryFilters, page: int, page_size: int, sort: str, search: str | None = None) -> dict[str, Any]: ...
    def machines(self, filters: QueryFilters, page: int, page_size: int, sort: str) -> dict[str, Any]: ...
    def machine_summary(self, machine_id: int, filters: QueryFilters) -> dict[str, Any] | None: ...
    def machine_series(self, machine_id: int, filters: QueryFilters, series: str, limit: int) -> list[dict[str, Any]]: ...
    def machine_performance(self, machine_id: int, filters: QueryFilters) -> dict[str, Any]: ...
    def machine_energy(self, machine_id: int, filters: QueryFilters) -> dict[str, Any]: ...
    def runtime_runs(self, page: int, page_size: int) -> dict[str, Any]: ...
    def event_by_uid(self, event_uid: str) -> dict[str, Any] | None: ...


class SqlDashboardRepository:
    data_mode = "sql"

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.view = table_name(self.settings.dashboard_view)
        self.l2_thresholds = self._load_l2_thresholds()

    def _load_l2_thresholds(self) -> dict[str, float]:
        path = self.settings.l2_production_selection_path
        if not path.exists():
            raise RuntimeError(f"L2 production selection is unavailable: {path}")
        payload = json.loads(path.read_text(encoding="utf-8"))
        return {str(row["target"]): float(row["valid_threshold"]) for row in payload.get("targets", [])}

    def _all(self, sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
        with get_connection(self.settings) as conn:
            return fetch_all(conn, sql, params or [], timeout_seconds=self.settings.query_timeout_seconds)

    def _one(self, sql: str, params: list[Any] | None = None) -> dict[str, Any] | None:
        with get_connection(self.settings) as conn:
            return fetch_one(conn, sql, params or [], timeout_seconds=self.settings.query_timeout_seconds)

    def health(self) -> dict[str, Any]:
        required = [
            self.settings.dashboard_view,
            self.settings.historical_table,
            self.settings.current_table,
            "dbo.ai_inference_run_log",
        ]
        sql = "SELECT ? AS [objectName], CASE WHEN OBJECT_ID(?) IS NULL THEN 0 ELSE 1 END AS [available]"
        objects: list[dict[str, Any]] = []
        with get_connection(self.settings) as conn:
            fetch_one(conn, "SELECT 1 AS ok", timeout_seconds=self.settings.query_timeout_seconds)
            for name in required:
                objects.extend(fetch_all(conn, sql, [name, name], timeout_seconds=self.settings.query_timeout_seconds))
        return {"sqlConnectivity": True, "objects": objects, "ready": all(bool(row["available"]) for row in objects)}

    def filters(self, filters: QueryFilters) -> dict[str, Any]:
        where, params = self._where(filters)
        machines = self._all(
            f"SELECT DISTINCT TOP (1000) machine_id AS [machineId], {self._machine_display('machine_id')} AS [displayName] FROM {self.view} e {where} ORDER BY machine_id",
            params,
        )
        locations = self._all(
            f"SELECT DISTINCT TOP (1000) location_id AS [locationId] FROM {self.view} e {where} AND location_id IS NOT NULL ORDER BY location_id",
            params,
        )
        groups = self._all(
            f"SELECT DISTINCT TOP (1000) machine_group_id AS [machineGroupId] FROM {self.view} e {where} AND machine_group_id IS NOT NULL ORDER BY machine_group_id",
            params,
        )
        date_range = self._one(f"SELECT MIN(event_start_time) AS [from], MAX(event_start_time) AS [to] FROM {self.view} e {where}", params) or {}
        return {
            "machines": machines,
            "locations": locations,
            "machineGroups": groups,
            "statuses": self._all(f"SELECT DISTINCT status_id AS [statusId] FROM {self.view} e {where} ORDER BY status_id", params),
            "operationalActionLevels": list(ACTION_LEVELS),
            "qualityActionLevels": list(QUALITY_LEVELS),
            "datasetModes": [mode.value for mode in DatasetMode],
            "availableDateRange": date_range,
        }

    def overview(self, filters: QueryFilters) -> dict[str, Any]:
        where, params = self._where(filters)
        sql = f"""
WITH filtered AS (
    SELECT e.*, ROW_NUMBER() OVER (PARTITION BY machine_id ORDER BY event_start_time DESC, event_id DESC) AS rn
    FROM {self.view} e {where}
), latest AS (SELECT * FROM filtered WHERE rn = 1 AND policy_ready_flag = 1)
SELECT
    AVG(CAST(operational_overall_risk_score AS FLOAT)) AS [operationalRiskScore],
    COUNT_BIG(*) AS [activeMachines],
    SUM(CASE WHEN operational_action_level IN (N'HIGH', N'CRITICAL') THEN 1 ELSE 0 END) AS [criticalHighAlertMachines],
    SUM(CASE WHEN risk_maintenance_30_events >= ? THEN 1 ELSE 0 END) AS [maintenanceRiskMachines],
    SUM(CASE WHEN risk_repair_30_events >= ? THEN 1 ELSE 0 END) AS [repairRiskMachines]
FROM latest
"""
        latest = self._one(sql, [*params, self.l2_thresholds["future_maintenance_within_30_events"], self.l2_thresholds["future_repair_within_30_events"]]) or {}
        event_counts = self._one(
            f"""SELECT
                SUM(CASE WHEN operational_action_level IN (N'HIGH', N'CRITICAL') AND policy_ready_flag = 1 THEN 1 ELSE 0 END) AS [criticalHighAlertEvents],
                SUM(CASE WHEN data_quality_issue_flag = 1 THEN 1 ELSE 0 END) AS [dataQualityIssueEvents],
                COUNT(DISTINCT CASE WHEN data_quality_issue_flag = 1 THEN machine_id END) AS [dataQualityIssueMachines]
            FROM {self.view} e {where}""",
            params,
        ) or {}
        known = self._one("SELECT COUNT_BIG(*) AS [knownMachines] FROM dbo.data_machine WHERE ISNULL(is_deleted, 0) = 0")
        return {**latest, **event_counts, "knownMachines": (known or {}).get("knownMachines"), "deltasAvailable": False}

    def risk_distribution(self, filters: QueryFilters) -> list[dict[str, Any]]:
        where, params = self._where(filters)
        return self._all(
            f"""WITH ranked AS (
                SELECT operational_action_level, policy_ready_flag,
                       ROW_NUMBER() OVER (PARTITION BY machine_id ORDER BY event_start_time DESC, event_id DESC) rn
                FROM {self.view} e {where})
            SELECT CASE WHEN policy_ready_flag = 0 THEN N'UNREADY' ELSE operational_action_level END AS [level], COUNT_BIG(*) AS [count]
            FROM ranked WHERE rn = 1
            GROUP BY CASE WHEN policy_ready_flag = 0 THEN N'UNREADY' ELSE operational_action_level END""",
            params,
        )

    def risk_trend(self, filters: QueryFilters, grain: str) -> list[dict[str, Any]]:
        bucket = self._time_bucket(grain)
        where, params = self._where(filters)
        return self._all(
            f"""SELECT {bucket} AS [timestamp],
                AVG(CAST(operational_overall_risk_score AS FLOAT)) AS [avgRisk],
                MAX(CAST(operational_overall_risk_score AS FLOAT)) AS [maxRisk],
                SUM(CASE WHEN operational_action_level=N'CRITICAL' THEN 1 ELSE 0 END) AS [criticalEventCount],
                SUM(CASE WHEN operational_action_level=N'HIGH' THEN 1 ELSE 0 END) AS [highEventCount],
                SUM(CASE WHEN operational_action_level=N'MEDIUM' THEN 1 ELSE 0 END) AS [mediumEventCount],
                SUM(CASE WHEN operational_action_level=N'LOW' THEN 1 ELSE 0 END) AS [lowEventCount]
            FROM {self.view} e {where} AND policy_ready_flag=1
            GROUP BY {bucket} ORDER BY {bucket}""",
            params,
        )

    def top_machines(self, filters: QueryFilters, sort_by: str, limit: int) -> list[dict[str, Any]]:
        sort_map = {
            "currentRisk": "latestRisk DESC",
            "criticalCount": "criticalCount DESC",
            "maintenanceRisk": "maintenanceRisk DESC",
            "repairRisk": "repairRisk DESC",
            "qualityIssues": "qualityIssueCount DESC",
        }
        order = sort_map.get(sort_by)
        if not order:
            raise ValueError("invalid top machine sort")
        where, params = self._where(filters)
        return self._all(
            f"""WITH f AS (
                SELECT e.*, ROW_NUMBER() OVER (PARTITION BY machine_id ORDER BY event_start_time DESC, event_id DESC) rn
                FROM {self.view} e {where}), a AS (
                SELECT machine_id,
                    MAX(CASE WHEN rn=1 THEN operational_overall_risk_score END) latestRisk,
                    MAX(CASE WHEN rn=1 THEN operational_action_level END) latestAction,
                    MAX(CASE WHEN rn=1 THEN risk_maintenance_30_events END) maintenanceRisk,
                    MAX(CASE WHEN rn=1 THEN risk_repair_30_events END) repairRisk,
                    MAX(CASE WHEN rn=1 THEN event_start_time END) latestEventTime,
                    SUM(CASE WHEN operational_action_level=N'CRITICAL' THEN 1 ELSE 0 END) criticalCount,
                    SUM(CASE WHEN operational_action_level=N'HIGH' THEN 1 ELSE 0 END) highCount,
                    SUM(CASE WHEN data_quality_issue_flag=1 THEN 1 ELSE 0 END) qualityIssueCount
                FROM f GROUP BY machine_id)
            SELECT TOP ({int(limit)}) machine_id AS [machineId], {self._machine_display('machine_id')} AS [displayCode],
                latestRisk, latestAction, criticalCount, highCount, maintenanceRisk, repairRisk, qualityIssueCount, latestEventTime
            FROM a ORDER BY {order}, machine_id""",
            params,
        )

    def l1_status(self, filters: QueryFilters) -> dict[str, Any]:
        where, params = self._where(filters)
        return self._one(
            f"""SELECT COUNT_BIG(*) AS [eligibleCount],
                SUM(CASE WHEN l1_score_available_flag=1 AND is_behavior_anomaly=0 THEN 1 ELSE 0 END) AS [normalCount],
                SUM(CASE WHEN l1_score_available_flag=1 AND is_behavior_anomaly=1 THEN 1 ELSE 0 END) AS [anomalyCount],
                SUM(CASE WHEN l1_score_available_flag=1 AND is_sensitive_warning=1 THEN 1 ELSE 0 END) AS [sensitiveOnlyCount],
                SUM(CASE WHEN l1_score_available_flag=0 THEN 1 ELSE 0 END) AS [unreadyCount]
            FROM {self.view} e {where}""",
            params,
        ) or {}

    def l2_confidence(self, filters: QueryFilters) -> dict[str, Any]:
        where, params = self._where(filters)
        return self._one(
            f"""WITH ready_l2 AS (
                SELECT (SELECT MAX(v) FROM (VALUES
                    (risk_fault_10_events),(risk_fault_30_events),(risk_fault_30min),
                    (risk_fault_60min),(risk_maintenance_30_events),(risk_repair_30_events)
                ) x(v)) AS dominant_risk
                FROM {self.view} e {where} AND l2_ready_flag=1
            )
            SELECT COUNT_BIG(*) AS [readyCount],
                AVG(CAST(dominant_risk AS FLOAT)) AS [averageDominantRisk],
                MAX(dominant_risk) AS [maxOperationalRisk]
            FROM ready_l2""",
            params,
        ) or {}

    def quality_trend(self, filters: QueryFilters, grain: str) -> list[dict[str, Any]]:
        bucket = self._time_bucket(grain)
        where, params = self._where(filters)
        return self._all(
            f"""SELECT {bucket} AS [timestamp],
                SUM(CASE WHEN quality_action_level=N'QUALITY_OK' THEN 1 ELSE 0 END) [qualityOk],
                SUM(CASE WHEN quality_action_level=N'CHECK_DATA' THEN 1 ELSE 0 END) [checkData],
                SUM(CASE WHEN quality_action_level=N'CHECK_ENERGY' THEN 1 ELSE 0 END) [checkEnergy],
                SUM(CASE WHEN quality_action_level=N'CHECK_DATA_AND_ENERGY' THEN 1 ELSE 0 END) [checkDataAndEnergy],
                SUM(CASE WHEN time_quality_issue_flag=1 THEN 1 ELSE 0 END) [timeIssueCount],
                SUM(CASE WHEN kwh_quality_issue_flag=1 THEN 1 ELSE 0 END) [kwhIssueCount],
                SUM(CASE WHEN energy_inconsistency_flag=1 THEN 1 ELSE 0 END) [energyInconsistencyCount],
                SUM(CASE WHEN kwh_missing_flag=1 THEN 1 ELSE 0 END) [missingKwhCount]
            FROM {self.view} e {where} GROUP BY {bucket} ORDER BY {bucket}""",
            params,
        )

    def data_quality_overview(self, filters: QueryFilters) -> dict[str, Any]:
        where, params = self._where(filters)
        return self._one(
            f"""SELECT COUNT_BIG(*) AS [eligibleEvents],
                AVG(CAST(l1_score_available_flag AS FLOAT)) AS [l1WindowReadyRate],
                AVG(CAST(l2_ready_flag AS FLOAT)) AS [l2ReadyRate],
                AVG(CAST(COALESCE(kwh_missing_flag,0) AS FLOAT)) AS [missingKwhRate],
                AVG(CAST(COALESCE(time_quality_issue_flag,0) AS FLOAT)) AS [timeQualityIssueRate],
                AVG(CAST(COALESCE(kwh_quality_issue_flag,0) AS FLOAT)) AS [kwhQualityIssueRate],
                DATEDIFF(SECOND, MAX(event_start_time), SYSDATETIME()) AS [sourceFreshnessSeconds]
            FROM {self.view} e {where}""",
            params,
        ) or {}

    def alerts(self, filters: QueryFilters, page: int, page_size: int, sort: str, search: str | None = None) -> dict[str, Any]:
        sort_map = {"eventTime:desc": "event_start_time DESC, event_id DESC", "risk:desc": "operational_overall_risk_score DESC, event_start_time DESC"}
        order = sort_map.get(sort, sort_map["eventTime:desc"])
        where, params = self._where(filters)
        if search:
            where += " AND (CONVERT(NVARCHAR(30), e.machine_id) LIKE ? OR e.final_reason_v2 LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])
        return self._paged_events(where + " AND e.operational_action_level IN (N'HIGH',N'CRITICAL') AND e.policy_ready_flag=1", params, page, page_size, order)

    def machines(self, filters: QueryFilters, page: int, page_size: int, sort: str) -> dict[str, Any]:
        where, params = self._where(filters)
        order = "latestEventTime DESC, machineId" if sort == "latest" else "currentRisk DESC, machineId"
        offset = (page - 1) * page_size
        sql = f"""WITH f AS (
            SELECT e.*, ROW_NUMBER() OVER (PARTITION BY machine_id ORDER BY event_start_time DESC, event_id DESC) rn
            FROM {self.view} e {where}), latest AS (SELECT * FROM f WHERE rn=1)
        SELECT machine_id [machineId], {self._machine_display('machine_id')} [displayCode], location_id [locationId], machine_group_id [machineGroupId],
            status_id [latestStatusId], event_start_time [latestEventTime], operational_overall_risk_score [currentRisk],
            operational_action_level [currentAction], is_behavior_anomaly [behaviorAnomaly], risk_fault_30min [faultRisk30min],
            risk_maintenance_30_events [maintenanceRisk], risk_repair_30_events [repairRisk], quality_action_level [dataQuality],
            energy_inconsistency_flag [energyConsistencyIssue], readiness_reason [readiness], event_source [source], COUNT_BIG(*) OVER() [totalRows]
        FROM latest ORDER BY {order} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"""
        rows = self._all(sql, [*params, offset, page_size])
        total = int(rows[0].pop("totalRows")) if rows else 0
        for row in rows[1:]:
            row.pop("totalRows", None)
        return {"items": rows, "page": page, "pageSize": page_size, "total": total}

    def machine_summary(self, machine_id: int, filters: QueryFilters) -> dict[str, Any] | None:
        # The unified source-aware view joins the historical policy and L2
        # tables.  A broad TOP(1) projection can make SQL Server choose a full
        # join/sort plan even for one machine.  Each narrow series projection is
        # already proven to use the machine/time path, so compose the latest
        # summary from the same event-scoped fields instead.
        latest: dict[str, Any] = {}
        for series in ("timeline", "events", "l1", "l2"):
            rows = self.machine_series(machine_id, filters, series, 1)
            if rows:
                latest.update(rows[0])
        return latest or None

    def machine_series(self, machine_id: int, filters: QueryFilters, series: str, limit: int) -> list[dict[str, Any]]:
        fields = {
            "timeline": "event_uid,event_id,event_start_time,event_end_time,duration_sec,gap_from_prev_sec,overlap_sec,status_id,operational_action_level,is_behavior_anomaly,is_sensitive_warning,data_quality_issue_flag,energy_inconsistency_flag,risk_maintenance_30_events,risk_repair_30_events,readiness_reason",
            "l1": "event_uid,event_start_time,behavior_anomaly_score,behavior_sensitive_score,behavior_combined_score,is_behavior_anomaly,is_sensitive_warning,l1_score_available_flag,readiness_reason",
            "l2": "event_uid,event_start_time,risk_fault_10_events,risk_fault_30_events,risk_fault_30min,risk_fault_60min,risk_maintenance_30_events,risk_repair_30_events,operational_action_level,operational_judgment,operational_overall_risk_score,policy_ready_flag,l2_ready_flag,readiness_reason",
            "kwh": "event_uid,event_start_time,kwh_delta,kwh_delta_model_value,kwh_rate_per_hour,kwh_available_flag,kwh_missing_flag,kwh_imputed_flag,loaded_zero_kwh_flag,loaded_without_kwh_flag,energy_inconsistency_flag",
            "events": "event_uid,event_source,event_id,event_start_time,status_id,duration_sec,gap_from_prev_sec,overlap_sec,kwh_delta,kwh_delta_model_value,operational_action_level,is_behavior_anomaly,quality_action_level,quality_judgment,data_quality_issue_flag,final_reason_v2,readiness_reason",
            "maintenance": "event_uid,event_start_time,risk_maintenance_30_events,risk_repair_30_events,operational_action_level,final_reason_v2,readiness_reason",
        }
        selected = fields.get(series)
        if not selected:
            raise ValueError("invalid machine series")
        where, params = self._where(_with_machine(filters, machine_id))
        return self._all(f"SELECT TOP ({int(limit)}) {selected} FROM {self.view} e {where} ORDER BY event_start_time DESC,event_id DESC", params)

    def machine_performance(self, machine_id: int, filters: QueryFilters) -> dict[str, Any]:
        where, params = self._where(_with_machine(filters, machine_id))
        return self._one(
            f"""SELECT COUNT_BIG(*) eventCount, AVG(duration_sec) averageEventDuration,
                SUM(CASE WHEN status_id IN (3,5,7) THEN duration_sec ELSE 0 END) loadedDuration,
                SUM(CASE WHEN status_id IN (2,4,6) THEN duration_sec ELSE 0 END) noLoadDuration,
                SUM(CASE WHEN status_id IN (8,9,10) THEN duration_sec ELSE 0 END) offDuration,
                SUM(CASE WHEN gap_from_prev_sec>3600 THEN 1 ELSE 0 END) bigGapCount,
                SUM(CASE WHEN duration_sec<=0 OR duration_sec>86400 THEN 1 ELSE 0 END) abnormalDurationCount
            FROM {self.view} e {where}""",
            params,
        ) or {}

    def machine_energy(self, machine_id: int, filters: QueryFilters) -> dict[str, Any]:
        where, params = self._where(_with_machine(filters, machine_id))
        return self._one(
            f"""SELECT COUNT_BIG(*) eventCount, AVG(CAST(kwh_available_flag AS FLOAT)) kwhAvailabilityRate,
                AVG(CAST(kwh_imputed_flag AS FLOAT)) kwhImputedRate, AVG(CAST(kwh_missing_flag AS FLOAT)) kwhMissingRate,
                SUM(kwh_delta) totalKwhDelta, AVG(kwh_rate_per_hour) averageKwhRate,
                SUM(CASE WHEN kwh_delta>0 THEN 1 ELSE 0 END) positiveCount,
                SUM(CASE WHEN kwh_delta=0 THEN 1 ELSE 0 END) zeroCount,
                SUM(CASE WHEN kwh_delta<0 THEN 1 ELSE 0 END) negativeCount,
                SUM(CASE WHEN loaded_zero_kwh_flag=1 THEN 1 ELSE 0 END) loadedZeroKwhCount,
                SUM(CASE WHEN loaded_without_kwh_flag=1 THEN 1 ELSE 0 END) loadedWithoutKwhCount,
                SUM(CASE WHEN energy_inconsistency_flag=1 THEN 1 ELSE 0 END) energyInconsistencyCount
            FROM {self.view} e {where}""",
            params,
        ) or {}

    def runtime_runs(self, page: int, page_size: int) -> dict[str, Any]:
        offset = (page - 1) * page_size
        table = table_name("dbo.ai_inference_run_log")
        rows = self._all(
            f"SELECT *, COUNT_BIG(*) OVER() totalRows FROM {table} ORDER BY started_time DESC, run_log_id DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            [offset, page_size],
        )
        total = int(rows[0].pop("totalRows")) if rows else 0
        for row in rows[1:]:
            row.pop("totalRows", None)
        return {"items": rows, "page": page, "pageSize": page_size, "total": total}

    def event_by_uid(self, event_uid: str) -> dict[str, Any] | None:
        if not event_uid.startswith((EventSource.HISTORICAL.value + ":", EventSource.CURRENT.value + ":")):
            raise ValueError("eventUid must contain a supported source namespace")
        return self._one(f"SELECT TOP (1) * FROM {self.view} WHERE event_uid = ?", [event_uid])

    def _paged_events(self, where: str, params: list[Any], page: int, page_size: int, order: str) -> dict[str, Any]:
        offset = (page - 1) * page_size
        columns = f"event_uid [eventUid],event_source [eventSource],event_id [eventId],machine_id [machineId],{self._machine_display('machine_id')} [displayCode],location_id [locationId],status_id [statusId],event_start_time [eventTime],operational_action_level [operationalActionLevel],operational_judgment [operationalJudgment],operational_overall_risk_score [operationalRisk],risk_fault_30min [faultRisk30min],risk_maintenance_30_events [maintenanceRisk],risk_repair_30_events [repairRisk],quality_action_level [qualityActionLevel],quality_judgment [qualityJudgment],is_behavior_anomaly [isBehaviorAnomaly],is_sensitive_warning [isSensitiveWarning],behavior_anomaly_score [l1Score],final_reason_v2 [finalReason],readiness_reason [readiness]"
        rows = self._all(
            f"SELECT {columns},COUNT_BIG(*) OVER() totalRows FROM {self.view} e {where} ORDER BY {order} OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
            [*params, offset, page_size],
        )
        total = int(rows[0].pop("totalRows")) if rows else 0
        for row in rows[1:]:
            row.pop("totalRows", None)
        return {"items": rows, "page": page, "pageSize": page_size, "total": total}

    def _where(self, filters: QueryFilters) -> tuple[str, list[Any]]:
        filters.validate(self.settings)
        clauses = ["e.dataset_mode = ?"]
        params: list[Any] = [filters.dataset_mode.value]
        pairs = [
            ("event_start_time >= ?", filters.date_from),
            ("event_start_time <= ?", filters.date_to),
        ]
        for clause, value in pairs:
            if value is not None:
                clauses.append(clause)
                params.append(value)
        for column, values in [
            ("machine_id", filters.machine_ids),
            ("location_id", filters.location_ids),
            ("machine_group_id", filters.machine_group_ids),
            ("operational_action_level", filters.operational_action_levels),
            ("quality_action_level", filters.quality_action_levels),
            ("status_id", filters.status_ids),
        ]:
            if values:
                clauses.append(f"e.{column} IN ({','.join('?' for _ in values)})")
                params.extend(values)
        return "WHERE " + " AND ".join(clauses), params

    @staticmethod
    def _time_bucket(grain: str) -> str:
        options = {
            "hour": "DATEADD(HOUR,DATEDIFF(HOUR,0,event_start_time),0)",
            "day": "CAST(event_start_time AS DATE)",
            "week": "DATEADD(WEEK,DATEDIFF(WEEK,0,event_start_time),0)",
        }
        if grain not in options:
            raise ValueError("grain must be hour, day or week")
        return options[grain]

    @staticmethod
    def _machine_display(machine_column: str) -> str:
        """Prefer real operational names/codes; retain an explicit ID fallback."""
        return (
            "COALESCE(NULLIF((SELECT TOP (1) m.machine_call_name FROM dbo.data_machine m "
            f"WHERE m.id={machine_column} AND ISNULL(m.is_deleted,0)=0),N''),"
            "NULLIF((SELECT TOP (1) m.machine_name FROM dbo.data_machine m "
            f"WHERE m.id={machine_column} AND ISNULL(m.is_deleted,0)=0),N''),"
            "NULLIF((SELECT TOP (1) m.asset_code FROM dbo.data_machine m "
            f"WHERE m.id={machine_column} AND ISNULL(m.is_deleted,0)=0),N''),"
            f"CONCAT(N'Machine ',{machine_column}))"
        )


class MockDashboardRepository:
    data_mode = "mock"

    def __init__(self) -> None:
        now = datetime.now()
        self._events = [
            {
                "eventUid": f"{EventSource.CURRENT.value}:{index}",
                "eventSource": EventSource.CURRENT.value,
                "eventId": index,
                "machineId": 11 + index % 3,
                "displayCode": f"Machine {11 + index % 3}",
                "eventTime": now - timedelta(minutes=index),
                "operationalActionLevel": ACTION_LEVELS[index % 4],
                "operationalRisk": index / 20,
                "faultRisk30min": index / 25,
                "qualityActionLevel": "QUALITY_OK",
                "isBehaviorAnomaly": False,
                "isSensitiveWarning": False,
                "readiness": "READY",
            }
            for index in range(1, 21)
        ]

    def _events_for(self, filters: QueryFilters) -> list[dict[str, Any]]:
        source = EventSource.HISTORICAL if filters.dataset_mode == DatasetMode.HISTORICAL else EventSource.CURRENT
        return [{**row, "eventUid": f"{source.value}:{row['eventId']}", "eventSource": source.value} for row in self._events]

    def health(self) -> dict[str, Any]: return {"sqlConnectivity": False, "objects": [], "ready": True, "mock": True}
    def filters(self, filters: QueryFilters) -> dict[str, Any]: return {"machines": [{"machineId": 11, "displayName": "Machine 11"}], "locations": [], "machineGroups": [], "statuses": [], "operationalActionLevels": list(ACTION_LEVELS), "qualityActionLevels": list(QUALITY_LEVELS), "datasetModes": [m.value for m in DatasetMode], "availableDateRange": {}}
    def overview(self, filters: QueryFilters) -> dict[str, Any]: return {"operationalRiskScore": 0.25, "activeMachines": 3, "knownMachines": 3, "criticalHighAlertEvents": 10, "criticalHighAlertMachines": 2, "dataQualityIssueEvents": 0, "dataQualityIssueMachines": 0, "maintenanceRiskMachines": 0, "repairRiskMachines": 0, "deltasAvailable": False}
    def risk_distribution(self, filters: QueryFilters) -> list[dict[str, Any]]: return [{"level": level, "count": 1} for level in ACTION_LEVELS]
    def risk_trend(self, filters: QueryFilters, grain: str) -> list[dict[str, Any]]: return []
    def top_machines(self, filters: QueryFilters, sort_by: str, limit: int) -> list[dict[str, Any]]: return [{"machineId": 11, "displayCode": "Machine 11", "latestRisk": 0.25, "latestAction": "LOW"}]
    def l1_status(self, filters: QueryFilters) -> dict[str, Any]: return {"eligibleCount": 20, "normalCount": 20, "anomalyCount": 0, "sensitiveOnlyCount": 0, "unreadyCount": 0}
    def l2_confidence(self, filters: QueryFilters) -> dict[str, Any]: return {"readyCount": 20, "averageDominantRisk": 0.2, "maxOperationalRisk": 0.4}
    def quality_trend(self, filters: QueryFilters, grain: str) -> list[dict[str, Any]]: return []
    def data_quality_overview(self, filters: QueryFilters) -> dict[str, Any]: return {"eligibleEvents": 20, "l1WindowReadyRate": 1.0, "l2ReadyRate": 1.0, "missingKwhRate": 0.0, "timeQualityIssueRate": 0.0, "kwhQualityIssueRate": 0.0, "sourceFreshnessSeconds": 0}
    def alerts(self, filters: QueryFilters, page: int, page_size: int, sort: str, search: str | None = None) -> dict[str, Any]:
        rows = self._events_for(filters)
        start = (page - 1) * page_size
        return {"items": rows[start:start + page_size], "page": page, "pageSize": page_size, "total": len(rows)}
    def machines(self, filters: QueryFilters, page: int, page_size: int, sort: str) -> dict[str, Any]:
        source = EventSource.HISTORICAL if filters.dataset_mode == DatasetMode.HISTORICAL else EventSource.CURRENT
        return {"items": [{"machineId": 11, "displayCode": "Machine 11", "currentRisk": 0.25, "currentAction": "LOW", "readiness": "READY", "source": source.value}], "page": page, "pageSize": page_size, "total": 1}
    def machine_summary(self, machine_id: int, filters: QueryFilters) -> dict[str, Any] | None:
        source = EventSource.HISTORICAL if filters.dataset_mode == DatasetMode.HISTORICAL else EventSource.CURRENT
        return {"machine_id": machine_id, "event_uid": f"{source.value}:1", "event_source": source.value, "operational_action_level": "LOW", "readiness_reason": "READY"}
    def machine_series(self, machine_id: int, filters: QueryFilters, series: str, limit: int) -> list[dict[str, Any]]: return []
    def machine_performance(self, machine_id: int, filters: QueryFilters) -> dict[str, Any]: return {"eventCount": 0, "throughputAvailability": False}
    def machine_energy(self, machine_id: int, filters: QueryFilters) -> dict[str, Any]: return {"eventCount": 0, "note": "Machine-level event KWh evidence."}
    def runtime_runs(self, page: int, page_size: int) -> dict[str, Any]: return {"items": [], "page": page, "pageSize": page_size, "total": 0}
    def event_by_uid(self, event_uid: str) -> dict[str, Any] | None:
        if not event_uid.startswith((EventSource.HISTORICAL.value + ":", EventSource.CURRENT.value + ":")):
            return None
        source, raw_id = event_uid.rsplit(":", 1)
        row = next((item for item in self._events if int(item["eventId"]) == int(raw_id)), None)
        return None if row is None else {**row, "eventUid": event_uid, "eventSource": source}


def get_dashboard_repository() -> DashboardRepository:
    settings = get_settings()
    if settings.backend_data_mode == "sql":
        return SqlDashboardRepository(settings)
    if settings.backend_data_mode == "mock":
        return MockDashboardRepository()
    raise RuntimeError("BACKEND_DATA_MODE=csv requires an explicit small dev CSV adapter; no silent SQL/mock fallback is allowed")


def _with_machine(filters: QueryFilters, machine_id: int) -> QueryFilters:
    return QueryFilters(
        dataset_mode=filters.dataset_mode,
        date_from=filters.date_from,
        date_to=filters.date_to,
        machine_ids=(int(machine_id),),
        location_ids=filters.location_ids,
        machine_group_ids=filters.machine_group_ids,
        operational_action_levels=filters.operational_action_levels,
        quality_action_levels=filters.quality_action_levels,
        status_ids=filters.status_ids,
    )
