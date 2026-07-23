# Weldcom AI Operations Control Center
## Bản đồ giao diện, thuật ngữ và Policy v2

**Phiên bản tài liệu:** 1.0  
**Phạm vi:** giao diện React/Vite hiện tại, dữ liệu hiển thị, phân biệt mock/API/replay và cơ chế quyết định Policy v2.  
**Mục tiêu:** để người vận hành, quản lý kỹ thuật và người bảo trì AI biết mỗi khối trên màn hình biểu thị gì, lấy từ đâu và không diễn giải sai rủi ro dữ liệu thành lỗi máy.

> Quy ước quan trọng: một event có cờ chất lượng dữ liệu hoặc năng lượng **không tự động có nghĩa máy hỏng**. Nhánh vận hành (`operational_*`) và nhánh chất lượng (`quality_*`) do Policy v2 tạo ra độc lập.

---

## 1. Chế độ dữ liệu và nguồn hiển thị

| Chế độ | Nguồn | Mục đích | Điều không được suy ra |
|---|---|---|---|
| `mock` | fixture cục bộ trong frontend | kiểm tra bố cục, thao tác, demo thiết kế | không phải dữ liệu nhà máy hay kết quả AI thật |
| `api` historical | FastAPI đọc SQL lịch sử và các view source-aware | xem kết quả đã lưu/đã đánh giá trong phạm vi lọc | không phải luồng realtime mặc định |
| `api` replay | replay file-first, snapshot/delta/SSE | mô phỏng event lịch sử xuất hiện dần theo đồng hồ ảo | không ghi SQL, không phải production realtime |
| AI Monitor hybrid | runtime/audit thật + artifact đã xác thực + demo visualization có badge | bảo trì, quan sát model | trend có badge demo không được dùng để quyết định health/runtime |

Mọi tooltip nguồn dữ liệu cần đọc theo thứ tự ưu tiên: **runtime SQL/audit thật**, **validated artifact**, rồi mới đến **demo/reference**. Demo không được ghi xuống SQL, không đi vào inference và không được dùng để làm hệ thống có trạng thái Healthy.

---

## 2. Khung ứng dụng chung

### 2.1 Sidebar

Sidebar là điều hướng cấp ứng dụng. Khi mở rộng hiển thị biểu tượng, nhãn và trạng thái Plant/System; khi thu gọn chỉ giữ biểu tượng và tooltip.

| Mục | Ý nghĩa |
|---|---|
| Dashboard | tổng quan rủi ro, chất lượng dữ liệu, cảnh báo và xu hướng vận hành |
| Control Room | không gian vận hành hằng ngày, ưu tiên event/cảnh báo mới |
| Machines | danh sách máy, trạng thái mới nhất, mức rủi ro và readiness |
| Machine Detail | drill-down theo một máy để trả lời “vì sao event này bị cảnh báo?” |
| Alerts | danh sách event cần hành động, có lọc và truy vết |
| Risk Analytics | phân tích xác suất L2, fault/maintenance/repair theo nhiều horizon |
| Data Quality | dữ liệu thiếu, thời gian bất thường, KWh và tính nhất quán |
| Energy Consistency | đối chiếu trạng thái tải và bằng chứng KWh |
| Maintenance | lập kế hoạch kiểm tra theo rủi ro maintenance/repair |
| AI Model Monitor | dành cho AI/admin: runtime, artifact, metric, flow, trace |
| Reports | điểm xuất báo cáo |
| Settings | cấu hình UI/datasource theo quyền phù hợp |

**Plant / System Status** ở đáy sidebar bao gồm plant, trạng thái vận hành, số máy active, pipeline, last updated và `SYSTEM EVALUATION STATUS`.

- `DEMO DATA` màu đỏ: frontend mock, không gọi backend.
- `STARTING` màu vàng: API đang tải hoặc runtime/artifact chưa đạt READY.
- `OPERATIONAL` màu xanh: API runtime đạt điều kiện health, artifact integrity và required monitor data đã sẵn sàng. Một số AI Monitor chart vẫn có thể là demo visualization; dòng provenance nói rõ điều này.
- Công tắc EN/VI dùng file bản dịch tĩnh theo ngữ cảnh nghiệp vụ, không gọi dịch máy.

