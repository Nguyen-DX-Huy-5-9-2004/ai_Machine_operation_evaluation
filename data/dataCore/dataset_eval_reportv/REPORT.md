# Báo cáo đánh giá dataset AI vận hành Weldcom

## 1. Mục tiêu đánh giá

Báo cáo này đánh giá hai dataset L1 và L2 sau khi sinh từ SQL để chuẩn bị chọn chiến thuật train mô hình AI. Mục tiêu là kiểm tra đủ dòng, đủ cột, chất lượng thời gian, chất lượng KWh, phân bố status, phân bố bằng chứng lỗi/bảo trì và liên kết 1-1 qua event_id.

## 2. Quan điểm bài toán

Đối tượng chính là máy theo machine_id. Mỗi dòng là một event/khoảng trạng thái của máy. status_id vừa là token chuỗi vận hành cho L1, vừa là weak label/bằng chứng cho L2. Các status 6,7,9,10 là bằng chứng lỗi rõ, nhưng không nên biến toàn bộ hệ thống thành bài toán nhãn đơn giản vì dữ liệu có gap, KWh thiếu, thời gian sửa, bảo trì và trạng thái vận hành có nhiễu.

## 3. Tổng quan dòng/cột

| dataset | rows | columns | path |
| --- | --- | --- | --- |
| l1 | 4062118 | 54 | C:\Users\huynd1\Downloads\OBAD\data\dataCore\ai_l1_operation_event_sequence.csv |
| l2 | 4062118 | 74 | C:\Users\huynd1\Downloads\OBAD\data\dataCore\ai_l2_fault_confidence_event.csv |

## 4. Kiểm tra liên kết L1-L2

| set_check_enabled | l1_unique_event_id_count | l2_unique_event_id_count | l1_duplicate_event_id_count | l2_duplicate_event_id_count | l2_not_in_l1_count | l1_not_in_l2_count |
| --- | --- | --- | --- | --- | --- | --- |
| True | 4062118 | 4062118 | 0 | 0 | 0 | 0 |

## 5. Phân bố status_id L1

| status_id | row_count | pct |
| --- | --- | --- |
| 3 | 1686632 | 41.5210 |
| 2 | 1683934 | 41.4546 |
| 1 | 660927 | 16.2705 |
| 6 | 8027 | 0.1976 |
| 8 | 6117 | 0.1506 |
| 4 | 5925 | 0.1459 |
| 5 | 5399 | 0.1329 |
| 7 | 4920 | 0.1211 |
| 9 | 145 | 0.0036 |
| 10 | 92 | 0.0023 |

## 6. Nguồn xử lý thời gian L1

| value | row_count | pct |
| --- | --- | --- |
| RAW | 3414015 | 84.0452 |
| NEXT_EVENT_START_FROM_INVALID_RAW | 606403 | 14.9282 |
| NEXT_EVENT_START_FROM_NULL | 41686 | 1.0262 |
| OPEN_EVENT | 14 | 0.0003 |

## 7. Nguồn KWh sau xử lý

### KWh start source

| value | row_count | pct |
| --- | --- | --- |
| RAW | 1796660 | 44.2296 |
| MISSING | 1544621 | 38.0250 |
| PREV_EVENT_END | 720837 | 17.7453 |

### KWh end source

| value | row_count | pct |
| --- | --- | --- |
| RAW | 1796698 | 44.2306 |
| MISSING | 1560305 | 38.4111 |
| NEXT_EVENT_START | 705115 | 17.3583 |

## 8. Numeric stats L1

| column | count | null | mean | min | max |
| --- | --- | --- | --- | --- | --- |
| duration_sec | 4062104 | 14 | 131.3497 | 0.0000 | 3,636,548.0000 |
| gap_from_prev_sec | 4062104 | 14 | -14.6301 | -372,307.0000 | 32,228.0000 |
| overlap_sec | 4062118 | 0 | 14.6558 | 0.0000 | 372,307.0000 |
| kwh_delta | 2057308 | 2004810 | 0.1456 | -0.6000 | 547.5000 |
| kwh_delta_model_value | 4062118 | 0 | 0.0738 | -0.6000 | 547.5000 |
| kwh_rate_per_hour | 2056832 | 2005286 | 16.3397 | -0.1645 | 336,600.0000 |

