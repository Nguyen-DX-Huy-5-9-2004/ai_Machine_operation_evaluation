from __future__ import annotations

from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.repositories.dashboard import MockDashboardRepository, get_dashboard_repository


class ApiFixtureRepository(MockDashboardRepository):
    def machine_series(self, machine_id, filters, series, limit):
        event = self._events[0]
        if series == "l1":
            return [{"eventUid": event["eventUid"], "eventTime": event["eventTime"], "score": 0.2, "ready": True}]
        if series == "l2":
            return [{"eventUid": event["eventUid"], "eventTime": event["eventTime"], "fault10": 0.1}]
        return [event]


@pytest.fixture()
def client():
    repository = ApiFixtureRepository()
    app.dependency_overrides[get_dashboard_repository] = lambda: repository
    value = TestClient(app, raise_server_exceptions=False)
    yield value
    app.dependency_overrides.clear()


def test_live_health_and_openapi(client: TestClient) -> None:
    response = client.get("/api/health/live", headers={"X-Request-ID": "test-request"})
    assert response.status_code == 200
    assert response.json()["status"] == "LIVE"
    assert response.headers["X-Request-ID"] == "test-request"
    assert "/api/dashboard/overview" in client.get("/openapi.json").json()["paths"]


def test_ready_health_reports_real_static_gate(client: TestClient) -> None:
    body = client.get("/api/health/ready").json()
    assert body["status"] in {"READY", "NOT_READY"}
    assert body["checks"]["database"]["mock"] is True
    assert "runtimeEnvironmentStatus" in body["checks"]["runtime"]


@pytest.mark.parametrize(
    "path",
    [
        "/api/meta/filters",
        "/api/dashboard/overview",
        "/api/dashboard/risk-trend",
        "/api/dashboard/alerts?page=1&pageSize=5",
        "/api/machines?page=1&pageSize=5",
        "/api/machines/11/summary",
        "/api/machines/11/timeline",
        "/api/machines/11/l1-series",
        "/api/machines/11/l2-series",
        "/api/machines/11/energy",
        "/api/model-monitor/overview",
        "/api/model-monitor/scoring-funnel",
        "/api/model-monitor/performance-reference",
        "/api/model-monitor/model-metadata",
        "/api/model-monitor/latest-inference-audit",
    ],
)
def test_api_contract_endpoints_return_envelope(path: str, client: TestClient) -> None:
    separator = "&" if "?" in path else "?"
    response = client.get(f"{path}{separator}datasetMode=current")
    assert response.status_code == 200, response.text
    body = response.json()
    assert "data" in body and "meta" in body
    assert body["meta"]["datasetMode"] == "current"
    assert body["meta"]["source"] == "ONLINE_CURRENT_SQL"
    assert body["meta"]["dataMode"] == "mock"
    assert body["meta"]["isMock"] is True
    assert body["meta"]["requestId"]


def test_historical_and_current_modes_never_share_source_namespace(client: TestClient) -> None:
    historical = client.get("/api/dashboard/overview?datasetMode=historical").json()["meta"]
    current = client.get("/api/dashboard/overview?datasetMode=current").json()["meta"]
    assert historical["source"] == "HISTORICAL_PRODUCTION_SCORE"
    assert current["source"] == "ONLINE_CURRENT_SQL"
    assert historical["source"] != current["source"]


def test_model_performance_reference_is_validated_artifact_data_not_mock(client: TestClient) -> None:
    body = client.get("/api/model-monitor/performance-reference?datasetMode=historical").json()
    assert body["data"]["availability"] is True
    assert body["data"]["sourceType"] == "MODEL_ARTIFACT_REFERENCE"
    assert body["data"]["isDatabaseBacked"] is False
    assert body["data"]["isMock"] is False
    assert len(body["data"]["l2"]["targets"]) == 6


def test_model_monitor_metadata_is_shared_json_with_six_selected_targets(client: TestClient) -> None:
    body = client.get("/api/model-monitor/model-metadata?datasetMode=historical").json()["data"]
    assert body["availability"] is True
    assert body["production"]["l1Candidate"] == "A"
    assert len(body["l2Targets"]) == 6
    assert all(target["threshold"] is not None for target in body["l2Targets"])


def test_alert_pagination_and_timestamp_serialization(client: TestClient) -> None:
    body = client.get("/api/dashboard/alerts?datasetMode=current&page=1&pageSize=3").json()["data"]
    assert len(body["items"]) == 3
    assert body["page"] == 1
    assert body["pageSize"] == 3
    assert isinstance(body["items"][0]["eventTime"], str)


def test_event_explanation_has_no_fake_historical_values(client: TestClient) -> None:
    current = client.get("/api/events/ONLINE_CURRENT_SQL:1/explanation")
    assert current.status_code == 200
    assert current.json()["data"]["methodology"] == "POLICY_EVIDENCE_CONTRIBUTION"
    missing = client.get("/api/events/HISTORICAL_PRODUCTION_SCORE:999999/explanation")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "NOT_FOUND"


def test_invalid_filters_use_error_envelope(client: TestClient) -> None:
    response = client.get("/api/dashboard/overview?datasetMode=combined")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_date_range_guard_and_empty_result(client: TestClient) -> None:
    response = client.get("/api/dashboard/overview?from=2020-01-01&to=2026-01-01")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_sql_unavailable_is_not_replaced_with_mock(client: TestClient) -> None:
    class Unavailable(ApiFixtureRepository):
        data_mode = "sql"

        def overview(self, filters):
            raise ConnectionError("fixture SQL unavailable")

    app.dependency_overrides[get_dashboard_repository] = lambda: Unavailable()
    response = client.get("/api/dashboard/overview?datasetMode=current")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert "mock" not in response.text.lower()