### 2.2 Header và filters

Header hiển thị **Weldcom AI Operations Control Center** và subtitle về historical scoring/risk intelligence. Filter gồm date range, machines, locations, action level/status và nút Filters. Dropdown có chevron, trạng thái hover/active và danh sách option có z-index cao hơn panel.

Phạm vi filter phải được hiểu là phạm vi **truy vấn/hiển thị**, không thay đổi model, threshold hay Policy v2. Đổi phạm vi có thể lấy snapshot mới; trong replay, delta tiếp theo chỉ append/merge vào scope đang xem.

---

## 3. Dashboard / Control Room

Dashboard là trang điều phối. Ở mock, layout được giữ theo tỷ lệ reference cố định; ở API/replay, card có thể rộng/cao hơn để chịu được tên máy thật và event feed.

### 3.1 Hàng KPI

| KPI | Ý nghĩa | Nguồn trường chính |
|---|---|---|
| Operational Risk Score | rủi ro vận hành tổng hợp, thang 0–100 | `operational_overall_risk_score` |
| Total Active Machines | số active / tổng số máy trong phạm vi | machine/event eligibility |
| Critical / High Operational Alerts | event/máy có `operational_action_level` là CRITICAL hoặc HIGH | nhánh operational của Policy v2 |
| Data Quality Issues | event cần kiểm tra dữ liệu hoặc năng lượng | `quality_action_level`, `data_quality_issue_flag`, `quality_risk_score` |
| Maintenance / Repair Risk | tín hiệu maintenance/repair có mức đáng chú ý | `risk_maintenance_30_events`, `risk_repair_30_events` |

Sparkline chỉ biểu thị xu hướng trong phạm vi, không thay thế biểu đồ đầy đủ. Delta là so sánh với cửa sổ trước đó khi nguồn dữ liệu có hỗ trợ; “Comparison unavailable” không phải giá trị 0.

### 3.2 Machine Risk Distribution

Donut phân phối **máy** theo action level mới nhất có thể dùng trong phạm vi:

- `Critical`: cần ưu tiên can thiệp hoặc có known fault/near-term fault rất mạnh.
- `High`: rủi ro pre-fault/repaired-related cao, cần xử lý sớm.
- `Medium`: cần theo dõi có kế hoạch; có thể do fault 60 phút, maintenance hoặc anomaly L1.
- `Low`: mức rủi ro vận hành thấp hiện tại, không đồng nghĩa “machine khỏe tuyệt đối”.
- `No Data`: không có event đủ điều kiện L1 + L2 + Policy trong phạm vi. Mục này được giữ để tổng donut luôn khớp số máy được monitor.

Số trung tâm là tổng máy trong phân phối. Legend là `nhãn — số máy (tỷ lệ làm tròn)`. Hover từng sector làm sector đó nổi và các sector khác dịu đi; tooltip cho số máy/mức rủi ro. Trong mock, donut và legend dùng layout compact một hàng như thiết kế gốc; API/replay không dùng compact vì phải chứa machine/name thật.

### 3.3 Operational Risk Over Time

Area/line chart là trung bình `operational_overall_risk_score` theo bucket thời gian. Các đường đứt:

- LOW: 35.
- MEDIUM: 65.
- HIGH / CRITICAL: 80.

Tooltip hiển thị date/time bucket, `avg_risk_score`, số Critical, số High và máy đứng đầu. Dropdown chọn Daily/Hourly/Weekly. Brush bên dưới là cửa sổ xem; việc người dùng kéo brush được giữ qua delta mới cho tới khi họ chủ động reset/đổi granularity. Với replay/API có thể dùng trục focus để làm rõ dao động nhỏ nhưng nhãn/đường policy vẫn biểu diễn giá trị rủi ro gốc.

### 3.4 Top Machines by Risk

Bar chart ngang xếp hạng. Dropdown thay tiêu chí:

