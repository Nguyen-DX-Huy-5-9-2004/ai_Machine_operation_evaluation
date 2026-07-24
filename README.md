# Weldcom AI Operational Assessment

Nền tảng đánh giá vận hành và rủi ro có hỗ trợ AI hai lớp cho Weldcom. Hệ thống lấy dữ liệu sự kiện máy từ SQL Server, chuẩn hóa thành canonical event, chạy L1 Dual TCN Autoencoder, chạy sáu mô hình L2 LightGBM, áp dụng Policy v2 và cung cấp dashboard để người vận hành trả lời được hai câu hỏi:

- Máy hoặc sự kiện nào đang có rủi ro?
- Vì sao hệ thống đánh giá như vậy, dữ liệu và bằng chứng nào dẫn đến kết luận?

Dự án hiện có hai hướng sử dụng:

1. API/historical mode: backend FastAPI đọc dữ liệu từ SQL Server và cung cấp DTO cho Dashboard, Machines, Machine Detail, Alerts, Risk, Quality, Energy, Maintenance.
2. File-first replay/demo: đọc lịch sử theo watermark, mô phỏng thời gian thực, chạy lại pipeline AI và ghi kết quả vào event store local; mặc định không ghi SQL.

## Mục tiêu nghiệp vụ

Hệ thống tách riêng ba loại tín hiệu để tránh kết luận sai:

- Operational risk: rủi ro máy hoặc sự kiện trong vận hành.
- Data quality issue: dữ liệu thiếu, sai thời gian, thiếu KWh hoặc mâu thuẫn bằng chứng; đây không tự động có nghĩa máy hỏng.
- Energy consistency: kiểm tra sự nhất quán giữa trạng thái tải và KWh.

Kết quả cuối cùng được thiết kế để có thể truy vết từ action level về event, từ event về feature, rồi về model score và policy rule.

## Kiến trúc tổng thể

~~~text
SQL Server / typed view
        |
        v
Read-only source + historical result tables
        |
        v
Canonical event builder
  time, duration, gap, overlap, KWh, quality, segment
        |
        v
L1 Candidate A: Dual TCN Autoencoder
  lenient production + strict sensitive audit
        |
        v
L2 LightGBM multi-label
  6 target probabilities and confidence signals
        |
        v
Policy v2
  operational action + quality action + explanation
        |
        +--> FastAPI DTO / SQL-backed pages
        |
        +--> File-first Historical Replay event store
                    |
                    +--> REST snapshot/delta + SSE
                    +--> React Dashboard / Machine Detail
~~~

## Cấu trúc repository

~~~text
E:\OBAD
├── backend/                         FastAPI API, routers, SQL readers, replay API
├── inference/online/                runtime scoring, config, policy, controlled writer
├── modeling/
│   ├── l1_tcn/                      L1 artifacts, feature policy, selection
│   └── l2_fault_classifier/         sáu model LightGBM và metadata
├── frontEnd/weldcom-ai-operations-dashboard/
│   ├── src/data/                    mock/reference data
│   ├── src/services/                API services và replay client
│   ├── src/providers/               API/Mock data providers
│   ├── src/components/              layout, dashboard, machine detail, AI monitor
│   └── src/pages/                   các màn hình ứng dụng
├── data/replay_runtime/             manifest, checkpoint, batches, audit local
├── docs/                            kiến trúc, data flow, runbook, parity, UI
├── scripts/                         lệnh preflight, replay và demo
├── documentProject/                 tài liệu phân tích nghiệp vụ/dự án
└── requirements2.txt                Python dependencies chính
~~~

## Nguồn dữ liệu SQL

### Raw source

Replay và online pipeline đọc view typed:

~~~text
dbo.vw_ai_runtime_raw_iot_typed_local
~~~

View này là lớp đầu vào đã chuẩn hóa kiểu dữ liệu. Khi xử lý production, không lấy toàn bộ dữ liệu vào frontend; SQL reader đọc theo cursor/watermark và giới hạn batch.

### Các bảng/view ngữ cảnh

