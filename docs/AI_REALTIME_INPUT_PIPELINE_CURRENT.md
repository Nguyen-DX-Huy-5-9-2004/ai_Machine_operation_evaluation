# Weldcom AI - Realtime Input Pipeline Hien Tai

## Pham vi va trang thai

Tai lieu nay la mo ta source-of-truth cho luong du lieu runtime dang co trong project:

```text
SQL Server raw event
  -> canonical L1 event feature
  -> L1 window 20 event (Candidate A)
  -> L2 past-event feature va 6 probability
  -> policy v2
```

Pipeline canonical duoc dung chung cho offline replay, live SQL audit va read-only dry-run. Khong chen event synthetic, khong resample theo thoi gian, khong pad window bang event zero hay lap event.

Trang thai da khoa:

| Hang muc | Trang thai |
|---|---|
| Offline transformation replay | PASS tren raw snapshot da xac nhan |
| Live SQL data contract | PASS |
| Candidate A/B/C evaluation | `KEEP_CURRENT_MODEL_AND_THRESHOLDS` |
| L1 production candidate | Candidate A trong `modeling/l1_tcn/artifacts/` |
| Candidate B | Khong promotion |
| Candidate C | Archive nghien cuu, khong nam trong runtime bundle |
| SQL production write | Khong duoc bat trong audit/dry-run |

`config.example.yaml` co `runtime.dry_run: true` va `artifacts.l1_enabled: false`. Do do stage-only live SQL mac dinh chi kiem tra du lieu/feature, khong ghi ket qua AI vao SQL.

## File chinh

| File/thu muc | Trach nhiem |
|---|---|
| `inference/online/config.example.yaml` | Mau cau hinh SQL, mapping cot, threshold va artifact path; khong co secret |
| `inference/online/config.local.yaml` | Cau hinh local co credential; khong commit |
| `inference/online/db.py` | ODBC connection, read/execute/bulk insert khi write mode duoc cho phep |
| `inference/online/sql_queries.py` | SQL candidate, context row-order, location, machine group, checkpoint |
| `inference/online/score_new_events.py` | Entrypoint/orchestration cac mode |
| `inference/online/feature_builder_l1.py` | Pure DataFrame transformer raw -> canonical L1 event |
| `inference/online/data_contract.py` | 30 L1 feature, threshold, enum va invariant |
| `inference/online/l1_shadow.py` | Window/scoring Candidate A L1 lenient va strict |
| `inference/online/feature_builder_l2.py` | L2 runtime feature tu canonical event + L1 score |
| `inference/online/l2_scorer.py` | Load 6 selected L2 model va probability |
| `inference/online/policy_engine.py` | Policy v2, khong co `MONITOR` |
| `inference/online/production_lineage_dry_run.py` | Lineage, relocation check, dry-run va multi-machine smoke |
| `data/runtime_manifest/` | Hash lineage, runtime bundle va environment requirement |
| `data/realtime_audit/` | Audit theo run timestamp, khong phai production result |

## Cau hinh va ket noi SQL Server

Tao `inference/online/config.local.yaml` tu file mau tren may co SQL access. Khong hard-code password trong code va khong commit file local.

```yaml
database:
  driver: "ODBC Driver 17 for SQL Server"
  server: "..."
  database: "..."
  username: "..."
  password: "..."
  trusted_connection: false
  trust_server_certificate: true
  encrypt: true
  timeout_seconds: 30
```

`db.build_connection_string()` them `DRIVER`, `SERVER`, `DATABASE`, `Encrypt`, `TrustServerCertificate` va timeout. Neu `trusted_connection: true`, dung `Trusted_Connection=yes`; neu khong, dung `UID`/`PWD`. `pyodbc` chi import khi goi `connect()`, nen import module/help khong can SQL driver.

SQL value dung parameter `?`. Ten table/cot den tu config, duoc validate identifier va quote bang `[]`; ten khong hop le se fail thay vi noi SQL tu chuoi tu do.

## SQL raw source va join context

Nguon event la `dbo.data_iot_convert`.

| Raw SQL | Canonical raw |
|---|---|
| `id` | `event_id` |
| `machine_id` | `machine_id` |
| `status_id` | `status_id` |
| `status_time_start` | `event_start_time` |
| `status_time_end` | `raw_event_end_time` |
| `status_kwh_start` | `raw_status_kwh_start` |
| `status_kwh_end` | `raw_status_kwh_end` |
| `error_code` | `raw_error_code` |