- Top by current risk.
- Top by critical count.
- Top by maintenance risk.
- Top by data quality issue.

Màu bar theo rủi ro: đỏ Critical, cam High, vàng Medium, xanh Low. API/replay hiển thị `machine_call_name`/tên máy và ID phụ để tránh nhầm lẫn; mock reference dùng mã WLD ngắn để giữ đúng tỷ lệ layout. Click một hàng đi tới Machine Detail với machine context.

### 3.5 L1 Anomaly Status

Ring chart phân chia `Normal`, `Anomaly`, `No Data / Insufficient History`. Đây là **behavioral deviation**, không phải kết luận hỏng máy:

- Normal: score lenient không vượt production threshold.
- Anomaly: `is_behavior_anomaly=1` từ profile lenient.
- No Data: chưa đủ window 20 event cùng machine/segment hoặc dữ liệu không đủ contract.

Con số trung tâm là tỷ lệ Normal/Anomaly theo thiết kế hiển thị. Dải line phía đáy là trend ngắn. Strict-only warning không được tự nâng operational action; nó là sensitive/audit signal.

### 3.6 L2 Fault Confidence

Ring phân nhóm confidence từ output L2: High >=80%, Medium 50–79%, Low <50%. Card không thay Policy v2: một probability cao chỉ trở thành action khi vượt **threshold target** hoặc có evidence rule phù hợp. Trend đáy dùng để phát hiện thay đổi liên tục thay vì đọc một event đơn lẻ.

### 3.7 Quality Issue Trend

Stacked bar theo ngày/giờ, gồm:

- `CHECK_DATA`: kiểm tra dữ liệu.
- `CHECK_ENERGY`: kiểm tra mâu thuẫn năng lượng.
- `CHECK_DATA_AND_ENERGY`: hai nhánh cùng có vấn đề.
- `QUALITY_OK`: không có cờ quality được nhận diện.

Dropdown đổi Last 7 Days/Last 30 Days; Brush giữ viewport người dùng. Đây không phải biểu đồ fault machine.

### 3.8 Data Quality Overview

Bốn mini-card và sparkline:

- Completeness: tỷ lệ trường/event cần thiết hiện diện.
- Timeliness: tính kịp thời/thời gian event hợp lệ.
- Consistency: sự nhất quán giữa status, KWh, time/context.
- Accuracy: chỉ số accuracy khi nguồn có định nghĩa và bằng chứng.

`View Details` điều hướng Data Quality Center. Sparkline chỉ là tóm tắt; tooltip/source phải được xem trước khi dùng làm chỉ số SLA.

### 3.9 Operational Alerts in Historical Dataset

Bảng event có Machine, Location, Action Level, Operational Judgment, Fault risk 30min, Maintenance risk, Repair risk, Quality Judgment, L1 Anomaly, Final Reason, Event Time và Actions.

- Badge action là nhánh operational; badge quality là nhánh data/energy.
- Mini sparkline trong risk cell là thay đổi gần đây của risk, không phải xác suất mới tính trong browser.
- View Detail mở Machine Detail; các icon timeline/explain là điểm mở rộng cho drill-down.
- Sticky header và vùng cuộn giới hạn làm bảng không đẩy toàn trang quá dài.

---

## 4. Machine Detail

Màn này trả lời câu hỏi: **máy này/cảnh báo này vì sao đáng chú ý?** Header và filter chỉ thay context hiển thị, không tái huấn luyện model.

### 4.1 Header máy và metric cards

Các card thể hiện Machine ID/call name, Location, Machine Group, Current Status, Risk Fault 30min, L1 Anomaly Score, Max L2 Confidence, Data Quality và Energy Consistency. Mỗi card có tooltip và sparkline khi có chuỗi. Giá trị phải được format theo domain: percentage, KWh, duration hoặc score; không hiển thị dãy thập phân thô.

### 4.2 Thanh replay/live

Trong API replay, panel cho biết trạng thái Live/Paused, virtual time, batch, số event cache, density reduction và readiness L1/L2/policy. Các nút Event spacing, Time spacing, Auto-follow, Pause, Step, Jump to latest tác động **viewport client**, không làm thay đổi timestamp gốc, policy hoặc dữ liệu SQL.

