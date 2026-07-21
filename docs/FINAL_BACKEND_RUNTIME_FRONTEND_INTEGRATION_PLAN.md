# Kế hoạch tích hợp Backend, AI Runtime và Frontend

## 1. Phạm vi khóa

Chuỗi production được giữ nguyên:

`SQL Server -> canonical L1 features -> Candidate A L1 -> 6 L2 models -> policy v2 -> explanation -> controlled storage -> FastAPI -> React`.

Không train lại L1/L2, không dùng Candidate B/C, không đổi threshold, policy hoặc production selection. SQL production write luôn tắt mặc định và không được tự động bật trong API.

## 2. Hiện trạng phát hiện

| Khu vực | Code hiện có | Trạng thái |
|---|---|---|
| Canonical input | `inference/online/feature_builder_l1.py`, `data_contract.py` | Đã khóa parity, không sửa logic |
| Candidate A L1 | `modeling/l1_tcn/artifacts/{lenient,strict}` và `l1_shadow.py` | Artifact PASS; worker chính chưa dùng scorer thật |
| L2 production | `l2_scorer.py`, production selection run `l2_multilabel_20260711_043347` | Dry-run/smoke PASS |
| Policy v2 | `policy_engine.py` | PASS; không MONITOR, strict-only không nâng action |
| Runtime CLI | `score_new_events.py` | Stage-only tốt; production path còn gọi `L1Scorer` no-op và writer cũ chưa đủ gate |
| SQL migration | `sql/01_*`, `sql/02_*` | Có hard-coded `USE`, online key chưa source-aware, unified view chưa có `event_uid` |
| Backend | `backend/app` | FastAPI skeleton; router chỉ health, endpoint inference đang chạy subprocess từ request |
| Frontend chính | `frontEnd/weldcom-ai-operations-dashboard` | UI hoàn chỉnh một màn; đang silent fallback sang mock và có KPI/demo hard-code |
| `frontEnd/src` | Các file rỗng, không có entrypoint | Không dùng làm app thứ hai |
| Runtime lineage | `data/runtime_manifest/*.json` | Candidate A và sáu L2 artifacts đã được khóa/hash |

## 3. Thành phần tái sử dụng

- Toàn bộ canonical transformation và 30-feature L1 contract.
- `l1_shadow.py` để load Candidate A, preprocess window 20 và score lenient/strict.
- `feature_builder_l2.py`, `l2_scorer.py` và metadata production để giữ đúng feature order.
- `policy_engine.py` làm nguồn duy nhất cho policy v2.
- `production_lineage_dry_run.py` và runtime manifests cho artifact/environment gate.
- FastAPI hiện tại và app React/Vite hiện tại; không tạo project song song.

## 4. Phần thiếu hoặc phải sửa

### Runtime

- Adapter Candidate A L1 thật cho worker online, có window/readiness rõ ràng.
- Worker loop riêng, process lock và run status; không chạy từ FastAPI startup/request.
- Explainability deterministic, versioned, không dùng LLM và không giả SHAP.
- Controlled writer transaction/idempotent/source-aware, nhiều gate và mặc định disabled.
- Run log đầy đủ; unready không được đi vào L2/policy hoặc nhận action giả.

### SQL read model

- Namespace `HISTORICAL_PRODUCTION_SCORE` và `ONLINE_CURRENT_SQL`.
- `event_uid = event_source + ':' + event_id`; không dedup chỉ bằng `event_id`.
- Historical/current query tách theo `datasetMode`; không có combined mặc định.
- Migration/view idempotent, không hard-code database và không tự apply.

### Backend

- Config SQL read-only, timezone, CORS, page/range limits và explicit `BACKEND_DATA_MODE`.
- Repository query parameterized với server-side filter/sort/pagination.
- Service/schema/routes cho health, filters, dashboard, machine detail, event explanation và model monitor.
- Error envelope, request ID, gzip, cache ngắn; không load model và không chạy inference.

### Frontend

- API client duy nhất và typed contracts; mock/api mode tường minh.
- Không silent fallback khi API lỗi; có loading/error/empty/stale state và badge mock.
- Bỏ semantics demo khỏi API mode: 128 máy, WLD IDs, May 2025, Healthy, Monitor Closely, fake quality/model metrics.
- Giữ layout, palette và chart hiện có; map dữ liệu API vào overview/machines/alerts/detail/monitor.

## 5. SQL object sử dụng

### Raw và context

- `dbo.data_iot_convert`
- `dbo.data_machine_status`
- `dbo.data_machine`
- `dbo.machine_location_his`
- `dbo.data_location`

### Historical/current result

- Historical: `dbo.ai_l2_fault_judgment_policy_v2_full`
- Current: `dbo.ai_l2_fault_judgment_online_v2`
- Runtime: `dbo.ai_inference_checkpoint`, `dbo.ai_inference_run_log`, `dbo.ai_inference_error_log`
- Read model mới/chuẩn hóa: `dbo.vw_ai_dashboard_events_source_aware_v2`

Tất cả object phải được verification script kiểm tra trước khi backend SQL mode được coi là ready.

## 6. API mục tiêu

- Health/runtime: `/api/health/live`, `/api/health/ready`, `/api/system/runtime-status`.
- Metadata: `/api/meta/filters`.
- Dashboard: overview, risk distribution/trend, top machines, L1 status, L2 confidence, quality trend/overview, alerts.
- Machines: list, summary, timeline, L1/L2/KWh series, AI analysis, performance, energy, events, maintenance risk.
- Event: `/api/events/{eventUid}/explanation`.
- Model monitor: overview, L1 candidates, L2 targets, positive-rate trend, scoring funnel, data-contract health, runs, decision trace.

## 7. Frontend pages

- Operations Control Center: overview và alerts thật.
- Machines: danh sách, filter và pagination server-side.
- Machine Detail: timeline, AI analysis, performance, energy, events, maintenance risk.
- Model Monitor: manifest/audit/report thật; metric thiếu trả unavailable.

## 8. Rủi ro và gate

- SQL schema production chưa được introspect trong lượt local này: migration chỉ được tạo, không tự chạy.
- Historical và current event ID bị rekey: mọi API key phải source-aware.
- Runtime Python hiện có sklearn khác 1.6.1: readiness không được báo Healthy cho tới khi môi trường đúng pin.
- Frontend dependency chưa hoàn chỉnh tại baseline (`tsc` chưa được tìm thấy); cần cài package trước build cuối.
- Writer không được bật nếu thiếu bất kỳ gate artifact, environment, lineage, target allowlist hoặc explicit confirmation.

## 9. Thứ tự thực thi

1. Khóa source-aware contract và SQL migration/read model.
2. Hoàn thiện backend config, database, repositories và response contracts.
3. Hoàn thiện explainability, Candidate A runtime adapter, readiness và controlled writer.
4. Triển khai API endpoints và fake-repository tests.
5. Nối app React hiện tại với API, giữ mock mode tường minh.
6. Viết OpenAPI/docs vận hành/rollout/data mapping.
7. Chạy toàn bộ inference/backend/frontend tests, build và py_compile.
8. So hash production artifact trước/sau; không chạy SQL migration/write hoặc training.
