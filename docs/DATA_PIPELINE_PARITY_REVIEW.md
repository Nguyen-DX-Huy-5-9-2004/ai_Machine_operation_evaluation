# Data Pipeline Parity Review

Ngày rà soát: 2026-07-14

Phạm vi: chỉ rà soát pipeline xử lý dữ liệu SQL/CSV thành feature đầu vào AI. Không bật L1 PyTorch, không chạy L2 prediction, không ghi SQL production.

## Source-Of-Truth Đã Đối Chiếu

- `documentProject/creatDataset.sql`
- `documentProject/creatViewsTrain.sql`
- `documentProject/queryData.sql`
- `documentProject/queryDataDetail.sql`
- `documentProject/SQLQuery7.sql`
- `documentProject/bao_cao_qua_trinh_xay_dung_dataset_ai_weldcom.docx`
- `documentProject/bao_cao_tong_ket_pipeline_ai_weldcom_l1_l2.md`
- `documentProject/weldcom_ai_data_processing_logic_spec_for_codex.md`
- `data/dataCore/ai_l1_operation_event_sequence.csv`
- `data/dataCore/ai_l2_fault_confidence_event.csv`
- `data/dataDerived/vw_ai_l1_train_normal_strict.csv`
- `data/dataDerived/vw_ai_l1_train_normal_lenient.csv`
- `data/dataDerived/vw_ai_l2_train_final.csv`
- `modeling/l1_tcn/configs/base.yaml`
- `modeling/l1_tcn/src/features.py`
- `modeling/l1_tcn/src/dataset.py`
- `modeling/l1_tcn/artifacts/lenient/preprocessor.json`
- `modeling/l1_tcn/artifacts/strict/preprocessor.json`
- `modeling/l2_fault_classifier/configs/feature_policy.yaml`
- `modeling/l2_fault_classifier/src/prepare_l2_features.py`
- `modeling/l2_fault_classifier/src/train_l2_multilabel.py`
- `data/dataModel/l2/prepared_report/l2_feature_policy.json`
- `modeling/l2_fault_classifier/artifacts/l2_multilabel_20260711_043347/*/*/metadata.json`

## Threshold Và Frame Đã Xác Nhận

- `kwh_impute_gap_limit_seconds = 300`: `@KwhFillMaxGapSec = 5 * 60` trong `creatDataset.sql`.
- `is_gap`: `gap_from_prev_sec > 300`, từ `@SmallGapSec = 5 * 60`.
- `is_big_gap`: `gap_from_prev_sec > 3600`, từ `@BigGapSec = 60 * 60`. Realtime config cũ từng là 1800, đã sửa về 3600.
- `is_long_duration`: `duration_sec > 24 * 3600 = 86400`.
- Segment boundary: first event of machine, big gap, non-positive duration, open/unresolved event.
- L1 window: 20 event, không vượt `machine_id` hoặc `sequence_segment_id`.
- Future labels L2: `ROWS BETWEEN 1 FOLLOWING AND 10/30 FOLLOWING` và window thời gian 30/60 phút. Runtime không được tạo hay dùng future label.
- L2 model feature metadata hiện không chứa rolling past-window feature ngoài các native/L1-stabilized columns đã chuẩn bị trong `l2_feature_policy.json`; rolling window vẫn cần kiểm thêm nếu một phiên bản SQL training khác có bổ sung feature này.
- Missing category convention: L1 preprocessor dùng `missing_category_value = 0`, `unknown_category_value = 0`; L2 training fill categorical bằng `-1`.

## Bảng Parity