- Event spacing: các event cách đều trên trục X, dễ quan sát live demo.
- Time spacing: khoảng cách theo timestamp thật.
- Auto-follow: khi đang xem latest thì theo event mới; khi người dùng đã xem quá khứ thì hiện badge event mới thay vì kéo viewport.

### 4.3 Tab Timeline

1. **Operational Timeline:** dải trạng thái event theo màu ON (Loaded), ON (No-load), OFF, Fault, Maintenance, Data issue. Marker trên dải nêu event quan trọng như anomaly, fault, energy/data issue. Khi event nhiều, dải được density-reduce nhưng marker trọng yếu vẫn giữ event-time.
2. **L1 Anomaly Score Over Time:** line score L1 với ngưỡng lenient/strict; brush/bars đáy thể hiện phân bố/biên độ event và cho phép chọn window.
3. **L2 Risks Over Time:** rủi ro fault/maintenance/repair; legend cho phép hiểu từng đường.
4. **Event KWh Delta:** chênh lệch KWh event-level thực tế so với giá trị xử lý/model context. Giá trị âm có thể hợp lệ vì đây là delta/chênh lệch, không phải “số điện tiêu thụ âm”.
5. **Loaded Status vs KWh Evidence:** đối chiếu trạng thái loaded với actual/expected KWh để tìm loaded-zero, missing, rate outlier hoặc inconsistency.
6. **Energy summary strip:** KWh availability; delta 24h; rate trung bình; energy consistency; data quality; nguồn KWh; loaded-zero; negative delta; missing KWh.
7. **Recent Events:** 50 event gần nhất với status, duration, delta, KWh source, gap, action, L1 result, quality, final reason và actions.
8. **AI Explainability & Evidence:** evidence operational; energy/data; final reason; action level; confidence; L1/L2. Nội dung tiếng Việt diễn giải rule/evidence, không tuyên bố SHAP nếu hệ thống không có SHAP.

### 4.4 Tab AI Analysis

Hiển thị AI decision stack: L1 deviation gate, L2 fault confidence, quality policy và final policy gate; biểu đồ L1/L2, risk contribution và AI explainability. Mục tiêu là tách “tín hiệu model” khỏi “hành động Policy”. Tooltip chart nêu raw/normalized score, threshold, source và timestamp.

### 4.5 Tab Performance

Tập trung duration, gap từ event trước, overlap, rate/throughput và các bất thường time/event. Big gap, overlap hay duration invalid là evidence/quality context; không tự biến thành fault nếu Policy không xác định như vậy.

### 4.6 Tab Energy

Tập trung KWh delta/rate, loaded-but-zero, loaded-without-KWh, negative delta và energy consistency. Nếu nguồn cabinet/location-level được dùng, UI phải ghi rõ phạm vi, không gán trực tiếp KWh cabinet cho một machine.

### 4.7 Tab Events

Tóm tắt phân bố status, high/critical, anomaly, missing KWh và bảng event theo context máy hiện tại. Filter tab chỉ lọc bảng/chart của máy, không gọi lại tất cả historical dataset.

### 4.8 Tab Maintenance

Hiển thị maintenance/repair risk trend, maintenance signals và task cards. `maintenance risk` là xác suất/dấu hiệu cần kiểm tra; chưa phải work order đã phát hành.

---

## 5. AI Model Monitor

Trang dành cho AI/admin, không phải màn vận hành ra lệnh trực tiếp. Cùng một presentation được dùng ở mock/API; chỉ DTO/provider và provenance khác nhau.

### 5.1 Bảy KPI

1. AI Runtime Status.
2. L1 Scoring Coverage.
3. L1 Anomaly / Warning Rate.
4. L2 Positive Prediction Rate.
5. Calibration & Threshold Health.
6. Data / Feature Drift.
7. Scoring Run Success Rate.

