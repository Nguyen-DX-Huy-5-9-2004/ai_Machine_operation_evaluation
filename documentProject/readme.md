# WELDCOM AI OPERATIONAL ASSESSMENT

## Tài liệu kiến trúc, luồng dữ liệu, AI hai lớp và vận hành giao diện

**Phiên bản:** 1.0
**Phạm vi rà soát:** inference, backend FastAPI, frontend React/Vite, cấu hình runtime/replay, artifact contract và tài liệu kỹ thuật trong workspace E:\OBAD.
**Mục đích:** mô tả có thể kiểm chứng cách dữ liệu đi từ SQL Server đến event chuẩn hóa, AI lớp 1, AI lớp 2, Policy v2, backend và hai màn hình vận hành chính Dashboard/Control Room và Machine Detail.

> Nguyên tắc quan trọng
>
> - Tài liệu mô tả implementation hiện có, không phải mô tả ý tưởng chung chung.
> - Username/password SQL không nằm trong mã nguồn, YAML, log hay tài liệu. Runtime lấy chúng từ OBAD_SQL_USER và OBAD_SQL_PASSWORD khi trường YAML để trống.
> - Cần luôn phân biệt: SQL/runtime thật; artifact mô hình đã kiểm chứng; mock/demo/reference chỉ phục vụ trình bày.
> - Rủi ro vận hành và chất lượng dữ liệu là hai nhánh độc lập. Một cờ quality không có nghĩa máy hỏng.

---

## Mục lục

1. Tổng quan hệ thống
2. Thành phần và ranh giới trách nhiệm
3. Dữ liệu SQL đầu vào
4. Raw IoT thành canonical event
5. AI lớp 1: input, kiến trúc và output
6. AI lớp 2: input, kiến trúc và output
7. Policy v2, operational judgment và giải thích
8. Historical Replay, lưu file-first và an toàn SQL
9. Backend, cache, delta và realtime UI
10. Dashboard / Control Room
11. Machine Detail
12. AI Model Monitor và provenance
13. Từ điển thuật ngữ
14. Bảo trì, kiểm thử và giới hạn
15. Bản đồ mã nguồn

---

## 1. Tổng quan hệ thống

Weldcom AI Operational Assessment đánh giá vận hành theo **event**. Một event là một khoảng trạng thái của một máy: bật/tắt, chạy có tải/không tải, bảo trì, sửa chữa, lỗi hoặc trạng thái liên quan. Hệ thống không kết luận từ một giá trị tức thời đơn lẻ; nó kết hợp chuỗi event theo máy, ngữ cảnh thời gian, trạng thái, KWh, cờ chất lượng dữ liệu, L1, L2 và Policy v2.

Luồng xử lý chuẩn:

    SQL Server raw typed IoT + danh mục máy/trạng thái/vị trí
             |
             v
    Canonical event builder
      - chuẩn hóa thời gian event
      - resolve KWh có kiểm soát
      - map status thành semantics/evidence
      - gán quality, energy, context và sequence segment
             |
             v
    L1 Candidate A Dual TCN Autoencoder
      - lenient: production primary
      - strict: sensitive/audit
      - cửa sổ 20 event cùng machine và segment
             |
             v
    L2: 6 LightGBM classifier độc lập
      - fault / maintenance / repair theo horizon
             |
             v
    Policy v2 + explanation JSON
      - operational action/judgment
      - quality action/judgment
      - final reason và bằng chứng
             |
             +--> historical SQL tables/views
             +--> online/canary được gate riêng
             +--> historical replay file-first
             +--> FastAPI snapshot/delta/SSE
             +--> Dashboard, Machine Detail, AI Model Monitor

### 1.1 Bài toán của ba tầng quyết định

| Tầng | Câu hỏi trả lời | Kết quả |
|---|---|---|
| L1 | Hành vi chuỗi event hiện tại có lệch khỏi baseline bình thường của máy không? | score lenient/strict, anomaly, sensitive warning |
| L2 | Với feature runtime, evidence và output L1, khả năng fault/bảo trì/sửa chữa là bao nhiêu? | 6 xác suất risk và threshold prediction |
| Policy v2 | Nên ưu tiên hành động vận hành nào? Dữ liệu có cần kiểm tra không? | action level, judgment, quality branch, explanation |

Thiết kế hai lớp tránh đánh đồng “bất thường” với “máy hỏng”. L1 phát hiện deviation, L2 đánh giá xác suất rủi ro cụ thể và Policy v2 minh bạch hóa hành động.

### 1.2 Định danh model và contract đã khóa

- L1 production candidate: Candidate A Dual TCN Autoencoder.
- L1 profile chính: lenient; strict chỉ là sensitive/audit.
- L1 window: 20 event liên tiếp trong cùng machine_id và sequence_segment_id.
- L1 feature contract: 30 model feature, ngoài khóa event/window.
- L2 run ID: l2_multilabel_20260711_043347.
- L2 có đúng sáu target, không thêm Candidate C.
- Policy: policy_v2_operational_quality_split_sensitive_audit_only.
- L1Scorer kiểm tra path artifact; Candidate C và artifacts_candidates bị từ chối ở runtime production/replay.

---

## 2. Thành phần và ranh giới trách nhiệm

### 2.1 Inference và contract

