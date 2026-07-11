# Weldcom Data Discovery Report

This report was generated from the exported CSV files in `C:\Users\huynd1\Downloads\OBAD\data\new070726` using a streaming scan designed for large files.

## 1. Portfolio overview

- Tables scanned: 9
- Total rows scanned: 14,582,042
- Total data size: 3,812,803,520 bytes

Largest tables:
- `data_cabinetglobal_kwh.csv` | rows=10,519,383 | size=2,519,624,976 bytes | kind=time_series
- `data_iot_convert.csv` | rows=4,062,118 | size=1,293,074,144 bytes | kind=event_intervals
- `machine_location_his.csv` | rows=221 | size=45,522 bytes | kind=master_data
- `data_cabinetglobal_kwh_daily.csv` | rows=236 | size=32,430 bytes | kind=daily_aggregate
- `data_machine.csv` | rows=27 | size=9,884 bytes | kind=master_data
- `data_electric_cabinet.csv` | rows=23 | size=5,288 bytes | kind=master_data
- `data_location.csv` | rows=8 | size=4,248 bytes | kind=master_data
- `data_machine_status.csv` | rows=14 | size=4,160 bytes | kind=master_data

## 2. Key findings

- Column `iot_tagname` in `data_electric_cabinetglobal.csv` behaves like an encoded identifier that can be decomposed into asset code, location, and metric token such as `Kwh`.

## 3. Recommended AI problem ladder

- **Machine operation state anomaly detection** | readiness=High | score=90.0
  Target: flag abnormal state sequences, excessive idle, unstable ON/OFF behavior
  Grain: machine_id x status interval
  Why now: Large interval-event history is available; Coverage spans 14 machines; Multiple machine states detected (10 status ids); Operation log spans about 423.6 days
  Watch-outs: Need confirmation of business meaning for each status_id
- **Energy anomaly detection** | readiness=Medium | score=77.0
  Target: detect abnormal consumption patterns, flat-lines, spikes, counter resets
  Grain: cabinetglobal_id x timestamp
  Why now: Very large time-series volume for energy measurements; Energy history spans about 402.0 days; Multiple monitored assets are present (11 cabinetglobal ids); Energy reading column is consistently numeric
  Watch-outs: Need business threshold for 'abnormal' and confirmation of cabinet-to-line mapping
- **Failure precursor / predictive maintenance** | readiness=Low | score=0.0
- **Maintenance compliance and delay risk** | readiness=Low | score=0.0
- **Issue text clustering and triage assist** | readiness=Low | score=0.0

## 4. Inferred relationships

- `data_cabinetglobal_kwh.csv.cabinetglobal_id` -> `data_electric_cabinetglobal.csv.id` | score=1.0 | coverage=1.0
- `data_cabinetglobal_kwh_daily.csv.cabinetglobal_id` -> `data_electric_cabinetglobal.csv.id` | score=1.0 | coverage=1.0
- `data_cabinetglobal_kwh_daily.csv.location_id` -> `data_location.csv.id` | score=1.0 | coverage=1.0
- `data_electric_cabinet.csv.location_id` -> `data_location.csv.id` | score=1.0 | coverage=1.0
- `data_electric_cabinetglobal.csv.location_id` -> `data_location.csv.id` | score=1.0 | coverage=1.0
- `data_iot_convert.csv.machine_id` -> `data_machine.csv.id` | score=1.0 | coverage=1.0
- `machine_location_his.csv.location_id` -> `data_location.csv.id` | score=1.0 | coverage=1.0
- `machine_location_his.csv.machine_id` -> `data_machine.csv.id` | score=0.751 | coverage=0.169

Likely missing dimensions:
- `data_electric_cabinetglobal.csv.cabinetglobal_group_id` | No matching exported dimension table found with strong name/value overlap
- `data_electric_cabinetglobal.csv.cabinetglobal_group_difference_id` | No matching exported dimension table found with strong name/value overlap
- `data_iot_convert.csv.status_id` | No matching exported dimension table found with strong name/value overlap
- `data_location.csv.location_parent_id` | No matching exported dimension table found with strong name/value overlap
- `data_location.csv.location_level_id` | No matching exported dimension table found with strong name/value overlap
- `data_machine.csv.machine_group_id` | No matching exported dimension table found with strong name/value overlap
- `data_machine.csv.machine_branch_id` | No matching exported dimension table found with strong name/value overlap
- `data_machine.csv.machine_asset_group_id` | No matching exported dimension table found with strong name/value overlap
- `data_machine.csv.machine_unit_id` | No matching exported dimension table found with strong name/value overlap
- `data_machine_status.csv.group_id` | No matching exported dimension table found with strong name/value overlap

## 5. Focus relationship map

- **data_iot_convert.machine_id -> data_machine.id** | kind=direct_key | coverage=1.0
  Meaning: Each machine state interval can be mapped to machine master data.
- **data_iot_convert.status_id -> data_machine_status.id** | kind=direct_key | coverage=1.0
  Meaning: Each interval state id resolves to a named machine status.
  Status note consistency on sample: True
- **machine_location_his.machine_id -> data_machine.id** | kind=direct_key | coverage=0.169
  Meaning: Machine location history is the bridge from machine to shop-floor location.
  IOT machine coverage: 1.0