Mỗi KPI có value source, trend source, scope label và tooltip. Badge nguồn ở header/footer riêng để không chồng subtitle. `DEMO REFERENCE`/`SIMULATED TREND` không được tô màu như metric validated/live.

### 5.2 L1 Performance

Candidate A có hai profile: **lenient** là production primary và **strict** là sensitive/audit. TRAIN/VALID/TEST phải đổi đúng split, không lấy số từ split khác thay thế. Các metric gồm Normal FPR, Known-fault Recall, Precision, F1, Accuracy, AUROC, Support.

### 5.3 L2 Performance

L2 là LightGBM multi-label với đúng sáu target. Bảng hiển thị Target, Profile, Threshold, AP, Normal FPR, Known-fault Recall, Precision, F1, Accuracy, AUROC, Support. Unit cần chuẩn hóa:

- `ratio_0_1`: nhân 100 khi hiển thị `%`.
- `percent_0_100`: giữ nguyên `%`.
- `probability_0_1`: ba số thập phân, không thêm `%`.
- `events`: số nguyên có dấu phân tách.
- `loss`: 4–5 số thập phân.
- null: `Not available`, không giả là 0.

### 5.4 Các chart reference

- L1 train/validation reconstruction loss.
- L1 threshold stability.
- L1 score distribution by split.
- L2 production threshold by target.
- L2 AP by split.
- L2 AUROC/F1 by target.
- L2 Positive Prediction Rate by Target.
- Scoring Run Success/Failure Trend.
- Feature Availability/Missing Rate Trend.
- Scoring Funnel.
- Seven-node AI 2-layer decision flow.
- Example Decision Trace.
- Runtime footer và Latest Bounded Inference.

Series chart dùng `seriesConfig` với `key`, nhãn thân thiện, unit, axis và source. Không hiển thị raw camelCase như `lenientTrainLoss` cho operator. Các chart demo có tooltip “For presentation only”.

---

## 6. Policy v2: định nghĩa, vị trí và tác dụng

### 6.1 Policy v2 là gì?

**Policy v2 không phải model AI thứ ba.** Đây là lớp luật quyết định có thể kiểm tra (deterministic policy engine) nhận output L1, sáu xác suất L2, trạng thái/known evidence và cờ data-quality/energy để tạo kết luận vận hành có thể hành động.

Tên cấu hình đang dùng:

`policy_v2_operational_quality_split_sensitive_audit_only`

Ý nghĩa tên:

- `operational_quality_split`: tách outcome vận hành khỏi outcome chất lượng dữ liệu/năng lượng.
- `sensitive_audit_only`: strict-only sensitive warning được ghi lại để audit, **không tự nâng action operational**.

### 6.2 Policy nằm ở đâu?

| Thành phần | Vai trò |
|---|---|
| `inference/online/policy_engine.py` | hàm `apply_policy_v2`, công thức action/judgment/quality/final reason |
| `inference/online/score_new_events.py` | gọi policy sau canonical + L1 + L2 trong online/stage flow |
| `inference/replay/processor.py` | gọi policy trong historical replay file-first |
| `inference/online/explainability.py` | tạo explanation JSON, triggered/suppressed rules và evidence contribution |
| `inference/online/config*.yaml` | khai báo `project.policy_version` |
| SQL historical result/view | lưu hoặc cung cấp các cột `operational_*`, `quality_*`, `final_reason_v2`, `policy_version` |

Browser không tự tính Policy v2. Dashboard/Machine Detail chỉ hiển thị result đã được backend/replay gửi về.

### 6.3 Sáu đầu ra L2 và cách đọc tên rút gọn

| UI short name | Cột đầy đủ | Câu hỏi model trả lời |
|---|---|---|
| fault10e | `risk_fault_10_events` | có khả năng fault trong 10 event kế tiếp không? |
| fault30e | `risk_fault_30_events` | có khả năng fault trong 30 event kế tiếp không? |
| **fault30m** | `risk_fault_30min` | có khả năng fault trong 30 phút tới không? |
| **fault60m** | `risk_fault_60min` | có khả năng fault trong 60 phút tới không? |
| **maintenance30e** | `risk_maintenance_30_events` | có khả năng maintenance trong 30 event kế tiếp không? |
| **repair30e** | `risk_repair_30_events` | có khả năng repair trong 30 event kế tiếp không? |