| Module | Trách nhiệm |
|---|---|
| inference/online/config.local.yaml | local online configuration, source/table mapping, runtime và artifact path |
| inference/online/config.replay.local.yaml | replay file-first, SQL chỉ đọc, namespace riêng |
| inference/online/feature_builder_l1.py | raw event thành canonical event: thời gian, KWh, status, quality, segment |
| inference/online/data_contract.py | feature list, threshold chuẩn, validate L1/L2 contract và runtime invariants |
| inference/online/l1_scorer.py, l1_shadow.py | nạp Candidate A, build 20-event window, preprocess và score hai profile |
| inference/online/feature_builder_l2.py | thêm L1-derived feature, loại bỏ label/future leakage |
| inference/online/l2_scorer.py | nạp 6 model, giữ named DataFrame feature order, predict probability |
| inference/online/policy_engine.py | áp Policy v2 xác định |
| inference/online/explainability.py | tạo explanation theo rule/evidence, không tự nhận là SHAP |
| inference/online/score_new_events.py | entry point stage/inference online có gate |
| inference/replay/source.py | đọc historical SQL bằng SELECT theo watermark |
| inference/replay/processor.py | canonical -> L1 -> L2 -> policy -> output file-only |

### 2.2 Backend và frontend

| Tầng | Trách nhiệm |
|---|---|
| FastAPI backend | dashboard/machine APIs, replay state, initial snapshot, delta và stream |
| Repository/service | SQL/query normalization, cache và source-aware mapping |
| Frontend mapper | chuẩn hóa API/replay DTO, readiness/risk/machine name trước khi render |
| React component | presentation, chart viewport/Brush/tooltip, interaction |
| Mock provider | dữ liệu local phục vụ thiết kế, không fetch |
| API provider | dữ liệu API/SQL thật; chỉ AI Model Monitor có hybrid demo/reference theo phạm vi riêng |

Dashboard và Machine Detail API mode không được dùng fixture thay dữ liệu thật. AI Model Monitor được phép dùng reference/demo visualization nhưng phải gắn provenance.

---

## 3. Dữ liệu SQL đầu vào

### 3.1 Kết nối local

| Thành phần | Giá trị hoặc quy tắc |
|---|---|
| Driver | ODBC Driver 18 for SQL Server |
| Server local | L0A0P8W1 |
| Database local | OBAD_AI_LOCAL |
| Credential | chỉ lấy từ environment; không in password |
| Raw typed view | dbo.vw_ai_runtime_raw_iot_typed_local |

Replay local cấu hình rõ:

    runtime:
      replay_mode: file_only
      enable_sql_write: false
      enable_local_canary_sql_write: false
      enable_replay_sql_batch_flush: false

### 3.2 Các bảng và view nguồn

| Đối tượng | Vai trò |
|---|---|
| dbo.vw_ai_runtime_raw_iot_typed_local | raw typed source cho runtime/replay local |
| dbo.data_iot_convert | raw event historical/legacy source theo config example |
| dbo.data_machine_status | danh mục status để map nghĩa vận hành |
| dbo.data_machine | danh mục máy; group và machine_call_name hiển thị |
| dbo.machine_location_his | lịch sử machine-location, dùng context theo thời gian |
| dbo.data_location | danh mục/tên location |
| dbo.data_cabinetglobal_kwh hoặc daily KWh cabinet | coarse location/cabinet context, không làm bridge machine-level trực tiếp |
| dbo.ai_l1_operation_event_sequence | canonical historical event sequence |
| dbo.ai_l1_operation_anomaly_result_production | kết quả L1 historical |
| dbo.ai_l2_fault_confidence_event | event/evidence L2 |
| dbo.ai_l2_future_fault_label | future label dùng cho train/evaluation, không đi vào runtime |
| dbo.ai_l2_fault_judgment_policy_v2_full | output historical L2 + Policy v2 |
| dbo.ai_l2_dashboard_event_core_v2 | dashboard historical projection |
| dbo.vw_ai_dashboard_events_source_aware_v2 | view source-aware historical/online |
| dbo.ai_l2_fault_judgment_online_v2 | online/canary result; file-only replay không ghi |
| dbo.ai_inference_checkpoint | checkpoint online/canary; replay dùng checkpoint file riêng |
| dbo.ai_inference_run_log, dbo.ai_inference_error_log | audit online/canary; replay ghi JSONL local |

Historical dataset đã được ghi nhận có 4.062.118 event và event_id duy nhất. Vì vậy backend/browser không được nạp toàn bộ dataset để vẽ UI.

### 3.3 Mapping raw source

| Tên pipeline | Cột raw typed |
|---|---|
| event_id | id |
| machine_id | machine_id |
| status_id | status_id |
| event_start_time | status_time_start |
| raw_event_end_time | status_time_end |
| raw_status_kwh_start | status_kwh_start |
| raw_status_kwh_end | status_kwh_end |
| raw_error_code | error_code |

event_id là khóa xuyên pipeline nhưng không đủ để replay theo thời gian. Trình tự bắt buộc là event_start_time, event_id; watermark cũng dùng cả hai để không bỏ/mất row cùng timestamp.

---

## 4. Raw IoT thành canonical event

### 4.1 Vì sao phải chuẩn hóa

Raw IoT có end time null/sai, KWh thiếu, gap/overlap, status chưa có semantics và location có thể thay đổi theo thời gian. Canonical builder là transformer DataFrame thuần để train-like runtime/replay dùng cùng logic.

Canonical event có:

1. Identity và sequence: event_id, machine_id, sequence_segment_id, event_order_in_segment.
2. Time: start/end đã resolve, duration, gap, overlap, nguồn end time.
3. Operational/energy: status semantics, KWh source/delta/rate, loaded state.
4. Quality/context: quality flags, machine group, location, hour/day.

### 4.2 Quy tắc end time

Raw được sort theo:

    machine_id, event_start_time, event_id

Pipeline tìm next greater distinct start time cùng machine, không dùng event đồng thời cùng timestamp để đóng event hiện tại.

| Điều kiện | event_end_time | end_time_source |
|---|---|---|
| raw end > start | raw end | RAW |
| raw end null, next start hợp lệ | next start | NEXT_EVENT_START_FROM_NULL |
| raw end <= start, next start hợp lệ | next start | NEXT_EVENT_START_FROM_INVALID_RAW |
| không có next start hợp lệ | null | OPEN_EVENT |
| còn lại | unresolved | UNRESOLVED_INVALID_TIME |