Raw select ep `event_id` thanh `BIGINT`, machine/status thanh `INT`, time thanh `DATETIME2`, KWh thanh `FLOAT` bang `TRY_CAST`. Neu schema co `is_deleted`, raw event va next-event lookup deu loc `ISNULL(is_deleted, 0) = 0`.

Bang context:

| Bang | Su dung |
|---|---|
| `dbo.data_machine_status` | `status_name`, `type`, `note` cho audit/join coverage; model mapping van dung `status_id` canonical |
| `dbo.data_machine` | `machine_group_id` |
| `dbo.machine_location_his` | Location tai thoi diem event |
| `dbo.data_location` | Audit location; `location_id` la context model |

Location match khi `machine_id` bang nhau, `start_time <= event_start_time`, va `end_time IS NULL OR event_start_time < end_time`. Neu nhieu interval phu hop, chon interval co `start_time` lon nhat. Ten cot location nam trong `location_columns`; khong hard-code `time_start/time_end`.

Khong dung KWh cabinet lam event-level runtime feature.

## Candidate va context live SQL

`load_unprocessed_closed_candidate_events_sql()` lay `TOP max_events`, sort theo `event_start_time, event_id`. Event duoc lay khi:

1. `event_id > runtime.min_event_id_to_process`.
2. Chua co `event_id` trong `dbo.ai_l2_fault_judgment_online_v2` (`NOT EXISTS`). Day la chong duplicate chinh; checkpoint chi la log/progress.
3. `raw_event_end_time > event_start_time`, hoac ton tai event cung machine co `event_start_time` lon hon.
4. Neu co `is_deleted`, row va next-event lookup deu loc deletion.

Vi vay event mo cuoi machine khong score chi vi job dang chay. Khi event sau toi muon, event truoc duoc dong lai theo event-time va co the duoc xu ly o lan sau.

Context dung `ROW_NUMBER()` theo:

```text
PARTITION BY machine_id
ORDER BY event_start_time, event_id
```

Mac dinh lay 40 row truoc va 2 row sau. Lookahead theo row-order, khong theo time range; event sau cach 24 gio van duoc lay. Build feature tren `context + candidate + lookahead`, sau do moi loc candidate. Audit uu tien `context_role=candidate` va co cot `is_raw_candidate_event`.

## Canonical L1 event transformation

Ham dung chung offline/live:

```python
build_l1_event_features(raw_events, machine_status, machine_context, location_context, config)
```

Ham nay khong query SQL. Ordering canonical:

```text
machine_id, event_start_time, event_id
```

### Time

`next_greater_distinct_event_start_time` dung timestamp distinct cua tung machine, khong dung row ke tiep neu timestamp trung nhau.

| Dieu kien | End | Source |
|---|---|---|
| Raw end > start | raw end | `RAW` |
| Raw end null + next greater start | next start | `NEXT_EVENT_START_FROM_NULL` |
| Raw end <= start + next greater start | next start | `NEXT_EVENT_START_FROM_INVALID_RAW` |
| Khong co end hop le/next start | null | `OPEN_EVENT` |

Sau khi resolve end toan bo event, previous end la `LAG` row ngay truoc cung machine. Time output gom `duration_sec`, `gap_from_prev_sec`, `overlap_sec`, `is_raw_end_missing`, `is_invalid_raw_end`, `is_open_event`, `end_time_imputed_flag`, `is_non_positive_duration`, `is_long_duration`, `is_gap`, `is_big_gap`, `is_overlap` va `time_quality_issue_flag`.

Duration/gap dung integer-second semantics tu floor second, tuong thich `DATEDIFF` SQL. Threshold da khoa:

```text
small_gap_seconds = 300
big_gap_seconds = 3600
long_duration_seconds = 86400
```

`OPEN_EVENT` khong duoc score va khong duoc lam target cuoi L1 window.

### KWh

Raw KWh uu tien. Khong forward/backward fill qua chuoi null va khong dung KWh da impute cua neighbor.

| Gia tri | Rule |
|---|---|
| `kwh_start_value` | raw start; neu null, chi lay raw end cua row ngay truoc khi gap co huong nam `[0, 300]`; neu khong la null |
| `kwh_end_value` | raw end; neu null, chi lay raw start cua row ngay sau khi gap co huong nam `[0, 300]`; neu khong la null |