Tùy query và DTO, pipeline dùng các nguồn sau:

- data_ot: event vận hành, machine, status, thời gian và giá trị đo.
- data_machine_status: mã và tên trạng thái.
- data_machine: machine metadata, nhóm máy và machine_call_name.
- machine_location_his: lịch sử machine-location.
- data_location: tên location.
- dbo.vw_ai_runtime_raw_iot_typed_local: raw typed source cho runtime/replay.
- dbo.ai_l1_operation_event_sequence: chuỗi event và readiness/L1 context lịch sử.
- dbo.ai_l1_operation_anomaly_result_production: kết quả L1 production.
- dbo.ai_l2_fault_confidence_event: xác suất/confidence của L2.
- dbo.ai_l2_fault_judgment_policy_v2_full: historical policy result.
- dbo.ai_l2_dashboard_event_core_v2: core dữ liệu phục vụ dashboard.
- dbo.ai_l2_fault_judgment_online_v2: online result; chỉ dùng khi runtime SQL/API cần đọc.
- dbo.vw_ai_dashboard_events_source_aware_v2: view hợp nhất historical và online theo source-aware rule.

Các trang API khác tiếp tục lấy dữ liệu API/SQL thật. JSON demo của AI Model Monitor chỉ được dùng trong phạm vi AI Model Monitor hybrid, không được đưa sang Dashboard hoặc Machine Detail.

## Từ raw row đến canonical event

Một raw row chưa đủ để chạy model. Pipeline tạo canonical event theo các bước:

1. Xác định event_id, machine_id, status, machine group, location và thời gian bắt đầu.
2. Sắp xếp theo machine và thứ tự (event_start_time, event_id).
3. Xác định thời gian kết thúc từ raw end time hợp lệ; nếu không có, dùng event kế tiếp khác timestamp để suy ra.
4. Gắn cờ OPEN_EVENT khi không thể xác định end time.
5. Tính duration_sec, gap_from_prev_sec, overlap_sec, segment boundary.
6. Đọc KWh start/end từ nguồn máy nếu có.
7. Chỉ dùng neighbor fill trong phạm vi được quy định, tối đa khoảng 300 giây; mọi fill phải giữ source flag.
8. Tính kwh_delta_model_value, kwh_rate_per_hour, loaded/no-load evidence, missing/imputed/negative và energy inconsistency flags.
9. Tạo các cờ data_quality_issue_flag, time_quality_issue_flag, kwh_quality_issue_flag và energy_inconsistency_flag.
10. Tạo event_uid riêng cho replay, ví dụ HISTORICAL_REPLAY:<run_id>:<event_id>.

Cabinet/location-level KWh không được coi là machine-level KWh trực tiếp. Đây là ranh giới nghiệp vụ quan trọng của màn Energy Consistency.

## Feature cho L1

L1 dùng canonical feature order cố định gồm 30 feature. Thứ tự phải lấy từ feature policy/artifact, không tự sắp xếp theo tên cột:

~~~text
duration_sec
gap_from_prev_sec
overlap_sec
kwh_delta_model_value
kwh_rate_per_hour
is_loaded
is_on
is_off
is_fault
is_maintenance
is_data_issue
status_transition_code
machine_status_id
machine_group_id
location_id
behavior_anomaly_score_input
behavior_sensitive_score_input
time_quality_issue_flag
kwh_quality_issue_flag
data_quality_issue_flag
energy_inconsistency_flag
loaded_zero_kwh_flag
loaded_without_kwh_flag
kwh_negative_delta_flag
event_sequence_index
segment_sequence_index
hour_of_day
day_of_week
duration_quality_flag
source_completeness_score
~~~

Tên thực tế và mapping cuối cùng phải tuân theo artifact/feature policy trong modeling/l1_tcn. Danh sách trên mô tả semantic contract; không được đổi feature order để làm model chạy vừa.

## L1: Dual TCN Autoencoder

### Vai trò

L1 là lớp phát hiện bất thường hành vi/độ lệch của event sequence. Nó trả lời:

> Chuỗi hành vi hiện tại có lệch đáng kể so với pattern bình thường đã học không?

L1 không trực tiếp khẳng định máy hỏng. Nó là cổng deviation/anomaly trước khi L2 đánh giá các loại rủi ro tương lai.

### Artifact và candidate

- Candidate A là candidate production được chọn.
- Lenient là nhánh production chính, dùng cho operational anomaly.
- Strict là nhánh sensitive/audit, dùng để phát hiện cảnh báo nhạy hơn.
- Strict không tự nâng operational action level.
- Candidate C không được dùng trong production selection.

Artifact nằm trong:

~~~text
modeling/l1_tcn/artifacts/
  lenient/
  strict/
~~~

### Window và segmentation

- L1 window chuẩn là 20 event.
- Context phải cùng machine và cùng sequence_segment_id.
- Không tạo window xuyên qua big gap hoặc segment boundary.
- Nếu chưa đủ 20 event, readiness reason là INSUFFICIENT_HISTORY_IN_SEGMENT; đây là trạng thái chưa đủ ngữ cảnh, không phải feature failure.
- Khi đủ window, pipeline tạo tensor theo đúng feature order, scale/transform theo artifact, rồi chạy lenient và strict.

### Kết quả L1

L1 lưu/hiển thị raw reconstruction/deviation score, normalized score, anomaly threshold, strict threshold, is_behavior_anomaly, is_sensitive_deviation, l1_window_available, readiness reason và evidence dùng cho explanation.

Dashboard dùng L1 anomaly để phân nhóm Normal/Anomaly/No Data. Machine Detail hiển thị score trend, threshold và evidence theo event.

## L2: LightGBM multi-label

### Vai trò

L2 nhận canonical event và context sau khi L1 đã sẵn sàng để ước lượng các rủi ro tương lai độc lập theo từng target:

> Trong cửa sổ tương lai tương ứng, xác suất xuất hiện loại rủi ro nào là bao nhiêu?

L2 không phải một classifier duy nhất. Đây là sáu model/target LightGBM có cùng pipeline feature contract nhưng nhãn tương lai khác nhau.

### Sáu target production

1. future_fault_within_10_events: có fault trong 10 event kế tiếp hay không.
2. future_fault_within_30_events: có fault trong 30 event kế tiếp hay không.
3. future_fault_within_30min: có fault trong 30 phút kế tiếp hay không.
4. future_fault_within_60min: có fault trong 60 phút kế tiếp hay không.
5. future_maintenance_within_30_events: có maintenance trong 30 event kế tiếp hay không.
6. future_repair_within_30_events: có repair trong 30 event kế tiếp hay không.

Các tên viết tắt trên giao diện có ý nghĩa:

- fault30m = future_fault_within_30min.
- fault60m = future_fault_within_60min.
- maintenance30e = maintenance trong 30 event kế tiếp.
- repair30e = repair trong 30 event kế tiếp.

L2 còn có thể dùng context 10 event trước theo runtime policy. Future label chỉ dùng trong training/validation; runtime không được nhìn trước tương lai để tạo feature.

### Artifact và output

Run production đã xác nhận:

~~~text
l2_multilabel_20260711_043347
~~~

Model directory:

~~~text
modeling/l2_fault_classifier/artifacts/l2_multilabel_20260711_043347
~~~

Mỗi target trả probability. Pipeline giữ target probability, threshold/profile, confidence, positive/negative decision, risk fields 10 events/30 events/30min/60min, maintenance risk, repair risk, model run ID và policy input evidence.

LightGBM phải nhận DataFrame có đúng feature names và feature order; không truyền ndarray không tên vì sẽ tạo cảnh báo hoặc nguy cơ lệch feature.

## Policy v2

### Policy v2 là gì?

Policy v2 là lớp luật quyết định nằm sau model. Model chỉ đưa ra score/probability; Policy v2 biến các score đó thành kết luận vận hành có kiểm soát:

- operational_action_level;
- operational_judgment;
- quality_action_level;
- quality_judgment;
- final_reason_v2;
- explanation/evidence.

Tên policy hiện tại:

~~~text
policy_v2_operational_quality_split_sensitive_audit_only
~~~

Policy không huấn luyện model, không thay threshold production và không phải một model AI thứ ba. Nó là decision layer deterministic để bảo đảm score, quality và sensitive signal được diễn giải đúng nghiệp vụ.

### Hai nhánh policy

Operational branch dựa trên rủi ro máy và L1 production signal:

- Critical: cần hành động khẩn cấp/Stop Production.
- High: giảm tốc hoặc kiểm tra ngay.
- Medium: theo dõi sát/Review.
- Low: tiếp tục vận hành với theo dõi.

Tên action/judgment có thể là Stop Production, Reduce Speed, Monitor Closely hoặc Review tùy rule và evidence.

Quality branch dựa trên quality flags, không trộn vào machine fault:

- QUALITY_OK;
- CHECK_DATA;
- CHECK_ENERGY;
- CHECK_DATA_AND_ENERGY.

Ví dụ data thiếu KWh có thể cần kiểm tra dữ liệu dù máy chưa có bằng chứng fault. Vì vậy một event có thể có operational judgment thấp nhưng quality judgment là CHECK_DATA.

Strict L1 là nhánh nhạy để audit deviation. Nó giúp người kỹ thuật biết event bất thường nhạy cảm, nhưng không tự biến mọi strict warning thành Critical operational alert.

### Explanation

Explanation được tạo từ các bằng chứng đã tính:

1. L1 deviation gate: score/threshold và trạng thái behavior.
2. L2 risk gate: target probability/confidence nổi bật.
3. Quality policy: data/energy/time evidence.
4. Final policy gate: action level và reason.

final_reason_v2 phải ngắn, có thể hiển thị trong bảng; explanation panel có thể diễn giải dài hơn. Đây là rule-based explainability, không phải câu trả lời tự do của LLM.

## Backend FastAPI

Backend nằm trong backend/app. backend/app/main.py đăng ký router, CORS, GZip, request ID và error envelope.

Chạy backend:

~~~powershell
cd E:\OBAD
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
~~~

Health:

~~~text
GET http://127.0.0.1:8000/health/live
GET http://127.0.0.1:8000/health/ready
GET http://127.0.0.1:8000/api/demo/readiness
~~~

Nhóm endpoint chính:

| Nhóm | Endpoint tiêu biểu | Ý nghĩa |
|---|---|---|
| Dashboard | /api/dashboard/overview | KPI, risk distribution, trend, quality, alerts |
| Machines | /api/machines | danh sách máy và summary |
| Machine Detail | /api/machines/{id}/summary, /timeline, /l1-series, /l2-series, /kwh-series, /ai-analysis, /events | drill-down một máy |
| Alerts | /api/alerts | operational alerts đã lọc |
| AI Monitor | /api/model-monitor/overview, /performance-reference, /positive-rate-trend, /scoring-funnel, /data-contract-health, /decision-trace | model health và lineage |
| Replay | /api/replay/status, /runs, /events, /stream | snapshot, delta, SSE và trạng thái replay |
| Replay control | /api/replay/start, /pause, /resume, /step, /seek | điều khiển demo replay |
| Inference audit | /api/inference/latest và các route audit hiện có | bounded runtime audit |

Backend không đọc 4 triệu event vào frontend. Initial snapshot giới hạn, sau đó client nhận delta theo sequence/cursor.

## Historical Replay file-first

### Chế độ

Replay dùng inference/online/config.replay.local.yaml và mặc định:

~~~yaml
runtime:
  replay_mode: file_only
  enable_sql_write: false
  enable_local_canary_sql_write: false
  enable_replay_sql_batch_flush: false
~~~

Ba chế độ được phân biệt:

- file_only: mặc định, SQL chỉ SELECT, kết quả ghi local.
- hybrid_batch_flush: chỉ là code chuẩn bị, mặc định tắt và cần approval riêng.
- sql_direct: không dùng cho demo.