- **machine_location_his.location_id -> data_location.id** | kind=direct_key | coverage=1.0
  Meaning: Machine locations resolve to the location hierarchy.
  Active machine->location map: {"11": [{"location_id": "3", "location_name": "CNC Thanh", "start_time": "2024-12-05 17:00:30.907"}], "36": [{"location_id": "3", "location_name": "CNC Thanh", "start_time": "2024-12-05 17:00:30.907"}], "37": [{"location_id": "3", "location_name": "CNC Thanh", "start_time": "2024-12-05 17:00:30.907"}], "45": [{"location_id": "3", "location_name": "CNC Thanh", "start_time": "2024-12-05 17:00:30.907"}], "46": [{"location_id": "3", "location_name": "CNC Thanh", "start_time": "2024-12-05 17:00:30.907"}], "47": [{"location_id": "4", "location_name": "CNC Mã", "start_time": "2024-12-05 17:00:30.907"}], "48": [{"location_id": "4", "location_name": "CNC Mã", "start_time": "2024-12-05 17:00:30.907"}], "49": [{"location_id": "4", "location_name": "CNC Mã", "start_time": "2024-12-05 17:00:30.907"}], "50": [{"location_id": "4", "location_name": "CNC Mã", "start_time": "2024-12-05 17:00:30.907"}], "51": [{"location_id": "4", "location_name": "CNC Mã", "start_time": "2024-12-05 17:00:30.907"}], "56": [{"location_id": "4", "location_name": "CNC Mã", "start_time": "2024-12-05 18:29:30.063"}], "58": [{"location_id": "4", "location_name": "CNC Mã", "start_time": "2024-12-06 09:01:08.897"}], "59": [{"location_id": "4", "location_name": "CNC Mã", "start_time": "2024-12-06 09:01:36.710"}], "67": [{"location_id": "3", "location_name": "CNC Thanh", "start_time": "2026-03-16 13:21:57.097"}]}
- **data_electric_cabinet.electric_cabinet ~= data_machine.machine_name** | kind=soft_name_match | coverage=0.857
  Meaning: Electric cabinet master often duplicates machine names, so it can enrich the machine domain when exact-name matching is acceptable.
  Caveat: This is a name-based bridge, not a stable foreign key.
- **data_cabinetglobal_kwh.cabinetglobal_id -> data_electric_cabinetglobal.id** | kind=direct_key | coverage=1.0
  Meaning: Each raw KWH point belongs to a cabinetglobal asset.
  Caveat: This relation is validated from the scanned id domain of the raw KWH fact table.
- **data_electric_cabinetglobal.location_id -> data_location.id** | kind=direct_key | coverage=1.0
  Meaning: Direct location is mostly empty in current cabinetglobal master export.
- **data_cabinetglobal_kwh_daily.cabinetglobal_id -> data_electric_cabinetglobal.id** | kind=direct_key | coverage=1.0
  Meaning: Daily KWH aggregate resolves to cabinetglobal master.
- **data_cabinetglobal_kwh_daily.location_id -> data_location.id** | kind=direct_key | coverage=1.0
  Meaning: Daily KWH already contains the location bridge needed for area-level analysis.
- **data_iot_convert <-> data_cabinetglobal_kwh_daily via data_location** | kind=coarse_bridge | coverage=1.0
  Meaning: Operation and energy domains can be aligned at location level, not at machine level, using locations such as CNC Thanh / CNC Ma.
  Shared locations: ['3', '4']
  Caveat: There is no direct machine_id or cabinetglobal_id bridge in the current export.

## 6. First 5 rows per table

### data_cabinetglobal_kwh.csv

| id | cabinetglobal_id | iot_kwh | iot_time | note | created_time | created_user_id | last_modified_time | last_modified_user_id | is_deleted |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 4777.8000000000002 | 2025-05-17 09:35:56.000 | 709889 | 2025-05-17 09:35:56.660 | 8888 | 2025-05-17 09:35:56.660 | 8888 | 0 |
| 2 | 3 | 12849.200000000001 | 2025-05-17 09:35:58.000 | 709891 | 2025-05-17 09:35:58.777 | 8888 | 2025-05-17 09:35:58.777 | 8888 | 0 |
| 3 | 2 | 7590.1000000000004 | 2025-05-17 09:36:02.000 | 709894 | 2025-05-17 09:36:02.707 | 8888 | 2025-05-17 09:36:02.707 | 8888 | 0 |
| 4 | 3 | 12849.299999999999 | 2025-05-17 09:36:04.000 | 709895 | 2025-05-17 09:36:04.743 | 8888 | 2025-05-17 09:36:04.743 | 8888 | 0 |
| 5 | 3 | 12849.4 | 2025-05-17 09:36:10.000 | 709905 | 2025-05-17 09:36:10.770 | 8888 | 2025-05-17 09:36:10.770 | 8888 | 0 |

### data_cabinetglobal_kwh_daily.csv

| id | cabinetglobal_id | location_id | date | first_kwh | last_kwh | total_kwh | created_time |
|---|---|---|---|---|---|---|---|
| 1 | 4 | 4 | 2025-05-13 | 4695.90 | 4821.60 | 125.70 | 2025-07-30 02:00:01.697 |
| 2 | 3 | 3 | 2025-05-13 | 9901.00 | 10270.70 | 369.70 | 2025-07-30 02:00:01.697 |
| 3 | 2 | 4 | 2025-05-13 | 6211.30 | 6338.30 | 127.00 | 2025-07-30 02:00:01.697 |
| 4 | 2 | 4 | 2025-05-14 | 6338.40 | 6768.00 | 429.60 | 2025-07-30 02:00:01.697 |
| 5 | 4 | 4 | 2025-05-14 | 4821.70 | 5080.40 | 258.70 | 2025-07-30 02:00:01.697 |