## 9. Tổng quan theo máy L1

| machine_id | row_count | segment_count_est | first_event_time | last_event_time | kwh_available_flag_pct | kwh_missing_flag_pct | kwh_imputed_or_missing_flag_pct | loaded_zero_kwh_flag_pct | loaded_without_kwh_flag_pct | is_gap_pct | is_big_gap_pct | is_overlap_pct | duration_sec_mean | gap_from_prev_sec_mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 11 | 510483 | 189 | 2025-04-21 23:59:59 | 2026-06-19 13:43:24.000 | 51.4797 | 48.5203 | 55.7725 | 16.0080 | 18.7285 | 0.0006 | 0.0002 | 14.5501 | 85.8444 | -14.1541 |
| 36 | 483093 | 208 | 2025-04-21 23:59:59 | 2026-06-19 13:43:41.000 | 51.6104 | 48.3896 | 53.5009 | 17.5287 | 18.3789 | 0.0004 | 0.0000 | 14.4815 | 91.9233 | -16.1683 |
| 37 | 599149 | 253 | 2025-04-21 23:59:59 | 2026-03-05 07:24:02.833 | 57.7309 | 42.2691 | 50.9858 | 14.9809 | 12.9786 | 0.0005 | 0.0000 | 20.2183 | 55.5600 | -9.8026 |
| 45 | 589405 | 314 | 2025-04-21 23:59:59 | 2026-06-19 13:43:38.000 | 53.1041 | 46.8959 | 51.5506 | 18.3466 | 17.0430 | 0.0005 | 0.0002 | 15.0223 | 73.1483 | -11.0574 |
| 46 | 180094 | 31 | 2025-04-21 23:59:59 | 2026-06-19 13:05:52.000 | 78.3757 | 21.6243 | 46.1070 | 21.2428 | 3.4971 | 0.0017 | 0.0006 | 8.5622 | 216.1879 | -12.9910 |
| 47 | 89205 | 2 | 2025-04-21 23:59:59 | 2026-06-19 13:05:53.000 | 20.0325 | 79.9675 | 81.1647 | 5.6802 | 38.1604 | 0.0022 | 0.0000 | 5.4806 | 426.0069 | -15.7747 |
| 48 | 360258 | 99 | 2025-04-21 23:59:59 | 2026-06-19 13:43:38.000 | 51.7932 | 48.2068 | 54.5776 | 15.8187 | 16.6880 | 0.0006 | 0.0006 | 20.5422 | 118.0919 | -16.5072 |
| 49 | 30640 | 31 | 2025-04-21 23:59:59 | 2026-06-19 13:05:53.000 | 39.8074 | 60.1926 | 63.3290 | 6.0836 | 18.1789 | 0.0033 | 0.0000 | 12.4869 | 1,284.9667 | -90.5950 |
| 50 | 581760 | 140 | 2025-04-21 23:59:59 | 2026-06-19 13:05:53.000 | 24.3692 | 75.6308 | 76.6840 | 8.2897 | 32.4147 | 0.0015 | 0.0002 | 15.5549 | 74.1548 | -11.2519 |
| 51 | 39188 | 2 | 2025-04-21 23:59:59 | 2026-06-19 13:05:53.000 | 7.9871 | 92.0129 | 92.1940 | 2.8963 | 37.7156 | 0.0026 | 0.0000 | 13.9660 | 1,005.9002 | -72.0611 |
| 56 | 336227 | 55 | 2025-04-21 23:59:59 | 2026-06-19 13:42:27.000 | 64.1061 | 35.8939 | 40.8120 | 13.7773 | 8.6213 | 0.0000 | 0.0000 | 16.7229 | 126.3671 | -17.5220 |
| 58 | 105448 | 36 | 2025-04-21 23:59:59 | 2026-06-19 13:43:50.000 | 67.1781 | 32.8219 | 42.7699 | 11.1875 | 10.8063 | 0.0000 | 0.0000 | 11.5583 | 377.8530 | -30.7912 |
| 59 | 57699 | 2 | 2025-04-21 23:59:59 | 2026-06-19 13:05:53.000 | 38.1133 | 61.8867 | 67.5523 | 14.7004 | 25.5568 | 0.0000 | 0.0000 | 0.0953 | 651.9921 | -17.7525 |
| 67 | 99469 | 2 | 2026-03-24 00:05:12 | 2026-06-19 13:43:11.000 | 75.6195 | 24.3805 | 38.1626 | 23.4927 | 11.9997 | 0.0000 | 0.0000 | 0.0292 | 76.0734 | -0.0099 |