| feature_name | offline_sql_source | offline_python_source | historical_csv_column | online_current_implementation | model_expected | status |
|---|---|---|---|---|---|---|
| event_id | `data_iot_convert.id` | trace/id only | L1/L2 CSV có | `sql_queries._raw_event_select` | id/trace, không dùng để validate khi SQL rekeyed | MATCH |
| machine_id | `data_iot_convert.machine_id` | L1/L2 group key | có | raw select + sort/group | L1 group/window, L2 id | MATCH |
| machine_group_id | join `data_machine.id` | categorical | có | `load_machine_group_sql` + context map | L1/L2 categorical | MATCH |
| location_id | OUTER APPLY `machine_location_his` theo event time | categorical | có | event-time lookup `start_time/end_time` | L1/L2 categorical | MATCH |
| event_start_time | `status_time_start` | sort key | có | raw select | audit/sort | MATCH |
| event_end_time | raw valid else next greater distinct start | time feature | có | `_next_greater_distinct_start` | feature source, duration | MATCH |
| next greater distinct start | distinct `machine_id,event_start_time` shift | not model column | gián tiếp | `_next_greater_distinct_start` | prevents same-timestamp leakage | MATCH |
| duration_sec | datediff start/end | L1 continuous | có | builder | L1 continuous | MATCH |
| duration_sec_model_value | L2 SQL `COALESCE/duration>=0` | L2 native | L2 CSV có | builder | L2 native | MATCH |
| gap_from_prev_sec | lag resolved event_end by machine | L1 continuous | có | builder after resolved end | L1 continuous | MATCH |
| gap_from_prev_sec_model_value | L2 model value | L2 native | L2 CSV có | builder | L2 native | MATCH |
| overlap_sec | negative gap clipped positive | L1 continuous | có | builder | L1 continuous | MATCH |
| is_gap | `gap_from_prev_sec > 300` | L1 binary | có | builder `small_gap_seconds` | L1 binary | MATCH |
| is_big_gap | `gap_from_prev_sec > 3600` | L1 binary | có | builder/config | L1 binary | MATCH |
| is_long_duration | `duration_sec > 86400` | L1 binary | có | builder/config | L1 binary | MATCH |
| is_open_event | unresolved end | L1 binary/audit | có | builder | must not score | MATCH |
| sequence_segment_id | cumulative boundary per machine | dataset grouping | có | `_add_sequence_features` | L1 window grouping | MATCH |
| event_order_in_segment | row_number in machine/segment | dataset ordering | có | `_add_sequence_features` | L1 window ordering | MATCH |
| kwh_start_value | raw else prev end within 300s | feature | có | `_add_kwh_features` | audit/L2 evidence | MATCH |
| kwh_end_value | raw else next start within 300s | feature | có | `_add_kwh_features` | audit/L2 evidence | MATCH |
| kwh_delta_model_value | delta else 0 | L1/L2 continuous | có | builder | L1/L2 numeric | MATCH |
| kwh_rate_per_hour | delta/hour if duration>0 | L1 continuous | có | builder | L1 continuous | MATCH |
| kwh_rate_per_hour_model_value | rate else 0 | L2 native | L2 CSV có | builder | L2 numeric | MATCH |
| kwh_imputed_or_missing_flag | source not RAW | L1 binary | có | builder | L1 binary | MATCH |
| kwh_imputed_flag | start/end imputed | L2 native | L2 CSV có | builder | L2 binary | MATCH |
| status_type_code | status table ON/OFF/INFO | categorical | có | canonical status map | L1/L2 categorical numeric | MATCH |
| current_signal_code | note-derived 0/1/2/null | categorical | có | canonical status map | L1 missing->0, L2 fill -1 | MATCH |
| is_current_near_zero | status note dòng ~0 | binary | có | canonical status map | L1/L2 binary | MATCH |
| status_type_label | audit only | none | không model | builder audit | not model input | NOT_USED_BY_MODEL |
| current_signal_label | audit only | none | không model | builder audit | not model input | NOT_USED_BY_MODEL |
| known_fault_status | L2 SQL status/evidence | native L2 | L2 CSV có | status map | L2 native | MATCH |
| known_maintenance_status | L2 SQL status/evidence | native L2 | L2 CSV có | status map | L2 native | MATCH |
| known_repair_status | L2 SQL status/evidence | native L2 | L2 CSV có | status map | L2 native | MATCH |
| energy_inconsistency_flag | SQL/user spec differ on loaded_without_kwh inclusion | L2 native | L2 CSV có | includes loaded_without_kwh per current spec | L2 native | LOGIC_MISMATCH |
| time_quality_issue_flag | open/non-positive/big-gap/overlap | L2 native | L2 CSV có | builder | L2 native | MATCH |
| kwh_quality_issue_flag | missing/imputed/negative | L2 native | L2 CSV có | builder | L2 native | MATCH |
| data_quality_issue_count | deterministic quality count | L2 native | L2 CSV có | builder | L2 native | MATCH |
| data_quality_reason | ordered audit reason | audit | L2 CSV có | builder | not model input | NOT_USED_BY_MODEL |
| l1 feature order | preprocessor feature list | `features.py` | train CSV columns | `validate_l1_model_contract` | exact order required | MATCH |
| L1 categorical mapping | preprocessor category_maps | `FeatureTransformer` | artifact | contract validator | unknown/missing -> 0 | MATCH |
| L1 window crossing | `dataset.py` groups by machine/segment | `WindowedSequenceDataset` | train views | invariant/contract | no cross segment | MATCH |
| L2 selected profiles | production selection JSON | train metadata | model artifacts | `load_l2_metadata_by_target` | target-specific feature list | MATCH |
| L2 categorical fill | train code fill `-1` | `train_l2_multilabel.py` | metadata | contract report only | categorical fill -1 | MATCH |
| L2 rolling previous 10 | requested runtime check | not present in selected metadata | not in current selected features | not implemented as model feature | model does not require selected rolling columns | NOT_USED_BY_MODEL |
| future labels | `creatViewsTrain.sql` only | train target | train final only | runtime drops future columns | forbidden as input | MATCH |
| offline replay parity | raw snapshot -> dataCore rebuild | not run in this change | historical CSV exists | not yet implemented as full replay command | required before production readiness | MISSING_ONLINE |