### data_electric_cabinet.csv

| id | electric_cabinet | location_id | created_time | created_user_id | last_modified_time | last_modified_user_id | is_deleted | note | asset_code | serial_no | model | iot_tagname | rated_power | rated_voltage | rated_current | power_factor | report_color |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Máy đột, cắt, đóng dấu CNC thép góc - CNCV1 | 3 | 2024-12-05 17:34:27.357 | 3 | 2025-05-15 13:36:11.357 | 1 | 0 |  |  |  |  |  |  |  |  |  |  |
| 6 | Máy đột, cắt, đóng dấu CNC thép góc - CNCV2 | 3 | 2024-12-05 17:35:21.407 | 3 | 2025-05-15 13:38:46.240 | 1 | 0 |  |  |  |  |  |  |  |  |  |  |
| 7 | Máy đột, cắt, đóng dấu CNC thép góc - CNCV3 | 3 | 2024-12-05 17:35:30.533 | 3 | 2025-05-15 13:39:02.957 | 1 | 0 |  |  |  |  |  |  |  |  |  |  |
| 11 | Máy đột, cắt, đóng dấu CNC thép góc - CNCV4 | 3 | 2024-12-05 17:36:41.860 | 3 | 2025-05-15 13:39:12.057 | 1 | 0 |  |  |  |  |  |  |  |  |  |  |
| 12 | Máy khoan, đóng dấu CNC thép góc - CNCK1 | 3 | 2024-12-05 17:36:52.077 | 3 | 2025-05-15 13:38:53.037 | 1 | 0 |  |  |  |  |  |  |  |  |  |  |

### data_electric_cabinetglobal.csv

| id | cabinetglobal_name | iot_tagname | created_time | created_user_id | last_modified_time | last_modified_user_id | is_deleted | note | cabinetglobal_group_id | cabinetglobal_group_difference_id | asset_code | serial_no | model | location_id | rated_power | rated_voltage | rated_current |  |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Số 1 (PPWS1) | PM101_PPWS1_Kwh | 2025-05-13 18:32:50.000 | 1 | 2025-05-15 15:31:04.570 | 1 | 0 |  | 2 |  |  |  |  |  |  |  |  |  |
| 2 | Số 2 (PPWS2) | PM102_PPWS2_Kwh | 2025-05-13 18:32:50.000 | 1 | 2025-05-15 15:10:15.480 | 1 | 0 |  | 2 |  |  |  |  |  |  |  |  |  |
| 3 | Số 3 (PPWS3) | PM103_PPWS3_Kwh | 2025-05-13 18:32:50.000 | 1 |  |  | 0 |  | 3 |  |  |  |  |  |  |  |  |  |
| 4 | Số 4 (PPWS4) | PM104_PPWS4_Kwh | 2025-05-13 18:32:50.000 | 1 |  |  | 0 |  | 1 |  |  |  |  |  |  |  |  |  |
| 5 | T9 | PM109_T9_Kwh | 2025-08-08 00:00:00.000 | 1 |  |  | 0 |  | 1 | 2 |  |  |  |  |  |  |  |  |

### data_iot_convert.csv

| id | machine_id | status_id | status_time_start | status_time_end | status_kwh_start | status_kwh_end | note | error_code | created_time | created_user_id | last_modified_time | last_modified_user_id | is_deleted |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 48043 | 11 | 8 | 2025-04-21 23:59:59.000 | 2025-04-22 04:50:28.000 | 281.30000000000001 | 281.30000000000001 |  |  | 2025-04-22 15:31:07.147 | 8888 | 2025-04-25 18:15:44.163 |  | 0 |
| 48046 | 36 | 8 | 2025-04-21 23:59:59.000 | 2025-04-22 04:50:28.000 | 275.89999999999998 | 275.89999999999998 |  |  | 2025-04-22 15:32:28.617 | 8888 | 2025-04-25 18:15:44.163 |  | 0 |
| 48048 | 37 | 8 | 2025-04-21 23:59:59.000 | 2025-04-22 04:50:28.000 | 245.30000000000001 | 245.30000000000001 |  |  | 2025-04-22 15:32:45.117 | 8888 | 2025-04-25 18:15:44.163 |  | 0 |
| 48051 | 45 | 8 | 2025-04-21 23:59:59.000 | 2025-04-22 04:50:31.000 | 295.0 | 295.0 |  |  | 2025-04-22 15:32:57.950 | 8888 | 2025-04-25 18:15:44.163 |  | 0 |
| 48052 | 46 | 8 | 2025-04-21 23:59:59.000 | 2025-04-22 04:50:25.000 | 156.90000000000001 | 157.5 |  |  | 2025-04-22 15:33:10.887 | 8888 | 2025-04-25 18:15:44.163 |  | 0 |

### data_location.csv