Replay không dùng checkpoint production weldcom_l2_realtime_v1 và không ghi đè canary event 61204.

### Watermark và checkpoint

Thứ tự event bắt buộc:

~~~text
(event_start_time, event_id)
~~~

Checkpoint ghi replay run ID, source watermark, last event time/id, virtual time, batch sequence, processed/L1-ready/policy-ready counts, successful batch, schema/artifact fingerprint và updated time.

Event UID riêng:

~~~text
HISTORICAL_REPLAY:<replay_run_id>:<event_id>
~~~

Mỗi batch được ghi atomic: file tạm -> flush/close -> rename -> cập nhật checkpoint. Khi restart, batch đã commit không xử lý lại; batch tồn tại nhưng checkpoint chưa commit được recovery an toàn.

### Đồng hồ demo

Config hiện tại dùng source poll interval 5 phút, real tick 5 giây, speed multiplier, pause/resume/step/seek, event spacing hoặc time spacing, auto-follow và jump to latest.

Quy ước demo của dự án: 5 giây thực tế tương ứng 5 phút dữ liệu nguồn. Timestamp gốc của event không bị sửa; virtual clock chỉ quyết định lúc event được feed vào pipeline.

Store local:

~~~text
data/replay_runtime/<replay_run_id>/
├── manifest.json
├── checkpoint.json
├── replay_config_snapshot.redacted.json
├── metrics.jsonl
├── errors.jsonl
├── state_changes.jsonl
├── raw_batches/
├── canonical_batches/
├── l1_batches/
├── l2_policy_batches/
└── frontend_batches/
~~~

## Frontend React

Frontend nằm tại frontEnd/weldcom-ai-operations-dashboard và dùng React + Vite + TypeScript + Tailwind + Recharts.

Hai provider:

- MockDataProvider: dữ liệu local/reference, không fetch backend.
- ApiDataProvider: gọi FastAPI/SQL-backed DTO. Chỉ AI Model Monitor được phép merge validated metadata và demo visualization theo hybrid rule; các trang còn lại giữ API thật.

### Dashboard / Control Center

- Header và filter theo ngày, machine, location, action level.
- KPI Operational Risk Score, Active Machines, Critical/High Alerts, Data Quality Issues, Maintenance/Repair Risk.
- Machine Risk Distribution: Critical/High/Medium/Low/No Data; No Data nghĩa chưa có kết quả L1+L2+Policy trong phạm vi chọn.
- Operational Risk Over Time: average risk, ngưỡng Low/Medium/High-Critical, granularity và tooltip.
- Top Machines by Risk: xếp hạng theo risk/count/maintenance/quality.
- L1 Anomaly Status: Normal, Anomaly, No Data.
- L2 Fault Confidence: High/Medium/Low.
- Quality Issue Trend: phân bố CHECK_DATA, CHECK_ENERGY, CHECK_DATA_AND_ENERGY, QUALITY_OK.
- Data Quality Overview: Completeness, Timeliness, Consistency, Accuracy.
- Operational Alerts table: action, judgment, fault/maintenance/repair risk, quality, L1 anomaly, final reason và actions.

### Machine Detail

Mục tiêu là trả lời “vì sao máy này bị cảnh báo”:

- machine profile, location, group, current status;
- operational timeline;
- L1 score/threshold trend;
- L2 risk trend cho sáu target;
- Event KWh Delta: chênh lệch model giữa dữ liệu đo và dữ liệu sau xử lý, có thể âm;
- Loaded Status vs KWh Evidence;
- KWh availability, source, missing/imputed/negative/zero-KWh;
- Recent Events table có scroll;
- AI Explainability & Evidence;
- các tab Timeline, AI Analysis, Performance, Energy, Events, Maintenance.

Machine name được lấy từ data_machine.machine_call_name khi backend cung cấp; machine ID vẫn giữ làm khóa truy vết.

### AI Model Monitor