## 10. Phân bố bằng chứng L2

| status_evidence_class | row_count | pct |
| --- | --- | --- |
| NORMAL_NO_LOAD_PRODUCTION | 1683934 | 41.4546 |
| NORMAL_LOADED_PRODUCTION | 1083912 | 26.6834 |
| POWER_ON_NEAR_ZERO | 660927 | 16.2705 |
| ENERGY_INCONSISTENCY | 602721 | 14.8376 |
| REPAIR_STATUS | 12947 | 0.3187 |
| MAINTENANCE_STATUS | 11324 | 0.2788 |
| NORMAL_POWER_OFF | 6116 | 0.1506 |
| OFF_WITH_FAULT | 237 | 0.0058 |

## 11. Chất lượng dữ liệu L2

| data_quality_reason | row_count | pct |
| --- | --- | --- |
| KWH_MISSING | 1604247 | 39.4929 |
| OK | 1579505 | 38.8838 |
| OVERLAP_EVENT | 616519 | 15.1773 |
| KWH_IMPUTED | 260496 | 6.4128 |
| NON_POSITIVE_DURATION | 1330 | 0.0327 |
| OPEN_EVENT | 14 | 0.0003 |
| BIG_GAP | 6 | 0.0001 |
| NEGATIVE_KWH_DELTA | 1 | 0.0000 |

## 12. Tổng quan theo máy L2

| machine_id | row_count | known_fault_status_pct | known_maintenance_status_pct | known_repair_status_pct | off_with_fault_status_pct | data_quality_issue_flag_pct | time_quality_issue_flag_pct | kwh_quality_issue_flag_pct | energy_inconsistency_flag_pct | loaded_energy_unavailable_flag_pct | fault_evidence_count_mean | maintenance_evidence_count_mean | data_quality_issue_count_mean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 11 | 510483 | 0.3344 | 0.4357 | 0.3336 | 0.0008 | 62.1364 | 22.2752 | 55.7842 | 16.0080 | 18.7285 | 0.1668 | 0.0077 | 1.0922 |
| 36 | 483093 | 0.2004 | 0.3399 | 0.1993 | 0.0010 | 60.0684 | 22.2315 | 53.5116 | 17.5287 | 18.3789 | 0.1793 | 0.0054 | 1.0887 |
| 37 | 599149 | 0.1524 | 0.9694 | 0.1509 | 0.0015 | 60.4865 | 30.9012 | 50.9983 | 14.9809 | 12.9786 | 0.1529 | 0.0112 | 1.1539 |
| 45 | 589405 | 0.2733 | 0.5791 | 0.2706 | 0.0027 | 58.6054 | 22.9720 | 51.5615 | 18.3466 | 17.0430 | 0.1889 | 0.0085 | 1.0746 |
| 46 | 180094 | 0.2615 | 0.4903 | 0.2493 | 0.0122 | 48.0221 | 12.9560 | 46.1081 | 21.2428 | 3.4971 | 0.2177 | 0.0074 | 0.7915 |
| 47 | 89205 | 0.0269 | 0.0796 | 0.0045 | 0.0224 | 82.0649 | 8.3751 | 81.1647 | 5.6802 | 38.1604 | 0.0573 | 0.0008 | 1.0986 |
| 48 | 360258 | 0.6121 | 0.6246 | 0.6082 | 0.0039 | 63.1095 | 31.5077 | 54.5795 | 15.8187 | 16.6880 | 0.1704 | 0.0123 | 1.1934 |
| 49 | 30640 | 0.3949 | 0.3753 | 0.2905 | 0.1044 | 66.4360 | 18.9654 | 63.3322 | 6.0836 | 18.1789 | 0.0687 | 0.0067 | 1.1538 |
| 50 | 581760 | 0.1274 | 0.5655 | 0.1257 | 0.0017 | 79.7898 | 23.4213 | 76.6911 | 8.2897 | 32.4147 | 0.0854 | 0.0069 | 1.2137 |
| 51 | 39188 | 1.4009 | 1.3907 | 1.3652 | 0.0357 | 92.8601 | 21.0549 | 92.1940 | 2.8988 | 37.7156 | 0.0570 | 0.0276 | 1.2416 |
| 56 | 336227 | 0.4910 | 0.4768 | 0.4753 | 0.0158 | 48.0672 | 25.9316 | 40.8177 | 13.7773 | 8.6213 | 0.1476 | 0.0095 | 0.9783 |
| 58 | 105448 | 1.5942 | 1.5904 | 1.5828 | 0.0114 | 48.6809 | 17.3498 | 42.7727 | 11.1875 | 10.8063 | 0.1438 | 0.0317 | 0.8555 |
| 59 | 57699 | 0.0711 | 0.0589 | 0.0295 | 0.0416 | 67.5956 | 0.1387 | 67.5523 | 14.7004 | 25.5568 | 0.1484 | 0.0009 | 0.8824 |
| 67 | 99469 | 0.5037 | 0.8123 | 0.5017 | 0.0020 | 38.1777 | 0.0462 | 38.1636 | 23.4927 | 11.9997 | 0.2450 | 0.0131 | 0.5585 |