| id | location_code | location_name | location_parent_id | address | phone | website | email | manager | logo | location_level_id | created_time | created_user_id | last_modified_time | last_modified_user_id | is_deleted | note | report_color |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ngai Cau | Công ty cổ phần đầu tư xây dựng và thương mại Ngãi Cầu | 0 | Lô F2, Đường N3-2, KCN Đại Đồng, Hoàn Sơn, Tiên Du, Bắc Ninh | 02222221258 | https://cokhingaicau.vn |  |  | imgs/logo Ngai Cau-ngang.png | 2 | 2027-07-04 10:00:00.000 | 1 |  |  | 0 |  |  |
| 2 | XSX | Xưởng sản xuất | 1 | Lô F2, Đường N3-2, KCN Đại Đồng, Hoàn Sơn, Tiên Du, Bắc Ninh |  |  |  |  |  | 3 | 2027-07-04 10:00:00.000 | 1 |  |  | 0 |  |  |
| 3 | CNC Thanh | CNC Thanh | 2 | Lô F2, Đường N3-2, KCN Đại Đồng, Hoàn Sơn, Tiên Du, Bắc Ninh | 02222221258 |  |  |  |  | 4 | 2027-07-04 10:00:00.000 | 1 |  |  | 0 |  | #00CCFF |
| 4 | CNC Mã | CNC Mã | 2 | Lô F2, Đường N3-2, KCN Đại Đồng, Hoàn Sơn, Tiên Du, Bắc Ninh |  |  |  |  | imgs/logo Ngai Cau-ngang.png | 4 | 2027-07-04 10:00:00.000 | 1 |  |  | 0 |  | #00CC99 |
| 5 | CNC Xà | CNC Xà | 2 | 285A Ngô Gia Tự, Phường Việt Hưng, Thành phố Hà Nội | 19009410 |  |  |  | imgs/WMMS_LOGO.png | 4 | 2024-07-04 00:00:00.000 | 1 |  |  | 0 | uk | #FF99CC |

### data_machine.csv

| id | machine_name | machine_group_id | machine_model | machine_branch_id | machine_call_name | machine_serial_no | machine_asset_group_id | machine_unit_id | year_of_production | machine_supplier | iottag_part_machine | created_time | created_user_id | last_modified_time | last_modifie |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11 | Máy đột, cắt, đóng dấu CNC thép góc - CNCV1 | 9 | TAPM1010-3 | 1 | CNCV1 | CNCV1 | 0 | 0 | 2024 | SUNRISE | M1005 | 2024-07-04 13:48:26.940 | 1 | 2026-04-20 16:27:18.233 | 256 |
| 36 | Máy đột, cắt, đóng dấu CNC thép góc - CNCV2 | 9 | TAPM1516S | 1 | CNCV2 | CNCV2 | 0 | 0 | 2024 | SUNRISE | M1003 | 2024-08-08 09:26:01.453 | 1 | 2026-01-26 14:27:10.180 | 0 |
| 37 | Máy đột, cắt, đóng dấu CNC thép góc - CNCV3 cũ | 9 | TAPM2020 | 1 | CNCV3 | CNCV3 | 0 | 0 | 2024 | SUNRISE | M1002 | 2024-08-08 09:28:28.883 | 1 | 2026-04-20 16:27:00.733 | 256 |
| 45 | Máy đột, cắt, đóng dấu CNC thép góc - CNCV4 | 9 | TAPM1010-2 | 1 | CNCV4 | CNCV4 | 0 | 0 | 2024 | SUNRISE | M1004 | 2024-08-28 11:13:59.967 | 1 | 2026-01-26 14:26:41.760 | 0 |
| 46 | Máy khoan, đóng dấu CNC thép góc - CNCK1 | 10 | TBL3635 | 1 | CNCK1 | CNCK1 | 0 | 0 | 2024 | SUNRISE | M1001 | 2024-08-28 11:40:31.687 | 1 | 2026-01-26 14:26:25.537 | 0 |

### data_machine_status.csv

| id | status_name | iottag_part_signal | color_code | type | is_show | note | created_time | created_user_id | last_modified_time | last_modified_user_id | is_deleted | pattern_draw | pattern_color | group_id |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Bật nguồn | PowerOn | #EEDC82 | ON | 1 | ON + Dòng ~ 0 | 2024-07-04 09:20:23.900 |  | 2024-09-06 11:49:11.310 | 1 | 0 | #01DA0AE6 | #D83A08E6 | 2 |
| 2 | Chạy sản xuất không tải | RunPdNoLoad | #EEDC82 | ON | 1 | ON + Không lỗi + Không bảo trì + Dòng=0 | 2024-07-04 09:21:36.457 |  |  |  | 0 |  |  | 2 |
| 3 | Chạy sản xuất có tải | RunPdOnLoad | #00b050 | ON | 1 | ON + Không lỗi + Không bảo trì + Dòng>0 | 2024-07-04 09:23:33.270 |  |  |  | 0 |  |  | 1 |
| 4 | Chạy bảo trì không tải | RunMeNoLoad | #ff0000 | ON | 1 | ON + Không lỗi + Có bảo trì + Dòng=0 | 2024-07-04 09:25:51.613 |  |  |  | 0 | diagonal | white | 3 |
| 5 | Chạy bảo trì có tải | RunMeOnLoad | #ff0000 | ON | 1 | ON + Không lỗi + Có bảo trì + Dòng>0 | 2024-07-04 09:27:25.273 |  |  |  | 0 |  |  | 3 |

### machine_location_his.csv

