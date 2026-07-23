# Historical Replay Architecture

## Scope and safety

Historical replay is a read-only SQL consumer and a file-first producer. Its distinct pipeline namespace is `weldcom_l2_historical_replay_v1`; it never reads or updates `weldcom_l2_realtime_v1`. File-only replay refuses any non-file mode and refuses if any replay SQL write flag is enabled.

## Data path

`dbo.vw_ai_runtime_raw_iot_typed_local` is polled at a five-minute virtual interval using the composite watermark `(event_start_time, event_id)`. Each tick orders source rows by `event_start_time, event_id`, loads bounded per-machine context, applies the existing canonical feature builder, Candidate A L1 lenient/strict scorer, six selected L2 models, Policy v2 and explanation generation.

The event identity is `HISTORICAL_REPLAY:<run_id>:<event_id>`, deliberately distinct from historical-production and online-SQL identities.

## Durable store

Each run is written under `data/replay_runtime/<run_id>/`. Immutable parquet batches are written to a temporary path, fsynced, and atomically renamed before `checkpoint.json` is written. `manifest.json` indexes batches; JSONL files record metrics, errors and state changes. Restart reconstructs a missing checkpoint from a durable frontend batch, preventing a duplicate replay.

## API and UI

The backend reads manifests and bounded frontend parquet batches with an LRU batch cache and a bounded per-machine ring. REST gives snapshots/deltas; SSE emits only later batch sequences. The optional UI client is enabled only when `VITE_REPLAY_RUN_ID` is present. It uses event spacing by default, bounded incremental state and anomaly-preserving downsampling.

## SQL batch flush

`hybrid_batch_flush` and `sql_direct` are rejected today. A future implementation must use a separate confirmation phrase, independent replay checkpoint, batch transaction and idempotent source identity.