Từ đó:

    duration_sec      = event_end_time - event_start_time
    gap_from_prev_sec = event_start_time - prev_event_end_time
    overlap_sec       = max(0, -gap_from_prev_sec)

Cờ time gồm is_raw_end_missing, is_invalid_raw_end, is_open_event, end_time_imputed_flag, is_non_positive_duration, is_long_duration, is_gap, is_big_gap và is_overlap.

Ngưỡng runtime/replay hiện hành:

| Tên | Giá trị | Ý nghĩa |
|---|---:|---|
| small_gap_seconds | 300 giây | gap đáng chú ý |
| big_gap_seconds | 3.600 giây | sequence boundary/time-quality issue |
| long_duration_seconds | 86.400 giây | event dài bất thường |
| kwh_impute_gap_limit_seconds | 300 giây | giới hạn fill KWh |

### 4.3 Status semantics

status_id được map thành cờ nghiệp vụ ổn định để model/UI không rải điều kiện ID.

| ID | Status canonical | Nhóm evidence |
|---:|---|---|
| 1 | POWER_ON | POWER_ON_NEAR_ZERO |
| 2 | RUN_PRODUCTION_NO_LOAD | normal no-load |
| 3 | RUN_PRODUCTION_LOADED | normal loaded |
| 4 | RUN_MAINTENANCE_NO_LOAD | maintenance |
| 5 | RUN_MAINTENANCE_LOADED | maintenance |
| 6 | RUN_REPAIR_NO_LOAD | repair/fault/maintenance |
| 7 | RUN_REPAIR_LOADED | repair/fault/maintenance |
| 8 | POWER_OFF | normal off |
| 9 | POWER_OFF_FAULT | off-with-fault |
| 10 | POWER_OFF_MAINTENANCE | off-with-fault/maintenance |

Các feature/flag: status_type_code, current_signal_code, is_on, is_loaded, is_no_load, is_current_near_zero, has_error_token, has_maintenance_token, known_fault_status, known_maintenance_status, known_repair_status, off_with_fault_status, status_evidence_class.

### 4.4 KWh có provenance và controlled fill

Quy tắc:

1. Dùng raw_status_kwh_start/end nếu có: RAW.
2. Start thiếu chỉ fill từ prev_raw_status_kwh_end nếu chronological gap nằm trong [0, 300] giây: PREV_EVENT_END.
3. End thiếu chỉ fill từ next_raw_status_kwh_start nếu gap hợp lệ [0, 300] giây: NEXT_EVENT_START.
4. Khác các điều kiện trên: MISSING.

Không dùng abs(gap) để fill qua overlap. Điều này tránh biến dữ liệu không hợp lệ thành số KWh có vẻ hợp lệ.

Các field chính:

    kwh_delta = kwh_end_value - kwh_start_value
    kwh_delta_model_value
    kwh_rate_per_hour
    kwh_rate_per_hour_model_value
    kwh_available_flag / kwh_missing_flag / kwh_imputed_flag
    kwh_zero_delta_flag / kwh_positive_delta_flag / kwh_negative_delta_flag
    loaded_zero_kwh_flag / loaded_without_kwh_flag
    energy_inconsistency_flag

KWh delta có thể âm. Đó là chênh lệch meter/event-level sau canonical resolution, **không phải khẳng định điện năng tiêu thụ âm**. Nó là evidence để kiểm tra meter/dữ liệu/consistency.

### 4.5 Quality và energy

| Cờ | Logic |
|---|---|
| time_quality_issue_flag | open event, duration không dương, big gap hoặc overlap |
| kwh_quality_issue_flag | KWh missing, imputed hoặc delta âm |
| data_quality_issue_flag | time quality hoặc KWh quality |
| energy_inconsistency_flag | loaded-zero KWh, loaded-missing KWh hoặc KWh delta âm |

data_quality_reason được ghép từ TIME_QUALITY, KWH_QUALITY và ENERGY_INCONSISTENCY. Quality flags được hiển thị riêng để không bị hiểu nhầm là fault machine.

### 4.6 Context và segment

machine_group_id lấy từ data_machine; location_id lấy từ context/history; hour_of_day và day_of_week lấy từ event start. Sequence segment reset khi event đầu của machine, big gap, duration không dương hoặc end time null. Do đó một event thiếu 20 row trong segment trả INSUFFICIENT_HISTORY_IN_SEGMENT là unready hợp lệ, không phải lỗi model/feature.

---

## 5. AI lớp 1: input, kiến trúc và output

### 5.1 Feature contract L1

machine_id không được đưa trực tiếp vào L1 model feature để tránh model học thuộc identity máy; nó dùng để group sequence/join context/threshold.

| Nhóm | Feature |
|---|---|
| Khóa/window | event_id, machine_id, sequence_segment_id, event_order_in_segment |
| Categorical | status_id, status_type_code, current_signal_code, hour_of_day, day_of_week, machine_group_id, location_id |
| Continuous | duration_sec, gap_from_prev_sec, overlap_sec, kwh_delta_model_value, kwh_rate_per_hour |
| Binary | is_on, is_loaded, is_no_load, is_current_near_zero; KWh, energy và time-quality flags |

Các binary flags gồm kwh_available_flag, kwh_missing_flag, kwh_imputed_or_missing_flag, kwh_rate_missing_flag, loaded_zero_kwh_flag, loaded_without_kwh_flag, is_raw_end_missing, is_invalid_raw_end, end_time_imputed_flag, is_non_positive_duration, is_long_duration, is_gap, is_big_gap, is_overlap.

### 5.2 L1 Candidate A Dual TCN Autoencoder

L1 là Temporal Convolutional Network Autoencoder. Mô hình học tái tạo chuỗi normal 20 event; reconstruction error cao báo hiệu deviation.