| id | machine_code | machine_id | location_id | start_time | end_time | created_time | created_user_id | last_modified_time | last_modified_user_id | is_deleted | note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 |  | 11 | 3 | 2024-12-05 17:00:30.907 |  | 2024-12-05 17:00:30.907 | 3 | 2024-12-05 17:00:30.907 | 3 | 0 |  |
| 2 |  | 12 | 3 | 2024-12-05 17:00:30.907 |  | 2024-12-05 17:00:30.907 | 3 | 2024-12-05 17:00:30.907 | 3 | 0 |  |
| 3 |  | 19 | 3 | 2024-12-05 17:00:30.907 |  | 2024-12-05 17:00:30.907 | 3 | 2024-12-05 17:00:30.907 | 3 | 0 |  |
| 4 |  | 33 | 3 | 2024-12-05 17:00:30.907 |  | 2024-12-05 17:00:30.907 | 3 | 2024-12-05 17:00:30.907 | 3 | 0 |  |
| 5 |  | 35 | 3 | 2024-12-05 17:00:30.907 |  | 2024-12-05 17:00:30.907 | 3 | 2024-12-05 17:00:30.907 | 3 | 0 |  |


## 7. Table details

### data_cabinetglobal_kwh.csv

- kind=time_series | rows=10,519,383 | columns=10 | missing=0.0% | bad_rows=0
- primary_time=iot_time | start=2025-05-13 14:12:33 | end=2026-06-19 13:42:37
- special_summary={"asset_count": 11, "top_assets": [{"value": "4", "count": 3649735}, {"value": "3", "count": 2340471}, {"value": "2", "count": 1714897}, {"value": "1", "count": 1064606}, {"value": "5", "count": 813477}, {"value": "8", "count": 433907}, {"value": "6", "count": 164510}, {"value": "9", "count": 157309}], "delta_summary": {"count": 10519372, "min": -3158.5, "max": 3162.3, "mean": 0.11}, "negative_delta_rows": 309232, "zero_delta_rows": 2645, "interval_seconds": {"count": 10519372, "min": -648788.0, "max": 925924.18, "mean": 29.62}}

| column | role | type | missing% | unique | sample |
|---|---|---:|---:|---:|---|
| `id` | primary_key_candidate | id_like_text | 0.0 | >20000 | 1, 2 |
| `cabinetglobal_id` | foreign_key_candidate | id_like_text | 0.0 | 11 | 1, 3 |
| `iot_kwh` | numeric_measure | float | 0.0 | >20000 | 4777.8000000000002, 12849.200000000001 |
| `iot_time` | time_dimension | datetime | 0.0 | >20000 | 2025-05-17 09:35:56.000, 2025-05-17 09:35:58.000 |
| `note` | free_text_or_instruction | string | 0.0 | >20000 | 709889, 709891 |
| `created_time` | time_dimension | datetime | 0.0 | >20000 | 2025-05-17 09:35:56.660, 2025-05-17 09:35:58.777 |
| `created_user_id` | foreign_key_candidate | id_like_text | 0.0 | 1 | 8888 |
| `last_modified_time` | time_dimension | datetime | 0.0 | >20000 | 2025-05-17 09:35:56.660, 2025-05-17 09:35:58.777 |
| `last_modified_user_id` | foreign_key_candidate | id_like_text | 0.0 | 1 | 8888 |
| `is_deleted` | generic_feature | categorical_text | 0.0 | 1 | 0 |

### data_cabinetglobal_kwh_daily.csv

- kind=daily_aggregate | rows=236 | columns=8 | missing=0.0% | bad_rows=0
- primary_time=date | start=2025-05-13 00:00:00 | end=2025-08-01 00:00:00

| column | role | type | missing% | unique | sample |
|---|---|---:|---:|---:|---|
| `id` | primary_key_candidate | integer | 0.0 | 236 | 1, 2 |
| `cabinetglobal_id` | foreign_key_candidate | integer | 0.0 | 3 | 4, 3 |
| `location_id` | foreign_key_candidate | integer | 0.0 | 2 | 4, 3 |
| `date` | time_dimension | datetime | 0.0 | 81 | 2025-05-13, 2025-05-14 |
| `first_kwh` | numeric_measure | float | 0.0 | 236 | 4695.90, 9901.00 |
| `last_kwh` | numeric_measure | float | 0.0 | 236 | 4821.60, 10270.70 |
| `total_kwh` | numeric_measure | float | 0.0 | 235 | 125.70, 369.70 |
| `created_time` | time_dimension | datetime | 0.0 | 2 | 2025-07-30 02:00:01.697, 2025-08-02 02:00:00.620 |

### data_electric_cabinet.csv

- kind=master_data | rows=23 | columns=18 | missing=45.89% | bad_rows=0
- primary_time=created_time | start=2024-12-05 17:34:27.357000 | end=2026-07-04 09:54:54.633000