## 13. Đánh giá chiến thuật mô hình

L1 nên là Behavior Anomaly Detection theo chuỗi event của từng máy, dùng sliding window theo machine_id + sequence_segment_id + event_order_in_segment. L2 nên là Fault Confidence/Fault Judgment, sử dụng output L1 cộng với bằng chứng status, KWh và data quality. Nếu phân bố nhãn lỗi đủ nhiều, L2 có thể mở rộng thành multi-label/multi-class: normal, fault, repair, maintenance-related, data-quality-issue.

## 14. File CSV chi tiết đã xuất

- `event_id_consistency.csv`

- `l1_column_profile.csv`

- `l1_current_signal_code_distribution.csv`

- `l1_end_time_source_distribution.csv`

- `l1_kwh_end_source_distribution.csv`

- `l1_kwh_start_source_distribution.csv`

- `l1_machine_summary.csv`

- `l1_numeric_stats.csv`

- `l1_status_by_machine.csv`

- `l1_status_distribution.csv`

- `l1_status_type_code_distribution.csv`

- `l2_column_profile.csv`

- `l2_data_quality_reason_distribution.csv`

- `l2_fault_label_combo_distribution.csv`

- `l2_machine_summary.csv`

- `l2_status_evidence_class_distribution.csv`

Đánh giá dữ liệu thu được, chuẩn bị cho bài toán được xác định dựa vào dữ liệu hiện có:
L1 và L2 đều có 4,062,118 dòng, liên kết 1-1 tuyệt đối qua event_id, không trùng event và không lệch dòng; L1 có 54 cột, L2 có 74 cột. Đây là nền dữ liệu ổn để tiếp tục hoạch định mô hình

Lớp	Mục tiêu sau khi chỉnh
Lớp 1 — Normal Behavior Deviation Detection	Học nền vận hành bình thường của từng máy, rồi đánh giá event/chuỗi hiện tại có lệch khỏi nền đó không
Lớp 2 — Deviation Validation / Fault Confidence	Kiểm chứng sai lệch từ L1: đó là lỗi đã biết, xu hướng dẫn tới lỗi đã biết, bảo trì/sửa chữa, lỗi dữ liệu, hay bất thường chưa biết

Status 6, 7, 9, 10 là nhãn lỗi, nhưng không thể xây dựng bài AI học có giám sát đơn giản

Các status lỗi rõ:
Status	Ý nghĩa
6	Sửa chữa không tải
7	Sửa chữa có tải
9	Tắt máy có sự cố
10	Tắt máy bảo trì/sự cố

Nhưng trong dữ liệu, nhóm lỗi này rất ít:
status 6: 0.1976%
status 7: 0.1211%
status 9: 0.0036%
status 10: 0.0023%
Tổng lỗi rõ khoảng 0.3246%