Lý do lựa chọn:

- Event là chuỗi rời rạc và không đều thời gian; TCN nhận pattern chuỗi tốt hơn rule từng row.
- Autoencoder phát hiện deviation khi nhãn fault không đầy đủ.
- Window 20 giữ được ngữ cảnh gần đây với inference runtime gọn.
- Tách L1 và L2 để L1 không tự tuyên bố fault diagnosis.

Chi tiết layer/hidden size/embedding không được tự suy đoán. Nguồn đúng là base config và artifact model_best.pt/preprocessor. Runtime validate artifact contract thay vì copy thông số sang UI.

### 5.3 Thông số kiến trúc và huấn luyện L1 đã đọc từ cấu hình

Base configuration của Candidate A cung cấp các tham số sau. Đây là cấu hình mô hình/huấn luyện đã được dùng làm contract; thay đổi các giá trị này cần đánh giá lại artifact và parity, không nên chỉnh để làm giao diện hoặc demo đẹp hơn.

| Nhóm | Thông số | Giá trị |
|---|---|---:|
| Reproducibility | seed | 42 |
| Sequence | window size / stride train / stride eval | 20 / 1 / 1 |
| TCN | hidden channels | 96 |
| TCN | latent channels | 96 |
| TCN | số TCN block | 5 |
| TCN | kernel size | 3 |
| TCN | dropout | 0,10 |
| TCN | batch normalization | bật |
| TCN | activation | GELU |
| Categorical embedding | mặc định | 8 |
| Embedding override | status_id / status_type_code / current_signal_code | 8 / 4 / 4 |
| Embedding override | hour_of_day / day_of_week / machine_group_id / location_id | 6 / 4 / 4 / 4 |
| Continuous preprocessing | transform | signed_log1p |
| Continuous preprocessing | scaling / clipping | RobustScaler / clip z = 8 |
| Categorical preprocessing | missing và unknown category | 0 / 0 |
| Training | batch size / max epoch | 1.024 / 35 |
| Training | learning rate / weight decay | 0,001 / 0,0001 |
| Training | gradient clipping / early stopping patience | 1,0 / 6 |
| Loss | continuous / categorical / binary weight | 1,0 / 0,35 / 0,75 |
| Loss continuous | loại loss | Smooth L1 |
| Threshold | quantile lenient / strict | 0,995 / 0,995 |
| Threshold | per-machine threshold | bật nếu machine có tối thiểu 1.000 valid windows |
| Threshold fallback | global quantile | 0,995 |

L1 preprocessor ghi rõ feature cardinality của categorical encoding: status_id 5, status_type_code 3, current_signal_code 4, hour_of_day 25, day_of_week 8, machine_group_id 8 và location_id 3. Đây là cardinality sau preprocessing, không phải số lượng status vật lý tuyệt đối trong database.

### 5.4 Lenient và strict

| Profile | Vai trò | Hệ quả |
|---|---|---|
| lenient | production primary | is_behavior_anomaly = is_anomaly_lenient; Policy có thể dùng làm MEDIUM signal |
| strict | sensitive/audit | strict-only tạo is_sensitive_warning; không tự nâng operational action |

Mỗi profile bắt buộc có model_best.pt, preprocessor.json, thresholds.json. Runtime kiểm tra existence/path, feature order và window 20.

### 5.5 Readiness và output L1

L1 chỉ score khi event đã closed/resolved và đủ 20 event liên tiếp đúng machine + segment. Output:

    score_lenient / score_strict
    threshold_lenient / threshold_strict
    score_lenient_normalized / score_strict_normalized
    behavior_anomaly_score / behavior_sensitive_score / behavior_combined_score
    is_anomaly_lenient / is_anomaly_strict
    is_behavior_anomaly / is_sensitive_warning
    l1_score_available_flag / readiness_reason

Normalized comparison sử dụng threshold profile; contract mô tả score_norm >= 1.0 là vượt threshold. Không thay event unready bằng score 0; UI phải hiện No Data hoặc Insufficient History.

---

## 6. AI lớp 2: input, kiến trúc và output

### 6.1 Input L2

L2 nhận canonical event đã có output L1. Các future label như future_*, next_fault_status_id, events_to_next_fault, seconds_to_next_fault bị loại trước runtime để chống leakage.

Nhóm feature native:

    duration_sec_model_value, gap_from_prev_sec_model_value, overlap_sec
    status_id, status_type_code, current_signal_code
    is_loaded, is_no_load, is_current_near_zero
    known_fault_status, known_maintenance_status, known_repair_status, off_with_fault_status
    KWh availability/missing/imputed/delta/rate flags
    energy_inconsistency_flag, time/kwh/data quality flags
    machine_group_id, location_id, hour_of_day, day_of_week, split_bucket
    fault_evidence_count, maintenance_evidence_count

feature_builder_l2.py bổ sung L1-derived feature: clipped/log transforms của raw/normalized lenient/strict, strict-lenient gap/ratio, balance index và anomaly flag. l2_past_event_window được cấu hình là 10 event; context phải cùng machine/segment hợp lệ.

### 6.2 Sáu LightGBM model

| Target | Output runtime | Ý nghĩa |
|---|---|---|
| future_fault_within_10_events | risk_fault_10_events | risk fault trong 10 event kế |
| future_fault_within_30_events | risk_fault_30_events | risk fault trong 30 event kế |
| future_fault_within_30min | risk_fault_30min | risk fault trong 30 phút |
| future_fault_within_60min | risk_fault_60min | risk fault trong 60 phút |
| future_maintenance_within_30_events | risk_maintenance_30_events | risk bảo trì trong 30 event |
| future_repair_within_30_events | risk_repair_30_events | risk sửa chữa trong 30 event |

L2 là sáu binary LightGBM classifier độc lập, không phải một softmax class. Điều này phù hợp vì horizon/loại rủi ro khác nhau có threshold/profile/metric khác nhau và có thể đồng thời có evidence.

