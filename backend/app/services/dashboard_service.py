from __future__ import annotations

from typing import Any, Callable

from backend.app.repositories.dashboard import DashboardRepository, QueryFilters


def overview_with_definitions(repository: DashboardRepository, filters: QueryFilters) -> dict[str, Any]:
    raw = repository.overview(filters)

    def metric(value: Any, unit: str, definition: str, *, numerator: Any = None, denominator: Any = None) -> dict[str, Any]:
        return {
            "value": value,
            "unit": unit,
            "numerator": numerator,
            "denominator": denominator,
            "definition": definition,
            "comparisonPeriod": None,
            "delta": None,
            "dataAvailability": value is not None,
        }

    active = raw.get("activeMachines")
    return {
        "kpis": {
            "operationalRiskScore": metric(raw.get("operationalRiskScore"), "ratio_0_1", "Average operational risk of the latest policy-ready event per active machine.", denominator=active),
            "totalActiveMachines": metric(active, "machines", "Machines with at least one eligible event in the selected range."),
            "totalMachines": metric(raw.get("knownMachines"), "machines", "Known non-deleted machines in the machine registry."),
            "criticalHighAlertEvents": metric(raw.get("criticalHighAlertEvents"), "events", "Policy-ready events with HIGH or CRITICAL operational action."),
            "criticalHighAlertMachines": metric(raw.get("criticalHighAlertMachines"), "machines", "Machines whose latest eligible event is HIGH or CRITICAL."),
            "dataQualityIssueEvents": metric(raw.get("dataQualityIssueEvents"), "events", "Events with data_quality_issue_flag=1; not operational alerts."),
            "dataQualityIssueMachines": metric(raw.get("dataQualityIssueMachines"), "machines", "Distinct machines with a data-quality issue event."),
            "maintenanceRiskMachines": metric(raw.get("maintenanceRiskMachines"), "machines", "Latest eligible machine events above the stored maintenance threshold."),
            "repairRiskMachines": metric(raw.get("repairRiskMachines"), "machines", "Latest eligible machine events above the stored repair threshold."),
        },
        "deltasAvailable": False,
    }