Tỷ lệ này quá nhỏ để chỉ làm bài toán “lỗi/không lỗi” đơn giản. Nếu làm supervised binary ngay, model dễ bị lệch nặng về lớp normal.

Cách tận dụng tốt hơn là:

Status 6,7,9,10 = nhãn lỗi đã biết / weak label cho L2
Status 4,5,6,7,10 = nhãn bảo trì/sửa chữa/bảo trì liên quan
Status 1,2,3,8 = nền normal strict để train L1

| `ai_l1_operation_event_sequence` | Phù hợp làm bảng nền event-sequence, đã xử lý thời gian, KWh, gap, overlap |
| `ai_l2_fault_confidence_event`   | Phù hợp làm bảng bằng chứng rộng cho L2                                    |
| Dataset train L1                 | Cần tạo thêm view lọc normal strict từ L1                                  |
| Dataset train L2                 | Cần join thêm kết quả L1 và tạo nhãn future fault/future maintenance       |
| Dataset inference                | Có thể scoring trên toàn bộ L1/L2                                          |
-> cần thêm tầng view/dataset dẫn xuất
Đánh giá L1 theo kết quả hiện tại
4.1. Dữ liệu normal rất nhiều

Phân bố status:

Nhóm	Status	Tỷ lệ
Chạy có tải	3	41.5210%
Chạy không tải	2	41.4546%
Bật nguồn/dòng gần 0	1	16.2705%
Tắt máy bình thường	8	0.1506%

Tổng status normal strict 1,2,3,8 khoảng: 99.3967%

-> rất phù hợp với L1 dạng anomaly detection: có nhiều dữ liệu vận hành bình thường để học nền.
Tuy nhiên ở L1 vẫn đang có vấn đề
| Vấn đề                              |   Mức độ |
| ----------------------------------- | -------: |
| `NEXT_EVENT_START_FROM_INVALID_RAW` | 14.9282% |
| `NEXT_EVENT_START_FROM_NULL`        |  1.0262% |
| `OVERLAP_EVENT` ở L2                | 15.1773% |
| `KWH_MISSING` ở L2                  | 39.4929% |
| `KWH_IMPUTED` ở L2                  |  6.4128% |

| Bộ dữ liệu       | Mục tiêu            | Cách lọc                                                                                |
| ---------------- | ------------------- | --------------------------------------------------------------------------------------- |
| `normal_strict`  | Học nền sạch nhất   | Chỉ status normal, loại big gap, overlap, duration lỗi, open event                      |
| `normal_lenient` | Học nền thực tế hơn | Chỉ status normal, nhưng giữ lại một số event đã được sửa thời gian hoặc có KWh missing |
| Full L1          | Dùng để scoring     | Không lọc status lỗi, vì khi chạy thật phải đánh giá toàn bộ event                      |

L1 nên học theo cửa sổ trượt, không học từng event cô lập.

Feature lõi:

status_id
duration_sec
gap_from_prev_sec
overlap_sec
status_type_code
current_signal_code
is_loaded
is_no_load
is_current_near_zero
kwh_available_flag
kwh_missing_flag
kwh_delta_model_value
kwh_rate_per_hour hoặc kwh_rate_per_hour_model_value
loaded_zero_kwh_flag
loaded_without_kwh_flag
is_gap
is_big_gap
is_overlap
is_invalid_raw_end
end_time_imputed_flag
hour_of_day
day_of_week

Không đưa trực tiếp vào vector train phase đầu:

event_id
machine_id
event_start_time raw
event_end_time raw
end_time_source dạng text
kwh_start_source dạng text
kwh_end_source dạng text

Bổ sung để giúp L2 học xu hướng đến lỗi
| Cột                               | Ý nghĩa                                      |
| --------------------------------- | -------------------------------------------- |
| `future_fault_within_10_events`   | 10 event sau có status 6,7,9,10 không        |
| `future_fault_within_30min`       | 30 phút sau có status 6,7,9,10 không         |
| `future_fault_within_60min`       | 60 phút sau có status 6,7,9,10 không         |
| `future_maintenance_within_60min` | Có status 4,5,6,7,10 trong 60 phút sau không |
| `next_fault_status_id`            | Lỗi kế tiếp là loại nào                      |
| `seconds_to_next_fault`           | Còn bao lâu tới lỗi                          |
| `events_to_next_fault`            | Còn bao nhiêu event tới lỗi                  |
-> L2 nên là nhiều nhãn và nhiều cơ sở thay vì 1 tầng đơn. Vì một event có thể đồng thời là: behavior anomaly
có KWh không đáng tin
nằm trước lỗi 30 phút
liên quan bảo trì
có data quality issue