### 6.3 Production selection và threshold L2 đã khóa

Production selection dùng metric valid average precision. Các threshold dưới đây được đọc từ production_profile_selection.json; UI có thể format ba chữ số nhưng không được thay threshold trong inference.

| Target | Selected profile | Validation AP | Production threshold |
|---|---|---:|---:|
| future_fault_within_10_events | safe | 0,171425 | 0,130113 |
| future_fault_within_30_events | strict_continuous | 0,076618 | 0,072355 |
| future_fault_within_30min | safe | 0,069882 | 0,070673 |
| future_fault_within_60min | safe | 0,086679 | 0,082103 |
| future_maintenance_within_30_events | strict_continuous | 0,207626 | 0,108843 |
| future_repair_within_30_events | strict_continuous | 0,073467 | 0,072070 |

Theo artifact report, các test metric như AP/AUROC/F1 là metric đánh giá cho split tương ứng. Chúng không phải confidence của một event và không được hiển thị nhầm thành risk realtime của máy.

### 6.4 Artifact, feature order và readiness

L2Scorer đọc model artifact, production_profile_selection.json và l2_feature_policy.json/metadata.json. Input được reindex thành Pandas DataFrame có **đúng tên và thứ tự feature artifact** rồi mới predict_proba. Điều này bảo toàn contract và tránh cảnh báo LightGBM X does not have valid feature names.

L2 readiness kiểm tra feature cần thiết của mọi target là finite. Thiếu/non-finite required feature tạo readiness reason rõ; không tự fill bừa. Mỗi target trả probability, threshold_<short> và pred_<short>.

### 6.5 Confidence tổng hợp

    operational_fault_confidence_score
      = max(fault risks, known fault/off-fault evidence,
            repair evidence * 0.85, L1 behavior anomaly * 0.20)

    operational_maintenance_confidence_score
      = max(risk_maintenance_30_events, known maintenance evidence * 0.70)

    operational_repair_confidence_score
      = max(risk_repair_30_events, known repair evidence * 0.85)

    operational_overall_risk_score
      = max(fault confidence, maintenance confidence, repair confidence)

Score nguồn là 0..1; presentation có thể format percent/0-100 nhưng không được nhân sai đơn vị.

---

## 7. Policy v2, operational judgment và giải thích

### 7.1 Policy v2 là gì

policy_v2_operational_quality_split_sensitive_audit_only là luật hậu xử lý xác định, không phải model train thêm. Nó tổng hợp sáu risk L2, status evidence, L1 lenient và quality/energy flags thành output nhất quán, có thể audit.

### 7.2 Operational action level

| Mức | Trigger ưu tiên |
|---|---|
| CRITICAL | known fault, off-with-fault hoặc risk fault 10 event vượt threshold |
| HIGH | fault 30 phút, fault 30 event hoặc repair 30 event vượt threshold |
| MEDIUM | fault 60 phút, maintenance 30 event, known maintenance hoặc L1 lenient anomaly |
| LOW | không có điều kiện trên |

strict-only sensitive warning không nâng action. Đó là ý nghĩa sensitive_audit_only.

### 7.3 Operational judgment

Operational judgment là **lý do nghiệp vụ chính**, chi tiết hơn action level.

| Judgment | Diễn giải |
|---|---|
| KNOWN_FAULT_CONFIRMED | có status/evidence fault/off-fault |
| PRE_FAULT_CRITICAL_NEAR_TERM | fault 10 event vượt ngưỡng |
| PRE_FAULT_HIGH_CONFIDENCE | fault 30 min hoặc 30 event vượt ngưỡng |
| REPAIR_RELATED | repair risk/evidence chi phối |
| PRE_FAULT_MEDIUM_CONFIDENCE | fault 60 min vượt ngưỡng |
| MAINTENANCE_RELATED | maintenance risk/evidence chi phối |
| UNKNOWN_BEHAVIOR_ANOMALY | L1 lenient anomaly chưa có trigger mạnh hơn |
| NORMAL_LIKE | không có trigger vận hành cao hơn |

Action HIGH nói độ ưu tiên; PRE_FAULT_HIGH_CONFIDENCE nói vì sao nó là HIGH.

### 7.4 Quality branch

| quality_judgment | quality_action_level | Ý nghĩa |
|---|---|---|
| DATA_AND_ENERGY_QUALITY_ISSUE | CHECK_DATA_AND_ENERGY | vừa quality vừa energy inconsistency |
| DATA_QUALITY_ISSUE | CHECK_DATA | time/KWh data cần xác nhận |
| ENERGY_INCONSISTENCY | CHECK_ENERGY | load state và KWh/meter không nhất quán |
| KWH_QUALITY_ISSUE hoặc TIME_QUALITY_ISSUE | CHECK_DATA_DETAIL | cần kiểm tra chi tiết |
| QUALITY_OK | QUALITY_OK | không có cờ quality hiện tại |

quality_risk_score là score riêng. Không cộng thẳng quality risk vào fault risk để kết luận máy hỏng.

### 7.5 Final reason và explanation

final_reason_v2 là output compact:

    op=<operational_judgment>
    |op_action=<operational_action_level>
    |quality=<quality_judgment>
    |quality_action=<quality_action_level>

explanation_json do explainability.py tạo theo POLICY_EVIDENCE_CONTRIBUTION:

- readiness L1/Policy;
- raw/normalized score, threshold, margin L1;
- sáu risk L2 và threshold/prediction;
- status/duration/gap/overlap/KWh source/delta/rate;
- quality và energy evidence;
- triggered rule, suppressed reason, contribution ratio;
- Policy v2 result.

Nó không phải SHAP. Đây là giải thích quyết định có thể tái lập, không được tuyên bố là nguyên nhân vật lý đã được chứng minh.

