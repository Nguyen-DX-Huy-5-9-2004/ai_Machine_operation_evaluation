# Historical Replay Parity

Parity is intentionally explicit, not a fallback that hides mismatch. Compare replay output with the historical L1 sequence/result, L2 confidence and Policy v2 judgment tables by event ID. Classify identifiers and flags as exact, floating scores by a declared tolerance, and expected versus unexpected mismatches.

The replay package provides `inference.replay.parity.write_parity_report` for JSON, markdown and parquet/CSV mismatch output. A credentialed run must include machine 11 and event 48043 before it can be declared parity-accepted. No report in this repository claims a SQL parity pass without that read-only execution.