Các label dự tính: 
| Label                         | Ý nghĩa                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `current_known_fault`         | Event hiện tại là status lỗi 6,7,9,10                             |
| `current_maintenance_related` | Event hiện tại là status bảo trì/sửa chữa                         |
| `pre_fault_trend`             | Event hiện tại chưa lỗi nhưng sau đó đi tới lỗi                   |
| `data_quality_issue`          | Sai lệch có thể do dữ liệu                                        |
| `energy_inconsistency`        | Dòng/KWh không khớp                                               |
| `unknown_anomaly_candidate`   | L1 báo lệch nhưng không khớp lỗi đã biết và không do data quality |

các nhãn giải thích output l2 dự tính: KNOWN_FAULT_CONFIRMED
PRE_FAULT_TREND
MAINTENANCE_RELATED
DATA_QUALITY_ISSUE
ENERGY_INCONSISTENCY
UNKNOWN_ANOMALY
LOW_CONFIDENCE

chiến thuật đề ra 
1. L1 full dataset
   ai_l1_operation_event_sequence

2. Tạo normal baseline view
   vw_ai_l1_train_normal_strict
   vw_ai_l1_train_normal_lenient

3. Train L1 trên normal baseline
   theo từng machine_id hoặc threshold riêng từng máy

4. Score toàn bộ L1
   lưu vào ai_l1_operation_anomaly_result

5. L2 evidence dataset
   ai_l2_fault_confidence_event

6. Tạo future fault labels
   ai_l2_future_fault_label: sau event hiện tại, trong vài event/phút tiếp theo có đi tới lỗi hoặc bảo trì không?

7. Join L2 + L1 score + future labels
   tạo dataset train L2 cuối

8. L2 phân loại/đánh giá:
   lỗi đã biết, xu hướng trước lỗi, bảo trì, data quality, unknown anomaly

Ý tưởng: Giao diện các đường line giao động


| Bảng                             | Quyết định             |
| -------------------------------- | ---------------------- |
| `ai_l1_operation_event_sequence` | Giữ                    |
| `ai_l2_fault_confidence_event`   | Giữ                    |
| View L1 normal strict/lenient    | Cần tạo thêm           |
| Bảng kết quả L1 anomaly score    | Cần tạo thêm sau train |
| Bảng future fault label cho L2   | Cần tạo thêm           |
| View train L2 cuối               | Cần tạo thêm           |

Sau khi train xong L1, ta tạo thêm bảng kết quả và tạo view L2 có điểm L1::

CREATE TABLE dbo.ai_l1_operation_anomaly_result (
    event_id INT NOT NULL PRIMARY KEY,
    machine_id INT NOT NULL,
    model_version NVARCHAR(100) NOT NULL,
    behavior_anomaly_score FLOAT NULL,
    is_behavior_anomaly BIT NULL,
    behavior_reason NVARCHAR(1000) NULL,
    created_time DATETIME NOT NULL DEFAULT GETDATE()
);

CREATE OR ALTER VIEW dbo.vw_ai_l2_train_final_with_l1_score AS
SELECT
    l2.*,
    r.behavior_anomaly_score,
    r.is_behavior_anomaly
FROM dbo.vw_ai_l2_train_final l2
LEFT JOIN dbo.ai_l1_operation_anomaly_result r
    ON l2.event_id = r.event_id;
GO

| Thư mục        | Chứa gì                                  |
| -------------- | ---------------------------------------- |
| `dataCore`     | 2 bảng nền đã export từ SQL              |
| `dataDerived`  | Dữ liệu dẫn xuất từ SQL view/bảng phụ    |
| `dataModel/l1` | Dữ liệu train/valid/test cho L1          |
| `dataModel/l2` | Dữ liệu train/valid/test cho L2          |
| `dataReport`   | Báo cáo đánh giá, thống kê, biểu đồ, log |