---

## 8. Historical Replay, file-first và an toàn SQL

### 8.1 Chế độ

| Mode | Mục đích | SQL write |
|---|---|---|
| file_only | mặc định demo/replay, SQL chỉ SELECT, output local | cấm |
| hybrid_batch_flush | chuẩn bị tương lai, cần approval riêng | tắt |
| sql_direct | production khi được phê duyệt, không dùng demo | tắt |

### 8.2 Clock, watermark và source

Replay đọc dbo.vw_ai_runtime_raw_iot_typed_local bằng SELECT. Virtual clock quyết định event historical nào đã xuất hiện; poll source mặc định 5 phút. Demo local có thể cấu hình 5 giây thực cho một tick nguồn 5 phút, timestamp gốc không đổi.

Watermark:

    (event_start_time, event_id)

Query chỉ lấy event lớn hơn watermark và <= virtual_time, ORDER BY event_start_time, event_id, có max_events_per_tick để backpressure. Identity riêng:

    HISTORICAL_REPLAY:<replay_run_id>:<event_id>

không trùng historical production hoặc online SQL identity.

### 8.3 Durable store

Mỗi run:

    data/replay_runtime/<replay_run_id>/
      manifest.json
      checkpoint.json
      replay_config_snapshot.redacted.json
      metrics.jsonl
      errors.jsonl
      state_changes.jsonl
      raw_batches/
      canonical_batches/
      l1_batches/
      l2_policy_batches/
      frontend_batches/

Batch Parquet được immutable: ghi temporary -> flush/close -> atomic rename -> mới cập nhật checkpoint. Restart dùng manifest/batch recovery để không duplicate/missing. Replay không dùng checkpoint weldcom_l2_realtime_v1 hoặc canary production.

### 8.4 Parity

Parity đối chiếu replay với historical L1 sequence/result, L2 confidence và Policy v2 theo event ID: identity, machine/time/duration/gap/KWh/flags, readiness, L1/L2 score, judgment/action/explanation. Kết quả phân loại exact, float tolerance, expected mismatch, unexpected mismatch. Machine 11 và event 48043 là điểm kiểm tra bắt buộc trong credentialed parity run.

---

## 9. Backend, cache, delta và realtime UI

Browser không được tải hàng triệu event. Backend cung cấp initial snapshot nhỏ theo run/machine/filter/range, sau đó chỉ gửi delta theo after_sequence hoặc after_event_uid bằng SSE/cursor.

Cache cần có:

- LRU batch cache;
- ring buffer theo machine;
- cache key gồm replay_run_id + machine + filter;
- invalidation theo batch sequence;
- giới hạn memory và point count;
- cache hit/miss trong status.

### 9.1 Event spacing và adaptive density

| Khái niệm | Ý nghĩa |
|---|---|
| Event spacing | mặc định live/demo; event cách đều giúp chuỗi dày/thưa dễ đọc |
| Time spacing | X theo timestamp thật, để thấy gap thời gian |
| Brush/viewport | vùng data user đang xem |
| Auto-follow | chỉ chạy khi user ở latest; xem lịch sử thì hiện badge N event mới |
| Adaptive density | bucket viewport, giữ first/last/min/max và mọi anomaly/warning/fault/maintenance/quality/energy marker |

Không được lấy mỗi event thứ N vì có thể mất anomaly. Delta append cần preserve Brush range và không remount chart/page.

---

## 10. Dashboard / Control Room

### 10.1 Mục tiêu trang

Dashboard là overview cho quản lý/điều phối: mức risk, top machine, trend, L1/L2 status, data quality và alert. Drill-down sang Machine Detail trả lời vì sao từng máy/event bị cảnh báo.

Header:

    Weldcom AI Operations Control Center
    Historical scoring & operational risk intelligence.

Filter bar: date range, machines, locations, action level/status, Filters. Select có state/open affordance để gắn API filter sau này.

Replay Live Panel biểu diễn Live/Paused, virtual time, speed, batch, processed/L1/L2/Policy-ready, SQL writes, Event spacing/Time spacing, Auto-follow, Pause/Resume/Step/Jump latest và new-event badge.

### 10.2 KPI row

| KPI | Source/logic | Cách hiểu |
|---|---|---|
| Operational Risk Score | operational_overall_risk_score aggregate | risk vận hành, không phải health certificate |
| Total Active Machines | active/total scope | phải phân biệt No Data |
| Critical / High Operational Alerts | operational_action_level CRITICAL/HIGH | không trộn quality issue |
| Data Quality Issues | quality action/flags/risk | cần validate data, không phải fault count |
| Maintenance / Repair Risk | risk_maintenance_30_events/risk_repair_30_events | maintenance/repair signal |

Không có metric không được hiển thị 0 giả. Source/demo provenance phải rõ ở nơi có hybrid data.

### 10.3 Machine Risk Distribution

Donut dùng latest **policy-ready eligible operational event** của từng machine scope, phân Critical/High/Medium/Low. Có slice No Data để tổng vòng luôn bằng tổng machine:

- No Data: chưa có event eligible/replay/AI policy-ready trong scope.
- No Data không phải Low, không phải healthy.
- Total machine ở tâm; legend count + percent format gọn.
- Hover highlight active slice/tooltip, không làm toàn chart neon chói.

### 10.4 Operational Risk Over Time

Area/line chart average operational risk theo granularity. Default là Hourly cho demo/live. Dashed line Low, Medium, High/Critical là boundary policy. Tooltip có time thực, average risk, critical/high count và top machine nếu source có.

Brush giới hạn viewport. Delta append bên phải; auto-follow chỉ khi user ở latest. Khi variation nhỏ, y-axis có thể focus quanh data nhưng phải giữ visible policy boundaries nếu có, không được làm sai score.

### 10.5 Top Machines by Risk