Trang này theo dõi chất lượng và lineage của hai lớp AI:

- 7 KPI runtime/model;
- L1 Candidate A Train/Valid/Test;
- L2 LightGBM đúng sáu target;
- prediction-rate;
- training loss/threshold/score distribution;
- AP, AUROC/F1, production threshold;
- scoring funnel;
- AI 2-Layer Decision Flow bảy node;
- Data Contract & Feature Health;
- Example Decision Trace;
- runtime/audit strip.

AI Model Monitor API là hybrid có kiểm soát: runtime thật thắng validated artifact, validated artifact thắng demo visualization. Mọi panel mixed/demo phải có provenance phù hợp; demo visualization không được quyết định runtime health hay đẩy dữ liệu sang Dashboard/Machine Detail.

## Cấu hình và bảo mật

Không hard-code credential. SQL loader lấy:

~~~text
OBAD_SQL_USER
OBAD_SQL_PASSWORD
~~~

YAML để trống credential là chủ ý. Không in hoặc ghi password vào log, audit, config snapshot hay README.

Local SQL reference:

~~~text
ODBC Driver 18 for SQL Server
server: L0A0P8W1
database: OBAD_AI_LOCAL
~~~

config.local.yaml phục vụ online/stage theo cấu hình hiện có; config.replay.local.yaml dành riêng cho replay file-only. Không dùng config.canary.local.yaml để chạy demo.

## Cài đặt

~~~powershell
cd E:\OBAD
.\.venv\Scripts\Activate.ps1
pip install -r requirements2.txt

cd frontEnd\weldcom-ai-operations-dashboard
npm install
~~~

Nếu PowerShell chặn shim npm.ps1, dùng npm.cmd.

## Chạy frontend

Mock:

~~~powershell
cd E:\OBAD\frontEnd\weldcom-ai-operations-dashboard
npm run demo:mock
~~~

Thường mở http://127.0.0.1:4174.

API:

~~~powershell
cd E:\OBAD\frontEnd\weldcom-ai-operations-dashboard
npm run demo:api
~~~

Thường mở http://127.0.0.1:4173. API mode cần backend đang chạy và VITE_API_BASE_URL đúng; mặc định frontend đã dùng http://127.0.0.1:8000/api theo runtime config.

Development server:

~~~powershell
npm run dev:mock
npm run dev:api
~~~

Nếu port đang bận, kiểm tra process/port trước khi khởi động instance khác; không kill bừa process.

## Chạy demo replay

Lệnh thuận tiện:

~~~powershell
cd E:\OBAD
$env:OBAD_SQL_USER="..."
$env:OBAD_SQL_PASSWORD="..."
.\scripts\start_demo_tomorrow.ps1
~~~

Script kiểm tra credential chỉ theo trạng thái SET/MISSING, preflight SQL read-only, kiểm tra replay config fail-closed, warm-start batch đầu để UI có dữ liệu sớm, chạy backend/replay/API frontend, quy đổi 5 giây thật = 5 phút nguồn, in run ID/virtual time/batch/L1/L2/policy summary và không gọi SQL writer.

Các script khác:

~~~powershell
.\scripts\check_demo_tomorrow.ps1
.\scripts\stop_demo_tomorrow.ps1
.\scripts\reset_demo_tomorrow.ps1
~~~

Reset chỉ run replay local được chỉ định, không reset production/canary.

## Kiểm thử và build

Frontend:

~~~powershell
cd E:\OBAD\frontEnd\weldcom-ai-operations-dashboard
npm run typecheck
npm run lint
npm test -- --run
npm run build:api
npm run build:mock
~~~

Backend/replay:

~~~powershell
cd E:\OBAD
.\.venv\Scripts\python.exe -m pytest -q
~~~

Các nhóm test cần duy trì:

- watermark ordering và cùng timestamp khác event ID;
- checkpoint resume/recovery;
- atomic file commit và duplicate prevention;
- segment boundary/L1 insufficient history;
- L2 feature order và policy-ready filtering;
- replay clock pause/resume/step;
- cache append, delta reducer, auto-follow;
- downsampling giữ anomaly/fault/quality/energy marker;
- API snapshot/delta/SSE;
- mock không fetch;
- API pages khác không import AI Monitor fixture.