L1 — ai_l1_operation_event_sequence
| Cột/nhóm cột                                                        | Dùng cho lớp nào      |              Có đưa vào train không? | Lấy từ đâu/cách tính                | Tác dụng                                 |
| ------------------------------------------------------------------- | --------------------- | -----------------------------------: | ----------------------------------- | ---------------------------------------- |
| `event_id`                                                          | L1/L2 trace           |                                Không | `data_iot_convert.id`               | Khóa liên kết, truy vết event            |
| `machine_id`                                                        | L1/L2 group           |        Không đưa trực tiếp phase đầu | `data_iot_convert.machine_id`       | Chia chuỗi theo từng máy                 |
| `sequence_segment_id`                                               | L1/L2 sequence        | Dùng để group, không phải feature số | Sinh từ gap lớn/duration lỗi        | Không nối chuỗi bị đứt                   |
| `event_order_in_segment`                                            | L1/L2 sequence        |  Dùng để sort, không phải feature số | `ROW_NUMBER()` theo máy/segment     | Thứ tự event                             |
| `status_id`                                                         | L1 train, L2 evidence |                                   Có | `data_iot_convert.status_id`        | Token trạng thái chính                   |
| `status_type_code`                                                  | L1/L2                 |                                   Có | ON=1, OFF=0, INFO=2                 | Nhóm trạng thái                          |
| `current_signal_code`                                               | L1/L2                 |                                   Có | Tách từ `data_machine_status.note`  | Mức dòng: có tải/không tải/gần 0         |
| `is_loaded`, `is_no_load`, `is_current_near_zero`                   | L1/L2                 |                                   Có | Tách từ note status                 | Mô tả trạng thái tải                     |
| `has_error_token`, `has_maintenance_token`                          | L1 phụ, L2 chính      |          Có nhưng dùng cẩn thận ở L1 | Tách từ note status                 | Dấu hiệu lỗi/bảo trì                     |
| `duration_sec`                                                      | L1/L2                 |                                   Có | `event_end_time - event_start_time` | Thời lượng trạng thái                    |
| `gap_from_prev_sec`                                                 | L1/L2                 |                                   Có | Start hiện tại - end event trước    | Đứt chuỗi/mất log                        |
| `overlap_sec`                                                       | L1/L2                 |                                   Có | Event hiện tại chồng event trước    | Nhiễu thời gian                          |
| `kwh_delta_model_value`                                             | L1/L2                 |                      Có, đi kèm mask | KWh end - start, null thì 0         | Giá trị số cho model                     |
| `kwh_available_flag`, `kwh_missing_flag`                            | L1/L2                 |                                   Có | Từ KWh đã fill                      | Mask cho KWh                             |
| `kwh_rate_per_hour`                                                 | L1/L2                 |                    Có nếu không null | `kwh_delta * 3600 / duration`       | Tốc độ tiêu thụ điện                     |
| `loaded_zero_kwh_flag`                                              | L1/L2                 |                                   Có | Có tải nhưng KWh không tăng         | Bằng chứng bất thường năng lượng         |
| `loaded_without_kwh_flag`                                           | L1/L2                 |                                   Có | Có tải nhưng thiếu KWh              | Giảm độ tin cậy năng lượng               |
| `is_raw_end_missing`, `is_invalid_raw_end`, `end_time_imputed_flag` | L1/L2 data quality    |                                   Có | Từ xử lý thời gian                  | Phân biệt bất thường thật và sửa dữ liệu |
| `is_gap`, `is_big_gap`, `is_overlap`                                | L1/L2 data quality    |                                   Có | Từ gap/overlap                      | Đánh giá chất lượng chuỗi                |
| `hour_of_day`, `day_of_week`                                        | L1/L2 context         |                                   Có | Từ `event_start_time`               | Bối cảnh thời gian                       |
| `machine_group_id`, `location_id`                                   | L1/L2 context phụ     |                           Thử nghiệm | Join master machine/location        | Context nhóm máy/khu vực                 |