Ranking modes: current risk, critical count, maintenance risk, data-quality issue. Label chính dùng machine_call_name từ data_machine, ID phụ để trace. Click chuyển Machine Detail. Màu bar: critical đỏ, high cam, medium amber, low xanh.

### 10.6 L1/L2 status

| Card | Nội dung |
|---|---|
| L1 Anomaly Status | Normal, Anomaly, No Data/Insufficient History từ L1 availability/lenient |
| L2 Fault Confidence | confidence/risk bucket của L2 policy-ready; No Data không được ngụy trang thành Low |

Donut/ring center là primary percent/value, sparkline ở đáy. strict-only warning là audit signal, không tự là operational alert.

### 10.7 Quality và alert table

Quality Issue Trend là stacked bar: CHECK_DATA, CHECK_ENERGY, CHECK_DATA_AND_ENERGY, QUALITY_OK. Đây không phải chart fault. Last 7/30 Days và Brush phải giữ state sau delta.

Data Quality Overview: Completeness, Timeliness, Consistency, Accuracy. Các card thể hiện chất lượng input, không phải machine health.

Operational Alerts table: Machine name + ID, Location, Action Level, Operational Judgment, Fault Risk 30min, Maintenance Risk, Repair Risk, Quality Judgment, L1 Anomaly, Final Reason, Event Time, Actions. Eye/View Detail chuyển Machine Detail. Sticky header, ellipsis + tooltip, stable key và update nhẹ, không rerender toàn bảng.

---

## 11. Machine Detail

### 11.1 Mục tiêu và header

Machine Detail trả lời: **Vì sao máy này bị cảnh báo?** Entry từ menu/select hoặc View Detail của alert/top machine. Header có machine call name/ID, location, group, current status, latest event time, mode Historical/Replay, operational/quality context và range/filter.

Màn phải render shell/profile trước, sau đó hydrate chart/evidence/cache; tránh màn trắng dài khi API/replay load.

### 11.2 KPI machine

| KPI | Ý nghĩa |
|---|---|
| Machine ID | ID và machine_call_name trace được |
| Location / Machine Group | context phân tích |
| Current Status | status canonical mới nhất, không phải Policy result |
| Risk Fault 30min | L2 probability fault 30 phút |
| L1 Anomaly Score | normalized lenient deviation |
| Max L2 Confidence | risk lớn nhất của 6 target, chỉ để scan nhanh |
| Data Quality | quality branch/coverage riêng |
| Energy Consistency | evidence load/KWh, không chứng minh fault một mình |

### 11.3 Timeline tab

Operational Timeline dùng event spacing, phân ON Loaded, ON No-load, OFF, Fault, Maintenance, Data issue; marker anomaly/warning/energy/quality. Khi nhiều event, timeline compact visual interval nhưng marker quan trọng vẫn event-timed và tooltip giữ event thật.

Bốn chart:

1. **L1 Anomaly Score Over Time**: lenient normalized score, threshold lenient/strict, histogram/value strip bên dưới cùng viewport; mock/API phải cùng contract, histogram có giá trị và tooltip.
2. **L2 Risks Over Time**: risk fault/maintenance/repair, ưu tiên nhóm dễ đọc hoặc chooser; threshold rõ.
3. **Event KWh Delta**: kwh_delta event-level sau canonical KWh resolution; có thể âm, không phải điện áp.
4. **Loaded Status vs KWh Evidence**: đối chiếu loaded state với actual/expected KWh để thấy loaded-zero/missing/inconsistency.

Y-axis cần adaptive focus cho data variation nhỏ nhưng giữ boundary đỏ/cam. Brush không reset khi SSE delta đến. UI không remount tab/page mỗi tick.

Energy Summary strip gồm KWh availability, 24h delta, KWh rate, energy consistency, data quality, KWh source, loaded-zero, negative KWh, missing KWh. Mixed raw fill nghĩa là có RAW và controlled fill, không che giấu provenance.

### 11.4 Recent Events

Recent Events (last 50) là table scrollable, không kéo page vô tận. Mỗi row: time, status, duration, KWh delta/source, gap, action level, L1 result, quality, final reason, actions View/Timeline/Explain. Null KWh là N/A, không phải 0. Delta update de-duplicate theo event ID/UID.

### 11.5 AI Explainability & Evidence

| Khối | Nội dung |
|---|---|
| Operational Evidence | action/judgment, L1 behavior, near-term L2 risk, status trigger |
| Energy & Data Evidence | KWh source/delta/rate, quality policy, energy/time flags |
| Final Reason (V2) | diễn giải tiếng Việt, action/confidence/L1/L2 và caveat quality |

Diễn giải tiếng Việt là presentation mapping; final_reason_v2 raw vẫn giữ cho audit. Panel không được gọi một evidence policy là nguyên nhân vật lý chắc chắn.

### 11.6 Các tab khác

| Tab | Nội dung |
|---|---|
| AI Analysis | decision stack L1 -> L2 -> quality -> Policy, contribution/evidence |
| Performance | duration, gap/overlap, throughput/status distribution |
| Energy | loaded-zero, loaded-missing, negative delta, KWh rate, rule checks; cabinet/location-level caveat |
| Events | filter/list/distribution event |
| Maintenance | maintenance/repair risks, evidence, planning priority/task |

---

## 12. AI Model Monitor và provenance

AI Model Monitor dành cho kỹ thuật/admin. Trang có 7 KPI, L1/L2 Train-Valid-Test performance, trend, funnel, 7-node decision flow, data contract health, decision trace và runtime strip.

Source priority:

1. runtime SQL/API và bounded audit thật;
2. validated model artifact/reference;
3. demo/simulated visualization chỉ khi không có runtime data.

Mock: DEMO DATA. API loading/not-ready: STARTING/NOT READY. API runtime/artifact/required source pass: OPERATIONAL. Status xanh không được suy ra từ demo chart. System Evaluation Status nằm trong sidebar Plant/System Status để luôn hiện xuyên các route.

