# Báo cáo đánh giá dataModel sau split

## 1. Mục tiêu
Báo cáo này đánh giá các file train/valid/test trong `dataModel` sau khi tách từ SQL view/bảng dẫn xuất. Mục tiêu là kiểm tra dữ liệu đã sẵn sàng để chọn kiến trúc L1/L2 chưa, tránh train ngay trên split bị lệch, thiếu máy, thiếu nhãn, thiếu cửa sổ chuỗi hoặc rò rỉ thời gian.

## 2. Tổng quan file
| key | level | dataset | split | exists | file_size_mb | rows | columns | machine_count | duplicate_event_id_est | segment_count | segment_len_mean | windows_10_total | windows_20_total | windows_30_total | recommended_feature_present_count | recommended_feature_missing_count |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| l1_normal_strict_train | l1 | normal_strict | train | True | 217.992000 | 2395802 | 35 | 14 | 0 | 1347 | 1,778.620638 | 2388389 | 2386280 | 2385577 | 27 | 0 |
| l1_normal_strict_valid | l1 | normal_strict | valid | True | 48.467000 | 513297 | 35 | 14 | 0 | 14 | 36,664.071429 | 513171 | 513031 | 512891 | 27 | 0 |
| l1_normal_strict_test | l1 | normal_strict | test | True | 49.435000 | 513243 | 35 | 14 | 0 | 14 | 36,660.214286 | 513117 | 512977 | 512837 | 27 | 0 |
| l1_normal_lenient_train | l1 | normal_lenient | train | True | 255.934000 | 2825559 | 35 | 14 | 0 | 1004 | 2,814.301793 | 2819897 | 2818269 | 2817707 | 27 | 0 |
| l1_normal_lenient_valid | l1 | normal_lenient | valid | True | 57.363000 | 605358 | 35 | 14 | 0 | 357 | 1,695.680672 | 603466 | 602830 | 602542 | 27 | 0 |
| l1_normal_lenient_test | l1 | normal_lenient | test | True | 58.223000 | 605347 | 35 | 14 | 0 | 14 | 43,239.071429 | 605221 | 605081 | 604941 | 27 | 0 |
| l2_final_train | l2 | final | train | True | 339.969000 | 2843621 | 45 | 14 | 0 | 1004 | 2,832.291833 | 2837267 | 2835418 | 2834793 | 31 | 2 |
| l2_final_valid | l2 | final | valid | True | 75.772000 | 609268 | 45 | 14 | 0 | 360 | 1,692.411111 | 607082 | 606373 | 606068 | 31 | 2 |
| l2_final_test | l2 | final | test | True | 76.007000 | 609229 | 45 | 14 | 0 | 28 | 21,758.178571 | 609089 | 608949 | 608809 | 31 | 2 |

## 3. So sánh L1 normal_strict và normal_lenient
| split | strict_rows | lenient_rows | strict_vs_lenient_pct | strict_windows_20 | lenient_windows_20 |
| --- | --- | --- | --- | --- | --- |
| train | 2395802 | 2825559 | 84.790372 | 2386280 | 2818269 |
| valid | 513297 | 605358 | 84.792305 | 513031 | 602830 |
| test | 513243 | 605347 | 84.784925 | 512977 | 605081 |

## 4. Phân bố target L2 theo split
| split | target | positive_count | positive_pct | negative_or_null_count |
| --- | --- | --- | --- | --- |
| train | future_fault_within_10_events | 33063 | 1.162708 | 2810558 |
| train | future_fault_within_30_events | 68136 | 2.396100 | 2775485 |
| train | future_fault_within_30min | 91085 | 3.203134 | 2752536 |
| train | future_fault_within_60min | 145035 | 5.100363 | 2698586 |
| train | future_maintenance_within_30_events | 80837 | 2.842749 | 2762784 |
| train | future_repair_within_30_events | 66966 | 2.354955 | 2776655 |
| valid | future_fault_within_10_events | 5459 | 0.895993 | 603809 |
| valid | future_fault_within_30_events | 12627 | 2.072487 | 596641 |
| valid | future_fault_within_30min | 15555 | 2.553064 | 593713 |
| valid | future_fault_within_60min | 25661 | 4.211775 | 583607 |
| valid | future_maintenance_within_30_events | 16475 | 2.704065 | 592793 |
| valid | future_repair_within_30_events | 12379 | 2.031782 | 596889 |
| test | future_fault_within_10_events | 7613 | 1.249612 | 601616 |
| test | future_fault_within_30_events | 15354 | 2.520235 | 593875 |
| test | future_fault_within_30min | 18727 | 3.073885 | 590502 |
| test | future_fault_within_60min | 30985 | 5.085936 | 578244 |
| test | future_maintenance_within_30_events | 18230 | 2.992307 | 590999 |
| test | future_repair_within_30_events | 15226 | 2.499224 | 594003 |

