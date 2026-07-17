# Source Lineage Audit

## 1. SQL hien tai

- Rows: 1367105
- ID: 1.0 -> 1367105.0
- Time: 2026-01-02 04:43:47.466666 -> 2026-06-19 13:43:50

## 2. Raw CSV gan SQL nhat

- File: `data/backData/data_iot_convert.csv`
- Similarity score: 0.0

## 3. Historical L1

- Rows: 4062118
- Event ID: 48043 -> 4145960
- Time: 2025-04-21 23:59:59 -> 2026-06-19 13:43:50

## 4. Event ID identity

- Event ID intersection count: 1304088
- Identity sample match rate: 0.0
- Neu event_id trung so nhung machine/status/time khac, khong duoc dung event_id de validate feature.

## 5. Natural key

- Best key: `machine_time_second_key`
- Best match rate vs SQL: 0.9984908168179509
- Best match rate vs historical: 0.3955382781223471
- Timestamp note: No strong timestamp precision-only pattern detected.

## 6. Co the dung SQL hien tai voi model da train khong?

Decision: `EVENT_ID_REKEYED_BUT_NATURAL_EVENTS_OVERLAP`

Use natural key mapping for feature validation. Do not use event_id for validation.

## 7. File can xem

1. `04_event_id_identity_check.csv`
2. `05_natural_key_alignment_summary.json`
3. `07_event_id_same_but_identity_different_sample.csv`
4. `08_sql_to_historical_natural_mapping_sample.csv`
5. `09_recommended_decision.json`