L2 — ai_l2_fault_confidence_event
| Cột/nhóm cột                       | Dùng cho lớp nào |  Có đưa vào train không? | Lấy từ đâu/cách tính                 | Tác dụng                       |
| ---------------------------------- | ---------------- | -----------------------: | ------------------------------------ | ------------------------------ |
| `known_fault_status`               | L2               |                       Có | Status 6,7,9,10 hoặc token lỗi       | Nhãn/bằng chứng lỗi hiện tại   |
| `known_maintenance_status`         | L2               |                       Có | Status 4,5,6,7,10 hoặc token bảo trì | Bằng chứng bảo trì             |
| `known_repair_status`              | L2               |                       Có | Status 6,7                           | Bằng chứng sửa chữa            |
| `off_with_fault_status`            | L2               |                       Có | Status 9,10                          | Tắt máy liên quan lỗi          |
| `normal_loaded_production_status`  | L2               |                       Có | Status 3                             | Bình thường có tải             |
| `normal_no_load_production_status` | L2               |                       Có | Status 2                             | Bình thường không tải          |
| `power_on_near_zero_status`        | L2               |                       Có | Status 1                             | Bật nguồn/dòng gần 0           |
| `normal_power_off_status`          | L2               |                       Có | Status 8                             | Tắt máy bình thường            |
| `energy_inconsistency_flag`        | L2               |                       Có | Loaded zero KWh hoặc KWh âm          | Dấu hiệu năng lượng không khớp |
| `loaded_energy_unavailable_flag`   | L2               |                       Có | Có tải nhưng thiếu KWh               | Giảm confidence                |
| `time_quality_issue_flag`          | L2               |                       Có | Open/invalid/gap/overlap             | Lỗi chất lượng thời gian       |
| `kwh_quality_issue_flag`           | L2               |                       Có | Missing/imputed/negative KWh         | Lỗi chất lượng KWh             |
| `data_quality_issue_flag`          | L2               |                       Có | Tổng hợp time + KWh quality          | Sai lệch có thể do dữ liệu     |
| `fault_evidence_count`             | L2               |                       Có | Tổng bằng chứng lỗi                  | Điểm bằng chứng lỗi thô        |
| `maintenance_evidence_count`       | L2               |                       Có | Tổng bằng chứng bảo trì              | Điểm bằng chứng bảo trì        |
| `status_evidence_class`            | L2 explain       | Không trực tiếp nếu text | CASE từ status/evidence              | Giải thích nhãn hiện tại       |
| `data_quality_reason`              | L2 explain       | Không trực tiếp nếu text | CASE từ data flags                   | Giải thích lỗi dữ liệu         |


Future labels — ai_l2_future_fault_label
| Cột                                   | Dùng cho lớp nào      | Vai trò train | Cách tính                       | Tác dụng                         |
| ------------------------------------- | --------------------- | ------------: | ------------------------------- | -------------------------------- |
| `future_fault_within_10_events`       | L2 label              |          Nhãn | 10 event sau có status 6,7,9,10 | Học dấu hiệu gần trước lỗi       |
| `future_fault_within_30_events`       | L2 label              |          Nhãn | 30 event sau có lỗi             | Học xu hướng trước lỗi dài hơn   |
| `future_fault_within_30min`           | L2 label              |          Nhãn | 30 phút sau có lỗi              | Học xu hướng theo thời gian thật |
| `future_fault_within_60min`           | L2 label              |          Nhãn | 60 phút sau có lỗi              | Cảnh báo sớm                     |
| `future_maintenance_within_30_events` | L2 label              |      Nhãn phụ | 30 event sau có bảo trì         | Dự báo liên quan bảo trì         |
| `future_repair_within_30_events`      | L2 label              |      Nhãn phụ | 30 event sau có repair          | Dự báo sửa chữa                  |
| `next_fault_status_id`                | L2 label/explain      | Nhãn loại lỗi | Lỗi kế tiếp là status nào       | Phân loại lỗi kế tiếp            |
| `events_to_next_fault`                | L2 regression/explain |    Target phụ | Số event tới lỗi kế tiếp        | Độ gần lỗi                       |
| `seconds_to_next_fault`               | L2 regression/explain |    Target phụ | Số giây tới lỗi kế tiếp         | Thời gian tới lỗi                |