| column | role | type | missing% | unique | sample |
|---|---|---:|---:|---:|---|
| `id` | primary_key_candidate | integer | 0.0 | 23 | 1, 6 |
| `electric_cabinet` | generic_feature | categorical_text | 0.0 | 21 | Máy đột, cắt, đóng dấu CNC thép góc - CNCV1, Máy đột, cắt, đóng dấu CNC thép góc - CNCV2 |
| `location_id` | foreign_key_candidate | integer | 8.7 | 5 | 3, 4 |
| `created_time` | time_dimension | datetime | 0.0 | 23 | 2024-12-05 17:34:27.357, 2024-12-05 17:35:21.407 |
| `created_user_id` | foreign_key_candidate | integer | 0.0 | 3 | 3, 1 |
| `last_modified_time` | time_dimension | datetime | 26.09 | 17 | 2025-05-15 13:36:11.357, 2025-05-15 13:38:46.240 |
| `last_modified_user_id` | foreign_key_candidate | integer | 26.09 | 2 | 1, 260 |
| `is_deleted` | generic_feature | integer | 0.0 | 2 | 0, 1 |
| `note` | free_text_or_instruction | categorical_text | 100.0 | 0 |  |
| `asset_code` | generic_feature | categorical_text | 73.91 | 5 | MMS, MMS3 |
| `serial_no` | generic_feature | categorical_text | 73.91 | 5 | MMS001, MMS0013 |
| `model` | label_or_asset_name | categorical_text | 73.91 | 5 | Demo, Demo3 |
| `iot_tagname` | label_or_asset_name | categorical_text | 73.91 | 5 | DemoTag, DemoTag3 |
| `rated_power` | numeric_measure | integer | 73.91 | 4 | 56.00, 1.00 |
| `rated_voltage` | numeric_measure | integer | 73.91 | 2 | 56.00, 380.00 |
| `rated_current` | numeric_measure | integer | 73.91 | 4 | 56.00, 2.00 |
| `power_factor` | numeric_measure | float | 73.91 | 2 | .90, .82 |
| `report_color` | categorical_code | categorical_text | 73.91 | 4 | #1455ff, #dd98c7 |

### data_electric_cabinetglobal.csv

- kind=master_data | rows=12 | columns=19 | missing=49.12% | bad_rows=12
- primary_time=created_time | start=2025-05-13 18:32:50 | end=2026-07-04 09:30:29.630000

| column | role | type | missing% | unique | sample |
|---|---|---:|---:|---:|---|
| `id` | primary_key_candidate | integer | 0.0 | 12 | 1, 2 |
| `cabinetglobal_name` | label_or_asset_name | categorical_text | 0.0 | 12 | Số 1 (PPWS1), Số 2 (PPWS2) |
| `iot_tagname` | label_or_asset_name | categorical_text | 0.0 | 12 | PM101_PPWS1_Kwh, PM102_PPWS2_Kwh |
| `created_time` | time_dimension | datetime | 0.0 | 4 | 2025-05-13 18:32:50.000, 2025-08-08 00:00:00.000 |
| `created_user_id` | foreign_key_candidate | integer | 0.0 | 2 | 1, 260 |
| `last_modified_time` | time_dimension | datetime | 25.0 | 7 | 2025-05-15 15:31:04.570, 2025-05-15 15:10:15.480 |
| `last_modified_user_id` | foreign_key_candidate | integer | 25.0 | 3 | 1, 256 |
| `is_deleted` | generic_feature | integer | 0.0 | 2 | 0, 1 |
| `note` | free_text_or_instruction | categorical_text | 100.0 | 0 |  |
| `cabinetglobal_group_id` | foreign_key_candidate | integer | 16.67 | 8 | 2, 3 |
| `cabinetglobal_group_difference_id` | foreign_key_candidate | integer | 91.67 | 1 | 2 |
| `asset_code` | generic_feature | categorical_text | 83.33 | 2 | LM, TEEES |
| `serial_no` | generic_feature | categorical_text | 83.33 | 2 | 1212, TEES |
| `model` | label_or_asset_name | categorical_text | 83.33 | 2 | LM1, SSS |
| `location_id` | foreign_key_candidate | integer | 91.67 | 1 | 3 |
| `rated_power` | numeric_measure | integer | 83.33 | 2 | .00, 23.00 |
| `rated_voltage` | numeric_measure | integer | 83.33 | 2 | .00, 380.00 |
| `rated_current` | numeric_measure | integer | 83.33 | 2 | .00, 12.00 |
| `` | generic_feature | float | 83.33 | 2 | .00, .90 |

### data_iot_convert.csv

- kind=event_intervals | rows=4,062,118 | columns=14 | missing=25.46% | bad_rows=0
- primary_time=status_time_start | start=2025-04-21 23:59:59 | end=2026-06-19 13:43:50
- special_summary={"machine_count": 14, "top_machines": [{"value": "37", "count": 599149}, {"value": "45", "count": 589405}, {"value": "50", "count": 581760}, {"value": "11", "count": 510483}, {"value": "36", "count": 483093}, {"value": "48", "count": 360258}, {"value": "56", "count": 336227}, {"value": "46", "count": 180094}], "status_count": 10, "top_statuses": [{"value": "3", "count": 1686632}, {"value": "2", "count": 1683934}, {"value": "1", "count": 660927}, {"value": "6", "count": 8027}, {"value": "8", "count": 6117}, {"value": "4", "count": 5925}, {"value": "5", "count": 5399}, {"value": "7", "count": 4920}], "top_notes": [{"value": "ON + Không lỗi + Không bảo trì + Dòng>0", "count": 1686632}, {"value": "ON + Không lỗi + Không bảo trì + Dòng=0", "count": 1683934}, {"value": "ON + Dòng ~ 0", "count": 660927}, {"value": "ON + Có lỗi + Có bảo trì + Dòng=0", "count": 8027}, {"value": "OFF + Không lỗi + Không bảo trì", "count": 6104}, {"value": "ON + Không lỗi + Có bảo trì + Dòng=0", "count": 5925}, {"value": "ON + Không lỗi + Có bảo trì + Dòng>0", "count": 5399}, {"value": "ON + Có lỗi + Có bảo trì + Dòng>0", "count": 4920}], "duration_seconds": {"count": 4020418, "min": -60.0, "max": 3636548.03, "mean": 116.33}, "zero_or_negative_duration_rows": 606403, "kwh_delta": {"count": 1796660, "min": 0.0, "max": 547.5, "mean": 0.15}, "zero_kwh_delta_rows": 1257783, "negative_kwh_delta_rows": 0}