## L1 Required Feature Order

`status_id`, `status_type_code`, `current_signal_code`, `hour_of_day`, `day_of_week`, `machine_group_id`, `location_id`, `duration_sec`, `gap_from_prev_sec`, `overlap_sec`, `kwh_delta_model_value`, `kwh_rate_per_hour`, `is_on`, `is_loaded`, `is_no_load`, `is_current_near_zero`, `kwh_available_flag`, `kwh_missing_flag`, `kwh_imputed_or_missing_flag`, `kwh_rate_missing_flag`, `loaded_zero_kwh_flag`, `loaded_without_kwh_flag`, `is_raw_end_missing`, `is_invalid_raw_end`, `end_time_imputed_flag`, `is_non_positive_duration`, `is_long_duration`, `is_gap`, `is_big_gap`, `is_overlap`.

## L2 Required Feature Profiles

- `future_fault_within_10_events`: selected profile `safe`, 44 features.
- `future_fault_within_30_events`: selected profile `strict_continuous`, 55 features.
- `future_fault_within_30min`: selected profile `safe`, 44 features.
- `future_fault_within_60min`: selected profile `safe`, 44 features.
- `future_maintenance_within_30_events`: selected profile `strict_continuous`, 55 features.
- `future_repair_within_30_events`: selected profile `strict_continuous`, 55 features.

L2 categorical features theo metadata: `current_signal_code`, `day_of_week`, `hour_of_day`, `location_id`, `machine_group_id`, `split_bucket`, `status_id`, `status_type_code`.

## Kết Luận Hiện Tại

`live_sql_contract_result` có thể PASS khi query/build/invariant/contract không lỗi. `model_readiness_result` chưa được phép PASS vì:

- Source-lineage đã xác nhận event_id SQL hiện tại bị rekey so với historical AI dataset; validation cần dùng natural mapping hoặc offline replay đúng snapshot.
- Offline replay parity từ raw snapshot về `dataCore` chưa được chạy trong thay đổi này.
- L1 PyTorch vẫn intentionally disabled, nên L2 runtime chỉ có score columns no-op/audit.