Hậu tố `e` là **events**, hậu tố `m` là **minutes**. Giá trị risk là xác suất/score model theo target, không phải phần trăm thời gian máy sẽ hỏng. Mỗi target có production threshold riêng, không được dùng cùng một threshold chung.

### 6.4 Policy tạo prediction threshold như thế nào?

Với từng target, policy lấy probability `risk_*`, lấy threshold từ selected L2 profile, trừ epsilon rất nhỏ để tránh lỗi số thực sát ngưỡng, sau đó tạo `policy_pred_* = 1` khi probability >= policy threshold.

Các threshold production hiện tại:

| Target | Threshold |
|---|---:|
| fault within 10 events | 0.130 |
| fault within 30 events | 0.072 |
| fault within 30 minutes | 0.071 |
| fault within 60 minutes | 0.082 |
| maintenance within 30 events | 0.109 |
| repair within 30 events | 0.072 |

Threshold thấp không tự nói model kém; nó là profile/calibration đã chọn cho từng target mất cân bằng khác nhau.

### 6.5 Quy tắc action level operational

Theo `apply_policy_v2`:

1. **CRITICAL** khi có known fault, OFF-with-fault hoặc `fault10e` vượt threshold.
2. **HIGH** khi chưa Critical và `fault30m`, `fault30e` hoặc `repair30e` vượt threshold.
3. **MEDIUM** khi chưa Critical/High và `fault60m`, `maintenance30e`, known maintenance hoặc L1 behavior anomaly xuất hiện.
4. **LOW** cho các trường hợp còn lại.

Điều này giải thích vì sao `fault30m` thường được ưu tiên trên Dashboard: đó là horizon ngắn, đồng thời trực tiếp có thể dẫn đến HIGH nếu chưa có lý do Critical.

### 6.6 Operational judgment

`operational_judgment` giải thích kiểu nguyên nhân chính của action:

| Judgment | Điều kiện ưu tiên |
|---|---|
| `KNOWN_FAULT_CONFIRMED` | known fault hoặc off-with-fault |
| `PRE_FAULT_CRITICAL_NEAR_TERM` | fault10e vượt threshold |
| `PRE_FAULT_HIGH_CONFIDENCE` | fault30m hoặc fault30e vượt threshold |
| `REPAIR_RELATED` | repair30e vượt threshold hoặc known repair |
| `PRE_FAULT_MEDIUM_CONFIDENCE` | fault60m vượt threshold |
| `MAINTENANCE_RELATED` | maintenance30e vượt threshold hoặc known maintenance |
| `UNKNOWN_BEHAVIOR_ANOMALY` | L1 lenient behavior anomaly |
| `NORMAL_LIKE` | không có điều kiện trên |

Action level là mức ưu tiên; judgment là lý do nghiệp vụ nổi bật. Chúng liên quan nhưng không đồng nghĩa một-một.

### 6.7 Nhánh quality độc lập

Policy đồng thời đọc `data_quality_issue_flag`, `energy_inconsistency_flag`, `kwh_quality_issue_flag`, `time_quality_issue_flag` để tạo:

| Quality action | Ý nghĩa |
|---|---|
| `CHECK_DATA_AND_ENERGY` | data issue và energy inconsistency cùng xuất hiện |
| `CHECK_DATA` | data issue |
| `CHECK_ENERGY` | energy inconsistency |
| `CHECK_DATA_DETAIL` | KWh/time quality issue cần kiểm tra chi tiết |
| `QUALITY_OK` | không có cờ quality đã biết |

`quality_judgment` cung cấp mã diễn giải tương ứng: `DATA_QUALITY_ISSUE`, `ENERGY_INCONSISTENCY`, `KWH_QUALITY_ISSUE`, `TIME_QUALITY_ISSUE`, `DATA_AND_ENERGY_QUALITY_ISSUE`, hoặc `QUALITY_OK`. `quality_risk_score` là thang policy evidence nội bộ, không phải output L2.