## Quy tắc không ghi SQL

Các pha discovery, unit test, stage-only, file-only replay, parity, API test và frontend integration phải SQL read-only.

Không được tự chạy controlled writer, SQL canary, batch flush, INSERT/UPDATE/DELETE/MERGE, migration/DDL/DML, training hoặc realtime worker production.

Nếu sau này cần batch flush replay, phải có config riêng, pipeline riêng, transaction idempotent và confirmation phrase riêng:

~~~text
I_APPROVE_REPLAY_SQL_BATCH_WRITE
~~~

Không dùng approval này cho SQL direct hoặc canary.

## Audit và troubleshoot

Khi API không hiện dữ liệu, kiểm tra theo thứ tự:

1. GET /health/live.
2. GET /health/ready.
3. GET /api/demo/readiness.
4. Backend có chạy đúng port không.
5. VITE_API_BASE_URL có trỏ đúng /api không.
6. Credential chỉ kiểm tra SET/MISSING, không in secret.
7. Replay status, run ID và checkpoint.
8. Browser Network để xem endpoint lỗi thật.
9. CORS và origin.
10. Log backend/replay; không đọc lại toàn bộ dataset để chữa một lỗi delta.

Các readiness reason như INSUFFICIENT_HISTORY_IN_SEGMENT là trạng thái dữ liệu chưa đủ context, không tự xem là lỗi pipeline. Lỗi feature contract, NaN bắt buộc, artifact thiếu hoặc API 5xx mới cần điều tra như lỗi.

## Tài liệu liên quan

- docs/SQL_TO_AI_RUNTIME_DATA_FLOW_REPORT.md: SQL-to-AI data flow chi tiết.
- docs/AI_REALTIME_INPUT_PIPELINE_CURRENT.md: runtime input pipeline và contract.
- docs/EXPLAINABILITY_CONTRACT.md: schema/evidence của explanation.
- docs/HISTORICAL_REPLAY_ARCHITECTURE.md: kiến trúc replay file-first.
- docs/HISTORICAL_REPLAY_RUNBOOK.md: vận hành replay.
- docs/HISTORICAL_REPLAY_DEMO.md: demo replay.
- docs/HISTORICAL_REPLAY_PARITY.md: đối chiếu historical/replay.
- docs/DEMO_TOMORROW_RUNBOOK.md: runbook demo.
- frontEnd/weldcom-ai-operations-dashboard/docs/AI_MODEL_MONITOR_PARITY_REPORT.md: parity mock/API và provenance.
- documentProject/readme.md: báo cáo dự án, data flow và giải thích UI chi tiết.

## Giới hạn hiện tại

- Kết quả replay file-first là local event store, chưa tự động ghi SQL.
- Demo/API phụ thuộc backend, SQL read-only, artifact và network ổn định.
- Một số chart AI Model Monitor có thể dùng reference visualization khi runtime chưa có series tương ứng; provenance phải được hiển thị rõ.
- Dữ liệu lớn cần query theo cursor, batch và cache; không tải toàn bộ 4 triệu event vào browser.
- Model artifact và policy version là contract; muốn thay đổi phải cập nhật metadata, test và parity report, không sửa trực tiếp trong component.

## Nguyên tắc phát triển

1. Giữ API thật cho các trang nghiệp vụ.
2. Tách quality issue khỏi machine fault.
3. Không đổi feature order, window, threshold hoặc policy để làm dashboard đẹp.
4. Mọi kết quả cần source, scope và thời gian.
5. Tối ưu delta/cache trước khi tăng số điểm biểu đồ.
6. File-first và fail-closed là mặc định cho demo.
7. Không log credential và không ghi SQL ngoài luồng được phê duyệt.
8. Khi có mismatch, báo rõ exact/tolerance/unexpected thay vì che bằng fallback.