| column | role | type | missing% | unique | sample |
|---|---|---:|---:|---:|---|
| `id` | primary_key_candidate | id_like_text | 0.0 | >20000 | 48043, 48046 |
| `machine_id` | foreign_key_candidate | id_like_text | 0.0 | 14 | 11, 36 |
| `status_id` | foreign_key_candidate | id_like_text | 0.0 | 10 | 8, 3 |
| `status_time_start` | time_dimension | datetime | 0.0 | >20000 | 2025-04-21 23:59:59.000, 2025-04-22 06:22:50.000 |
| `status_time_end` | time_dimension | datetime | 1.03 | >20000 | 2025-04-22 04:50:28.000, 2025-04-22 04:50:31.000 |
| `status_kwh_start` | numeric_measure | float | 55.77 | >20000 | 281.30000000000001, 275.89999999999998 |
| `status_kwh_end` | numeric_measure | float | 55.77 | >20000 | 281.30000000000001, 275.89999999999998 |
| `note` | free_text_or_instruction | categorical_text | 0.0 | 10 | ON + Không lỗi + Không bảo trì + Dòng>0, OFF + Không lỗi + Không bảo trì |
| `error_code` | generic_feature | categorical_text | 100.0 | 0 |  |
| `created_time` | time_dimension | datetime | 0.0 | >20000 | 2025-04-22 15:31:07.147, 2025-04-22 15:32:28.617 |
| `created_user_id` | foreign_key_candidate | id_like_text | 0.0 | 1 | 8888 |
| `last_modified_time` | time_dimension | datetime | 43.84 | >20000 | 2025-04-25 18:15:44.163, 2025-04-25 18:15:52.627 |
| `last_modified_user_id` | foreign_key_candidate | id_like_text | 100.0 | 0 |  |
| `is_deleted` | generic_feature | categorical_text | 0.0 | 1 | 0 |

### data_location.csv

- kind=master_data | rows=8 | columns=18 | missing=38.19% | bad_rows=0
- primary_time=created_time | start=2024-07-04 00:00:00 | end=2027-07-04 10:00:00

| column | role | type | missing% | unique | sample |
|---|---|---:|---:|---:|---|
| `id` | primary_key_candidate | integer | 0.0 | 8 | 1, 2 |
| `location_code` | generic_feature | categorical_text | 0.0 | 8 | Ngai Cau, XSX |
| `location_name` | label_or_asset_name | categorical_text | 0.0 | 8 | Công ty cổ phần đầu tư xây dựng và thương mại Ngãi Cầu, Xưởng sản xuất |
| `location_parent_id` | foreign_key_candidate | integer | 0.0 | 3 | 0, 1 |
| `address` | generic_feature | categorical_text | 0.0 | 3 | Lô F2, Đường N3-2, KCN Đại Đồng, Hoàn Sơn, Tiên Du, Bắc Ninh, 285A Ngô Gia Tự, Phường Việt Hưng, Thành phố Hà Nội |
| `phone` | generic_feature | integer | 62.5 | 2 | 02222221258, 19009410 |
| `website` | generic_feature | categorical_text | 87.5 | 1 | https://cokhingaicau.vn |
| `email` | generic_feature | categorical_text | 100.0 | 0 |  |
| `manager` | generic_feature | categorical_text | 100.0 | 0 |  |
| `logo` | generic_feature | categorical_text | 62.5 | 2 | imgs/logo Ngai Cau-ngang.png, imgs/WMMS_LOGO.png |
| `location_level_id` | foreign_key_candidate | integer | 0.0 | 3 | 2, 3 |
| `created_time` | time_dimension | datetime | 0.0 | 4 | 2027-07-04 10:00:00.000, 2024-07-04 00:00:00.000 |
| `created_user_id` | foreign_key_candidate | integer | 0.0 | 1 | 1 |
| `last_modified_time` | time_dimension | datetime | 62.5 | 2 | 2026-04-24 09:22:26.337, 2026-04-24 10:27:44.497 |
| `last_modified_user_id` | foreign_key_candidate | integer | 62.5 | 1 | 1 |
| `is_deleted` | generic_feature | integer | 0.0 | 1 | 0 |
| `note` | free_text_or_instruction | categorical_text | 87.5 | 1 | uk |
| `report_color` | categorical_code | categorical_text | 62.5 | 3 | #00CCFF, #00CC99 |

### data_machine.csv

- kind=master_data | rows=27 | columns=16 | missing=2.31% | bad_rows=27
- primary_time=created_time | start=2024-07-04 13:48:26.940000 | end=2026-07-06 15:23:50.457000