### 6.8 Overall score, final reason và explanation

`operational_overall_risk_score` là max của operational fault confidence, maintenance confidence và repair confidence. Nó làm nổi bật rủi ro lớn nhất, nhưng không thay thế action rule.

`final_reason_v2` lưu chuỗi machine-readable gồm operational judgment/action và quality judgment/action. `explanation_json` giải thích thêm:

- trạng thái readiness L1/L2/policy;
- raw/normalized L1 lenient/strict, threshold và margin;
- sáu probability L2, threshold, prediction và margin;
- evidence status, duration, gap/overlap, KWh, source KWh, quality flags;
- rule đã trigger và strict-only rule bị suppress;
- contribution theo evidence rule, **không phải SHAP**.

### 6.9 Trình tự chạy một event

1. Canonical builder chuẩn hóa event và feature/context.
2. Kiểm tra segment và đủ 20 event để chạy L1.
3. L1 Candidate A lenient/strict tạo score/anomaly/warning.
4. L2 chạy sáu model theo feature order đã khóa.
5. Policy v2 tạo prediction flags, action/judgment và quality branch.
6. Explainability xây explanation JSON từ chính output/evidence đó.
7. Replay lưu file-first hoặc online pipeline dùng writer đã được gate riêng. UI chỉ đọc result đã hoàn chỉnh.

---

## 7. Thuật ngữ dữ liệu quan trọng

| Thuật ngữ | Nghĩa thực tế |
|---|---|
| canonical event | event đã chuẩn hóa từ raw IoT, status, time, KWh và context để model có input thống nhất |
| readiness | event có đủ điều kiện feature/window/model để chạy một tầng hay policy hay không |
| `INSUFFICIENT_HISTORY_IN_SEGMENT` | chưa đủ 20 event trong cùng segment; không phải lỗi feature contract |
| L1 anomaly | deviation behavior từ lenient production profile |
| sensitive warning | strict-only warning, phục vụ audit; không nâng action operational một mình |
| policy-ready | L2 và Policy có output hợp lệ cho event |
| source-aware view | view hợp nhất nguồn historical và online/replay theo rule source, tránh đọc nhầm/duplicate |
| event UID | định danh duy nhất theo source, ví dụ historical/replay/online để không đụng `event_id` |
| historical replay | tái phát lịch sử bằng virtual clock, file-first và SQL read-only |

---

## 8. Bản đồ mã giao diện

| Khu vực | Mã chính |
|---|---|
| App routing/data provider | `src/App.tsx`, `src/providers/*`, `src/services/*` |
| Layout/sidebar/header | `src/components/layout/Sidebar.tsx`, `Header.tsx` |
| Dashboard | `src/pages/DashboardPage.tsx`, `src/components/dashboard/*` |
| Replay UI | `src/components/replay/*`, `src/hooks/useReplayFeed.ts` |
| Machine Detail | `src/components/machineDetail/*`, `src/pages/RuntimeMachineDetailWorkspace.tsx` |
| AI Monitor | `src/components/aiModelMonitor/*`, `src/mappers/hybridModelMonitorMapper.ts` |
| Shared style | `src/index.css`, AI monitor style modules nếu có |
| Policy | `inference/online/policy_engine.py` |
| Explanation | `inference/online/explainability.py` |
| Replay policy invocation | `inference/replay/processor.py` |

---

## 9. Các giới hạn cần nhớ khi demo

1. Mock đẹp về bố cục nhưng không là evidence vận hành.
2. API/replay có thể có event thưa/dày và dao động nhỏ; chart có viewport/brush/density để không bóp méo dữ liệu.
3. Không coi data quality issue là machine fault.
4. Không coi strict-only warning là lệnh dừng máy.
5. Không thay threshold, Candidate A, sáu target L2 hoặc Policy v2 chỉ để làm dashboard “đẹp”.
6. Replay file-only không được ghi SQL; canary/SQL writer có config/gate và checkpoint riêng.