## 5. Kiểm tra thứ tự split
| level | dataset | machine_id | order_check_ok | reason | train_max_tuple | valid_min_tuple | valid_max_tuple | test_min_tuple |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| l1 | normal_lenient | 11 | 1 | OK | (188, 72708) | (188, 72709) | (188, 149073) | (188, 149074) |
| l1 | normal_lenient | 36 | 1 | OK | (207, 67251) | (207, 67252) | (207, 139722) | (207, 139723) |
| l1 | normal_lenient | 37 | 1 | OK | (1, 418542) | (1, 418543) | (252, 80115) | (252, 80116) |
| l1 | normal_lenient | 45 | 1 | OK | (313, 77452) | (313, 77453) | (313, 166611) | (313, 166612) |
| l1 | normal_lenient | 46 | 1 | OK | (30, 17109) | (30, 17110) | (30, 44269) | (30, 44270) |
| l1 | normal_lenient | 47 | 1 | OK | (1, 62474) | (1, 62475) | (1, 75839) | (1, 75840) |
| l1 | normal_lenient | 48 | 1 | OK | (3, 142786) | (3, 142787) | (98, 51021) | (98, 51022) |
| l1 | normal_lenient | 49 | 1 | OK | (30, 6951) | (30, 6952) | (30, 11515) | (30, 11516) |
| l1 | normal_lenient | 50 | 1 | OK | (139, 16792) | (139, 16793) | (139, 103568) | (139, 103569) |
| l1 | normal_lenient | 51 | 1 | OK | (1, 27592) | (1, 27593) | (1, 33384) | (1, 33385) |
| l1 | normal_lenient | 56 | 1 | OK | (54, 19163) | (54, 19164) | (54, 69444) | (54, 69445) |
| l1 | normal_lenient | 58 | 1 | OK | (35, 17594) | (35, 17595) | (35, 33163) | (35, 33164) |
| l1 | normal_lenient | 59 | 1 | OK | (1, 40418) | (1, 40419) | (1, 49058) | (1, 49059) |
| l1 | normal_lenient | 67 | 1 | OK | (1, 69553) | (1, 69554) | (1, 84460) | (1, 84461) |
| l1 | normal_strict | 11 | 1 | OK | (188, 94890) | (188, 94891) | (188, 160181) | (188, 160182) |
| l1 | normal_strict | 36 | 1 | OK | (207, 88192) | (207, 88193) | (207, 150174) | (207, 150175) |
| l1 | normal_strict | 37 | 1 | OK | (252, 26479) | (252, 26480) | (252, 98228) | (252, 98229) |
| l1 | normal_strict | 45 | 1 | OK | (313, 103946) | (313, 103947) | (313, 179885) | (313, 179886) |
| l1 | normal_strict | 46 | 1 | OK | (30, 21715) | (30, 21716) | (30, 46584) | (30, 46585) |
| l1 | normal_strict | 47 | 1 | OK | (1, 63929) | (1, 63930) | (1, 76561) | (1, 76562) |
| l1 | normal_strict | 48 | 1 | OK | (98, 19412) | (98, 19413) | (98, 62184) | (98, 62185) |
| l1 | normal_strict | 49 | 1 | OK | (30, 8043) | (30, 8044) | (30, 12047) | (30, 12048) |
| l1 | normal_strict | 50 | 1 | OK | (139, 43721) | (139, 43722) | (139, 117038) | (139, 117039) |
| l1 | normal_strict | 51 | 1 | OK | (1, 29194) | (1, 29195) | (1, 34185) | (1, 34186) |
| l1 | normal_strict | 56 | 1 | OK | (54, 35910) | (54, 35911) | (54, 77777) | (54, 77778) |
| l1 | normal_strict | 58 | 1 | OK | (35, 21158) | (35, 21159) | (35, 34955) | (35, 34956) |
| l1 | normal_strict | 59 | 1 | OK | (1, 40414) | (1, 40415) | (1, 49058) | (1, 49059) |
| l1 | normal_strict | 67 | 1 | OK | (1, 69537) | (1, 69538) | (1, 84448) | (1, 84449) |
| l2 | final | 11 | 1 | OK | (188, 72396) | (188, 72397) | (188, 148969) | (188, 148970) |
| l2 | final | 36 | 1 | OK | (207, 67348) | (207, 67349) | (207, 139813) | (207, 139814) |
| l2 | final | 37 | 1 | OK | (1, 419419) | (1, 419420) | (252, 80517) | (252, 80518) |
| l2 | final | 45 | 1 | OK | (313, 77910) | (313, 77911) | (313, 166320) | (313, 166321) |
| l2 | final | 46 | 1 | OK | (30, 17246) | (30, 17247) | (30, 44261) | (30, 44262) |
| l2 | final | 47 | 1 | OK | (1, 62445) | (1, 62446) | (1, 75825) | (1, 75826) |
| l2 | final | 48 | 1 | OK | (3, 143285) | (3, 143286) | (98, 51575) | (98, 51576) |
| l2 | final | 49 | 1 | OK | (30, 6930) | (30, 6931) | (30, 11520) | (30, 11521) |
| l2 | final | 50 | 1 | OK | (139, 16036) | (139, 16037) | (139, 103291) | (139, 103292) |
| l2 | final | 51 | 1 | OK | (1, 27440) | (1, 27441) | (1, 33320) | (1, 33321) |
| l2 | final | 56 | 1 | OK | (54, 18825) | (54, 18826) | (54, 69255) | (54, 69256) |
| l2 | final | 58 | 1 | OK | (35, 17603) | (35, 17604) | (35, 33413) | (35, 33414) |
| l2 | final | 59 | 1 | OK | (1, 40390) | (1, 40391) | (1, 49045) | (1, 49046) |
| l2 | final | 67 | 1 | OK | (1, 69649) | (1, 69650) | (1, 84559) | (1, 84560) |