Nguon KWh: `RAW`, `PREV_EVENT_END`, `NEXT_EVENT_START`, `MISSING`. Rate chi tinh khi KWh day du va duration duong.

Output KWh co raw/available/missing/imputed flags, delta, model value, zero/positive/negative delta, rate va rate-missing flag. KWh raw hien tai co the da duoc source backfill; pipeline giu raw value hien tai, khong lam mat KWh de ep giong historical snapshot.

### Status, quality va segment

Status `1..10` map bang `STATUS_MAP`, khong dua vao text note de lam feature model. Output gom numeric status/current code, `is_on`, `is_loaded`, `is_no_load`, `is_current_near_zero`, fault/maintenance/repair evidence va label audit. Status ngoai map la `UNKNOWN_STATUS`, `status_type_code=-1`; khong ep thanh normal ON/OFF.

```text
time_quality_issue_flag = open OR non-positive duration OR big gap OR overlap
kwh_quality_issue_flag = missing OR imputed OR negative KWh delta
data_quality_issue_flag = time quality OR KWh quality
energy_inconsistency_flag = loaded zero KWh OR loaded unavailable KWh OR negative delta
```

Segment boundary xay ra o event dau machine, big gap, non-positive duration hoac unresolved end. Output: `sequence_segment_id`, `event_order_in_segment`, `is_first_event_in_segment`.

## L1 contract va scoring

Candidate A dung hai artifact:

```text
modeling/l1_tcn/artifacts/lenient/
modeling/l1_tcn/artifacts/strict/
```

Moi profile can `model_best.pt`, `preprocessor.json`, `thresholds.json`. Candidate C trong `artifacts_candidates/` bi runtime contract tu choi.

L1 window dung 20 event that trong cung `machine_id + sequence_segment_id`. Khong du history/open/cross-segment thi co `window_ready_flag=0` va `not_scored_reason`, vi du `OPEN_EVENT`, `INSUFFICIENT_HISTORY_IN_SEGMENT`, `CROSSES_SEGMENT_BOUNDARY`, `MISSING_REQUIRED_FEATURE`.

30 L1 feature theo dung thu tu preprocessor:

```text
status_id, status_type_code, current_signal_code,
hour_of_day, day_of_week, machine_group_id, location_id,
duration_sec, gap_from_prev_sec, overlap_sec,
kwh_delta_model_value, kwh_rate_per_hour,
is_on, is_loaded, is_no_load, is_current_near_zero,
kwh_available_flag, kwh_missing_flag, kwh_imputed_or_missing_flag,
kwh_rate_missing_flag, loaded_zero_kwh_flag, loaded_without_kwh_flag,
is_raw_end_missing, is_invalid_raw_end, end_time_imputed_flag,
is_non_positive_duration, is_long_duration, is_gap, is_big_gap, is_overlap
```

Rule da khoa:

```text
is_behavior_anomaly = is_anomaly_lenient
is_sensitive_warning = is_anomaly_strict AND NOT is_anomaly_lenient
```

Strict-only la audit signal, khong tu dong nang risk/action.

## L2 va policy v2

`feature_builder_l2.py` tao L2 runtime feature tu canonical event va L1 score, sau do loai future label runtime. `l2_scorer.py` doc selection da khoa tai:

```text
data/dataModel/l2/model_report/l2_multilabel_20260711_043347/production_profile_selection.json
```

Sau do load 6 target: fault 10-event, fault 30-event, fault 30-minute, fault 60-minute, maintenance 30-event va repair 30-event. Feature order tung model duoc doi chieu voi `metadata.json`, `l2_feature_policy.json` va train-only L1 clip stats.

Trong production dry-run/smoke, row chi vao L2 khi required feature huu han. Neu L1 da score nhung input L2 khong hop le, row co `readiness_reason` nhu `L2_NON_FINITE_REQUIRED_FEATURE:<column>` hoac `L2_MISSING_REQUIRED_FEATURE:<column>`, khong goi L2/policy va probability/action de null.

Policy v2:

| Action | Dieu kien |
|---|---|
| `CRITICAL` | known/off fault hoac fault 10-event |
| `HIGH` | fault 30-minute, fault 30-event hoac repair 30-event |
| `MEDIUM` | fault 60-minute, maintenance 30-event, known maintenance hoac behavior anomaly lenient |
| `LOW` | Con lai |