---

## 13. Từ điển thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| Canonical event | event đã chuẩn hóa time/KWh/status/quality/context |
| Event-close inference | score event đã closed/resolved để duration/KWh ổn định |
| Segment | chuỗi liên tục của một machine, cắt bởi big gap/time invalid/open event |
| L1-ready | đủ 20 event valid cùng segment cho L1 |
| L2-ready | mọi feature bắt buộc L2 finite và đúng contract |
| Policy-ready | đã chạy L2 + Policy, có decision |
| Operational Action Level | ưu tiên CRITICAL/HIGH/MEDIUM/LOW |
| Operational Judgment | lý do nghiệp vụ chính cho action |
| Quality Action Level | yêu cầu validate data/energy, không phải fault level |
| Sensitive warning | strict-only L1 warning dùng audit |
| Source-aware | phân biệt historical, online SQL và replay source |
| Watermark | cặp event_start_time/event_id đã xử lý |
| Event UID | identity có source/run namespace tránh duplicate |

---

## 14. Bảo trì, kiểm thử và giới hạn

### 14.1 Gate an toàn

- Không log credential.
- File-only replay fail-closed nếu bất kỳ replay SQL write flag bật.
- Replay không dùng canary config và không động checkpoint production.
- Required SQL column validation trước transaction; writer online rollback nếu có lỗi.
- Candidate A, feature order, selected profile, threshold và policy được validate; không đổi model contract để làm test xanh.

### 14.2 Kiểm tra có trong dự án

Nhóm test gồm watermark ordering, same timestamp/different ID, resume/atomic commit/duplicate prevention, segment boundary, insufficient history, L2 feature order, policy filtering, replay clock/control, cache append/downsampling giữ anomaly, frontend delta merge, mock/API separation, typecheck, lint và API/mock build.

Parity report không được che mismatch. Không tuyên bố parity SQL pass nếu chưa chạy read-only credentialed comparison đúng scope.

### 14.3 Giới hạn cần truyền đạt

1. Cabinet/location KWh không chứng minh machine KWh nếu không có bridge.
2. L1 anomaly không phải fault diagnosis.
3. L2 risk là xác suất theo target/horizon, không phải certainty.
4. Policy hỗ trợ ưu tiên vận hành, không thay quyết định an toàn của con người.
5. Quality issue có thể yêu cầu kiểm tra data trước khi kết luận máy hỏng.
6. Event unready phải hiện No Data/Insufficient History, không suy ra Low.
7. AI Monitor demo chart chỉ là presentation nơi có provenance badge.
8. Historical replay mô phỏng event arrival, không biến historical thành telemetry realtime thật.

---

## 15. Bản đồ mã nguồn

### Data/AI/runtime

| File | Khi cần chỉnh |
|---|---|
| inference/online/config.replay.local.yaml | source view, tick/speed/window, replay file-only safety |
| inference/online/feature_builder_l1.py | canonical time/KWh/status/quality/segment |
| inference/online/data_contract.py | threshold/feature/invariant contract |
| inference/online/l1_scorer.py, l1_shadow.py | Candidate A profiles, window, score |
| inference/online/feature_builder_l2.py | L1-derived feature, anti-leakage |
| inference/online/l2_scorer.py | LightGBM selection, named feature order |
| inference/online/policy_engine.py | Policy v2 rules |
| inference/online/explainability.py | explanation contract |
| inference/replay/source.py | read-only query/watermark/context |
| inference/replay/processor.py | two-layer replay output |

### Backend

| File | Vai trò |
|---|---|
| backend/app/routers/replay.py | replay API/snapshot/delta/stream, machine-name enrichment |
| backend/app/replay_runtime.py | manifest/batch cache/ring buffer |
| backend/app/replay_controller.py | replay controls |
| backend/app/repositories/dashboard.py | dashboard query/normalization |
| backend/app/routers/demo.py | demo readiness/preflight |

### Frontend

| File | Vai trò |
|---|---|
| src/pages/DashboardPage.tsx | Dashboard grid và filters |
| src/components/dashboard/* | KPI, distribution, risk trend, quality, alerts |
| src/mappers/replayPresentationMapper.ts | replay readiness/risk distribution projection |
| src/pages/RuntimeMachineDetailWorkspace.tsx | machine workspace/API/replay/cache |
| src/components/machineDetail/* | Timeline, chart, evidence, table, tabs |
| src/hooks/useReplayFeed.ts | SSE/delta client |
| src/hooks/usePersistentBrushViewport.ts | preserve Brush khi data append |
| src/hooks/useAdaptiveEventViewport.ts | bounded visible chart points |
| src/utils/replayDensity.ts | append/de-duplicate/downsampling |

---

## Kết luận

Hệ thống được xây theo hướng truy vết được: raw event được chuẩn hóa có nguồn time/KWh rõ ràng; L1 phát hiện deviation theo cửa sổ 20 event cùng segment; L2 đánh giá sáu rủi ro cụ thể trên contract không leakage; Policy v2 tách rủi ro vận hành khỏi chất lượng dữ liệu; explanation mô tả rule/evidence có thể audit.

Dashboard giúp ưu tiên hành động trên toàn hệ thống. Machine Detail dùng cùng dữ liệu để trả lời vì sao một máy/event bị cảnh báo. Historical replay cho phép demo/kiểm thử trên SQL chỉ đọc, output file-first, checkpoint riêng và delta UI không cần reload toàn trang.

Mọi thay đổi canonical feature, L1/L2 artifact, threshold, production selection hoặc Policy v2 phải kèm contract validation, replay/parity review, kiểm tra source provenance và kiểm thử UI. Không được biến No Data, quality issue hoặc strict-only warning thành kết luận vận hành sai.