## 6. Khuyến nghị tự động
| level | topic | recommendation |
| --- | --- | --- |
| ok | Split order | Train/valid/test giữ được thứ tự chuỗi theo sequence_segment_id + event_order_in_segment. Có thể tiếp tục đánh giá mô hình. |
| ok | L1 strict vs lenient | normal_strict còn 84.79% so với lenient ở train. Có thể dùng strict làm baseline sạch và lenient làm mô hình thực tế. |
| ok | L1 normal_strict window | Có khoảng 2,386,280 cửa sổ độ dài 20 trong train. Đủ để thử sequence autoencoder như GRU/LSTM/TCN. |
| ok | L1 normal_lenient window | Có khoảng 2,818,269 cửa sổ độ dài 20 trong train. Đủ để thử sequence autoencoder như GRU/LSTM/TCN. |
| ok | L2 target future_fault_within_10_events | Train có 33,063 positive. Có thể thử supervised classifier, ưu tiên LightGBM/RandomForest/Logistic class_weight trước. |
| ok | L2 target future_fault_within_30_events | Train có 68,136 positive. Có thể thử supervised classifier, ưu tiên LightGBM/RandomForest/Logistic class_weight trước. |
| ok | L2 target future_fault_within_30min | Train có 91,085 positive. Có thể thử supervised classifier, ưu tiên LightGBM/RandomForest/Logistic class_weight trước. |
| ok | L2 target future_fault_within_60min | Train có 145,035 positive. Có thể thử supervised classifier, ưu tiên LightGBM/RandomForest/Logistic class_weight trước. |
| ok | L2 target future_maintenance_within_30_events | Train có 80,837 positive. Có thể thử supervised classifier, ưu tiên LightGBM/RandomForest/Logistic class_weight trước. |
| ok | L2 target future_repair_within_30_events | Train có 66,966 positive. Có thể thử supervised classifier, ưu tiên LightGBM/RandomForest/Logistic class_weight trước. |
| strategy | Kiến trúc đề xuất | L1 nên bắt đầu bằng baseline thống kê + IsolationForest trên window feature; sau đó thử GRU/LSTM/TCN Autoencoder nếu window đủ nhiều. L2 nên là multi-label/weak-supervised, dùng behavior_anomaly_score từ L1 + status/KWh/data-quality/future labels. |

## 7. Diễn giải chiến thuật
### 7.1. Lớp 1 — Normal Behavior Deviation Detection
L1 nên học nền vận hành bình thường của từng máy. Vì vậy L1 không dùng toàn bộ dữ liệu lỗi/bảo trì để train, mà dùng `normal_strict` và `normal_lenient`. `normal_strict` dùng làm baseline sạch; `normal_lenient` dùng để kiểm tra mô hình có thực tế hơn không khi dữ liệu có overlap/KWh missing/sửa thời gian.