| column | role | type | missing% | unique | sample |
|---|---|---:|---:|---:|---|
| `id` | primary_key_candidate | integer | 0.0 | 27 | 11, 36 |
| `machine_name` | label_or_asset_name | compound_string | 0.0 | 26 | Máy đột, cắt, đóng dấu CNC thép góc - CNCV1, Máy đột, cắt, đóng dấu CNC thép góc - CNCV2 |
| `machine_group_id` | foreign_key_candidate | integer | 0.0 | 14 | 9, 10 |
| `machine_model` | label_or_asset_name | compound_string | 0.0 | 26 | TAPM1010-3, TAPM1516S |
| `machine_branch_id` | foreign_key_candidate | integer | 0.0 | 11 | 1, 2 |
| `machine_call_name` | label_or_asset_name | string | 0.0 | 26 | CNCV1, CNCV2 |
| `machine_serial_no` | generic_feature | string | 0.0 | 26 | CNCV1, CNCV2 |
| `machine_asset_group_id` | foreign_key_candidate | integer | 0.0 | 1 | 0 |
| `machine_unit_id` | foreign_key_candidate | integer | 0.0 | 1 | 0 |
| `year_of_production` | generic_feature | integer | 0.0 | 4 | 2024, 0 |
| `machine_supplier` | generic_feature | categorical_text | 3.7 | 15 | SUNRISE, YAWEI |
| `iottag_part_machine` | generic_feature | categorical_text | 33.33 | 17 | M1005, M1003 |
| `created_time` | time_dimension | datetime | 0.0 | 27 | 2024-07-04 13:48:26.940, 2024-08-08 09:26:01.453 |
| `created_user_id` | foreign_key_candidate | integer | 0.0 | 5 | 1, 3 |
| `last_modified_time` | time_dimension | datetime | 0.0 | 27 | 2026-04-20 16:27:18.233, 2026-01-26 14:27:10.180 |
| `last_modifie` | generic_feature | integer | 0.0 | 5 | 256, 0 |

### data_machine_status.csv

- kind=master_data | rows=14 | columns=15 | missing=21.9% | bad_rows=2
- primary_time=created_time | start=2024-07-04 09:20:23.900000 | end=2024-07-04 09:32:04.850000

| column | role | type | missing% | unique | sample |
|---|---|---:|---:|---:|---|
| `id` | primary_key_candidate | integer | 0.0 | 14 | 1, 2 |
| `status_name` | categorical_code | categorical_text | 0.0 | 14 | Bật nguồn, Chạy sản xuất không tải |
| `iottag_part_signal` | generic_feature | categorical_text | 0.0 | 14 | PowerOn, RunPdNoLoad |
| `color_code` | categorical_code | categorical_text | 14.29 | 6 | #EEDC82, #00b050 |
| `type` | categorical_code | categorical_text | 0.0 | 3 | ON, OFF |
| `is_show` | generic_feature | integer | 0.0 | 2 | 1, 0 |
| `note` | free_text_or_instruction | categorical_text | 0.0 | 14 | ON + Dòng ~ 0, ON + Không lỗi + Không bảo trì + Dòng=0 |
| `created_time` | time_dimension | categorical_text | 0.0 | 11 | 2024-07-04 09:20:23.900, 2024-07-04 09:21:36.457 |
| `created_user_id` | foreign_key_candidate | datetime | 85.71 | 2 | 2025-02-13 15:08:06.787, 2025-02-13 14:38:02.753 |
| `last_modified_time` | time_dimension | categorical_text | 57.14 | 5 | 2024-09-06 11:49:11.310, 2025-05-19 09:37:14.780 |
| `last_modified_user_id` | foreign_key_candidate | id_like_text | 57.14 | 4 | 1, 46 |
| `is_deleted` | generic_feature | integer | 0.0 | 2 | 0, 1 |
| `pattern_draw` | generic_feature | categorical_text | 50.0 | 4 | #01DA0AE6, diagonal |
| `pattern_color` | categorical_code | categorical_text | 50.0 | 5 | #D83A08E6, white |
| `group_id` | foreign_key_candidate | float | 14.29 | 5 | 2, 1 |

### machine_location_his.csv

- kind=master_data | rows=221 | columns=12 | missing=21.42% | bad_rows=0
- primary_time=created_time | start=2024-12-05 17:00:30.907000 | end=2026-07-06 15:23:50.550000

| column | role | type | missing% | unique | sample |
|---|---|---:|---:|---:|---|
| `id` | primary_key_candidate | integer | 0.0 | 221 | 1, 2 |
| `machine_code` | generic_feature | categorical_text | 100.0 | 0 |  |
| `machine_id` | foreign_key_candidate | integer | 0.0 | 154 | 11, 12 |
| `location_id` | foreign_key_candidate | integer | 0.0 | 7 | 3, 4 |
| `start_time` | time_dimension | datetime | 0.0 | 137 | 2024-12-05 17:00:30.907, 2024-12-05 18:29:30.063 |
| `end_time` | time_dimension | datetime | 73.76 | 58 | 2026-04-24 10:40:09.690, 2026-04-24 10:47:29.890 |
| `created_time` | time_dimension | datetime | 0.0 | 137 | 2024-12-05 17:00:30.907, 2024-12-05 18:29:30.063 |
| `created_user_id` | foreign_key_candidate | integer | 0.0 | 6 | 3, 1 |
| `last_modified_time` | time_dimension | datetime | 0.0 | 162 | 2024-12-05 17:00:30.907, 2024-12-05 18:29:30.063 |
| `last_modified_user_id` | foreign_key_candidate | integer | 0.0 | 5 | 3, 1 |
| `is_deleted` | generic_feature | integer | 0.0 | 1 | 0 |
| `note` | free_text_or_instruction | categorical_text | 83.26 | 1 | uk |