Khong co `MONITOR` hoac `SENSITIVE_BEHAVIOR_MONITOR`. Strict-only warning khong duoc lam action tang len.

## Command van hanh

### Live SQL stage-only audit

Can SQL access:

```powershell
python -m inference.online.score_new_events `
  --config inference/online/config.local.yaml `
  --stage-only `
  --audit `
  --max-events 100
```

Lenh nay lay SQL, context, join, canonical L1 va L2 runtime no-op; khong chay L1 PyTorch that, khong L2 predict, khong SQL write.

### Candidate A -> L2 -> policy dry-run

Input canonical Parquet, khong SQL:

```powershell
python -m inference.online.score_new_events `
  --config inference/online/config.example.yaml `
  --production-compatibility-dry-run `
  --dry-run-sample-path data/dataModel/l1_adaptation/l1_candidate_c_current/canonical/machine_id=11/events.parquet `
  --sample-size 500
```

### Multi-machine smoke

Chon 50-100 L1-ready target tren moi canonical partition; chi dung Candidate A artifact:

```powershell
python -m inference.online.score_new_events `
  --config inference/online/config.example.yaml `
  --production-multi-machine-smoke `
  --smoke-canonical-root data/dataModel/l1_adaptation/l1_candidate_c_current/canonical `
  --smoke-events-per-machine 50
```

### Runtime lineage va relocation check

```powershell
python -m inference.online.score_new_events `
  --config inference/online/config.example.yaml `
  --build-production-lineage-manifest

python -m inference.online.score_new_events `
  --config inference/online/config.example.yaml `
  --verify-runtime-relocation
```

Relocation check chi doc file: kiem tra ton tai, SHA256, Candidate C exclusion, `requirements2.txt` va runtime version. No khong SQL, training hay model inference.

## Audit va manifest

Live SQL audit ghi `data/realtime_audit/run_<timestamp>/` voi raw candidate/context, joined canonical event, L1 feature, L2 no-score feature, contract/invariant va summary.

Dry-run ghi `data/realtime_audit/l1_l2_policy_dry_run_<timestamp>/` voi artifact contract, L1/L2 summary, policy distribution, immutability va `dry_run_sample_results.csv.gz`.

Multi-machine smoke them `multi_machine_smoke_global.json`, `multi_machine_smoke_by_machine.json` va `smoke_window_manifest.csv.gz`.

Relocation verification ghi:

```text
data/realtime_audit/runtime_relocation_check_<timestamp>/
  00_summary.json
  file_integrity.json
  environment_check.json
```

`ai_production_lineage_manifest.json` khoa Candidate A, 6 L2 model da chon, policy, clip stats va code fingerprint. `ai_runtime_bundle_manifest.json` liet ke file runtime va SHA256, gom `ai_runtime_environment.json` va `requirements2.txt`; khong gom dataset lon hoac Candidate C artifact.

`requirements2.txt` pin `scikit-learn==1.6.1`. Artifact L2 da serialize voi version nay. Relocation gate warning/fail neu sklearn runtime khac 1.6.1; khong reserialize artifact de xoa warning.

## Gate an toan

1. Stage-only, dry-run, smoke va relocation check khong ghi SQL result.
2. Row unready phai co `readiness_reason`; row unready khong co L2 probability, policy hay action gia.
3. Non-finite tren ready row la failure; null expected tren unready row khong phai model failure.
4. Candidate C bi tu choi trong runtime artifact contract va bundle.
5. Khong automatic promotion, khong sua model weight, threshold hay policy trong read-only action.
6. Source backfill co the thay doi phan phoi input; khong tu dong la loi transformation, nhung can distribution/revalidation audit truoc khi thay doi production.

Ket qua smoke gan nhat o `data/realtime_audit/l1_l2_policy_multi_machine_smoke_20260717_100139/`: 14 machine, 700 L1-ready target, 690 L2-ready, khong NaN/Inf tren ready row, khong MONITOR, strict-only uplift bang 0, SQL write bang 0 va artifact hash khong thay doi.

Relocation integrity gan nhat PASS ve file/hash/Candidate C exclusion; overall chua PASS tren may local vi sklearn runtime la 1.9.0 thay vi 1.6.1.