Không nên đưa `machine_id` như feature số trực tiếp trong phase đầu. `machine_id` dùng để group/sort/threshold theo máy. Model L1 nên score toàn bộ event sau khi train xong, rồi lưu ra `dataModel/l1/scored/ai_l1_operation_anomaly_result.csv`.

### 7.2. Lớp 2 — Deviation Validation / Fault Confidence
L2 chưa nên train trước khi có score từ L1. Dataset L2 hiện tại có evidence và future labels, nhưng cần join thêm `behavior_anomaly_score` và `is_behavior_anomaly` từ L1. L2 nên là multi-label/weak-supervised, không nên chỉ là binary lỗi/không lỗi.

Các cột `future_fault_*`, `future_maintenance_*`, `future_repair_*` là target/label, không được đưa vào feature train.

## 8. Các file CSV chi tiết đã sinh
- `datamodel_file_summary.csv`
- `l1_normal_lenient_test_binary_positive_summary.csv`
- `l1_normal_lenient_test_column_profile.csv`
- `l1_normal_lenient_test_dist_current_signal_code.csv`
- `l1_normal_lenient_test_dist_day_of_week.csv`
- `l1_normal_lenient_test_dist_hour_of_day.csv`
- `l1_normal_lenient_test_dist_location_id.csv`
- `l1_normal_lenient_test_dist_machine_group_id.csv`
- `l1_normal_lenient_test_dist_machine_id.csv`
- `l1_normal_lenient_test_dist_status_id.csv`
- `l1_normal_lenient_test_dist_status_type_code.csv`
- `l1_normal_lenient_test_machine_distribution.csv`
- `l1_normal_lenient_test_numeric_stats.csv`
- `l1_normal_lenient_test_segment_window_counts.csv`
- `l1_normal_lenient_test_status_by_machine.csv`
- `l1_normal_lenient_train_binary_positive_summary.csv`
- `l1_normal_lenient_train_column_profile.csv`
- `l1_normal_lenient_train_dist_current_signal_code.csv`
- `l1_normal_lenient_train_dist_day_of_week.csv`
- `l1_normal_lenient_train_dist_hour_of_day.csv`
- `l1_normal_lenient_train_dist_location_id.csv`
- `l1_normal_lenient_train_dist_machine_group_id.csv`
- `l1_normal_lenient_train_dist_machine_id.csv`
- `l1_normal_lenient_train_dist_status_id.csv`
- `l1_normal_lenient_train_dist_status_type_code.csv`
- `l1_normal_lenient_train_machine_distribution.csv`
- `l1_normal_lenient_train_numeric_stats.csv`
- `l1_normal_lenient_train_segment_window_counts.csv`
- `l1_normal_lenient_train_status_by_machine.csv`
- `l1_normal_lenient_valid_binary_positive_summary.csv`
- `l1_normal_lenient_valid_column_profile.csv`
- `l1_normal_lenient_valid_dist_current_signal_code.csv`
- `l1_normal_lenient_valid_dist_day_of_week.csv`
- `l1_normal_lenient_valid_dist_hour_of_day.csv`
- `l1_normal_lenient_valid_dist_location_id.csv`
- `l1_normal_lenient_valid_dist_machine_group_id.csv`
- `l1_normal_lenient_valid_dist_machine_id.csv`
- `l1_normal_lenient_valid_dist_status_id.csv`
- `l1_normal_lenient_valid_dist_status_type_code.csv`
- `l1_normal_lenient_valid_machine_distribution.csv`
- `l1_normal_lenient_valid_numeric_stats.csv`
- `l1_normal_lenient_valid_segment_window_counts.csv`
- `l1_normal_lenient_valid_status_by_machine.csv`
- `l1_normal_strict_test_binary_positive_summary.csv`
- `l1_normal_strict_test_column_profile.csv`
- `l1_normal_strict_test_dist_current_signal_code.csv`
- `l1_normal_strict_test_dist_day_of_week.csv`
- `l1_normal_strict_test_dist_hour_of_day.csv`
- `l1_normal_strict_test_dist_location_id.csv`
- `l1_normal_strict_test_dist_machine_group_id.csv`
- `l1_normal_strict_test_dist_machine_id.csv`
- `l1_normal_strict_test_dist_status_id.csv`
- `l1_normal_strict_test_dist_status_type_code.csv`
- `l1_normal_strict_test_machine_distribution.csv`
- `l1_normal_strict_test_numeric_stats.csv`
- `l1_normal_strict_test_segment_window_counts.csv`
- `l1_normal_strict_test_status_by_machine.csv`
- `l1_normal_strict_train_binary_positive_summary.csv`
- `l1_normal_strict_train_column_profile.csv`
- `l1_normal_strict_train_dist_current_signal_code.csv`
- `l1_normal_strict_train_dist_day_of_week.csv`
- `l1_normal_strict_train_dist_hour_of_day.csv`
- `l1_normal_strict_train_dist_location_id.csv`
- `l1_normal_strict_train_dist_machine_group_id.csv`
- `l1_normal_strict_train_dist_machine_id.csv`
- `l1_normal_strict_train_dist_status_id.csv`
- `l1_normal_strict_train_dist_status_type_code.csv`
- `l1_normal_strict_train_machine_distribution.csv`
- `l1_normal_strict_train_numeric_stats.csv`
- `l1_normal_strict_train_segment_window_counts.csv`
- `l1_normal_strict_train_status_by_machine.csv`
- `l1_normal_strict_valid_binary_positive_summary.csv`
- `l1_normal_strict_valid_column_profile.csv`
- `l1_normal_strict_valid_dist_current_signal_code.csv`
- `l1_normal_strict_valid_dist_day_of_week.csv`
- `l1_normal_strict_valid_dist_hour_of_day.csv`
- `l1_normal_strict_valid_dist_location_id.csv`
- `l1_normal_strict_valid_dist_machine_group_id.csv`
- `l1_normal_strict_valid_dist_machine_id.csv`
- `l1_normal_strict_valid_dist_status_id.csv`
- `l1_normal_strict_valid_dist_status_type_code.csv`
- `l1_normal_strict_valid_machine_distribution.csv`
- `l1_normal_strict_valid_numeric_stats.csv`
- `l1_normal_strict_valid_segment_window_counts.csv`
- `l1_normal_strict_valid_status_by_machine.csv`
- `l1_strict_vs_lenient_summary.csv`
- `l2_final_test_binary_positive_summary.csv`
- `l2_final_test_column_profile.csv`
- `l2_final_test_dist_current_signal_code.csv`
- `l2_final_test_dist_day_of_week.csv`
- `l2_final_test_dist_hour_of_day.csv`
- `l2_final_test_dist_location_id.csv`
- `l2_final_test_dist_machine_group_id.csv`
- `l2_final_test_dist_machine_id.csv`
- `l2_final_test_dist_status_id.csv`
- `l2_final_test_dist_status_type_code.csv`
- `l2_final_test_machine_distribution.csv`
- `l2_final_test_numeric_stats.csv`
- `l2_final_test_segment_window_counts.csv`
- `l2_final_test_status_by_machine.csv`
- `l2_final_train_binary_positive_summary.csv`
- `l2_final_train_column_profile.csv`
- `l2_final_train_dist_current_signal_code.csv`
- `l2_final_train_dist_day_of_week.csv`
- `l2_final_train_dist_hour_of_day.csv`
- `l2_final_train_dist_location_id.csv`
- `l2_final_train_dist_machine_group_id.csv`
- `l2_final_train_dist_machine_id.csv`
- `l2_final_train_dist_status_id.csv`
- `l2_final_train_dist_status_type_code.csv`
- `l2_final_train_machine_distribution.csv`
- `l2_final_train_numeric_stats.csv`
- `l2_final_train_segment_window_counts.csv`
- `l2_final_train_status_by_machine.csv`
- `l2_final_valid_binary_positive_summary.csv`
- `l2_final_valid_column_profile.csv`
- `l2_final_valid_dist_current_signal_code.csv`
- `l2_final_valid_dist_day_of_week.csv`
- `l2_final_valid_dist_hour_of_day.csv`
- `l2_final_valid_dist_location_id.csv`
- `l2_final_valid_dist_machine_group_id.csv`
- `l2_final_valid_dist_machine_id.csv`
- `l2_final_valid_dist_status_id.csv`
- `l2_final_valid_dist_status_type_code.csv`
- `l2_final_valid_machine_distribution.csv`
- `l2_final_valid_numeric_stats.csv`
- `l2_final_valid_segment_window_counts.csv`
- `l2_final_valid_status_by_machine.csv`
- `l2_target_distribution_by_split.csv`
- `recommendations.csv`
- `split_order_check.csv`
- `split_order_minmax_by_machine.csv`
