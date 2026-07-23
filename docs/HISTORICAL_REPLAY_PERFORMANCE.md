# Historical Replay Performance

`metrics.jsonl` records batch size, L1-ready/unready counts, policy-ready count and processor latency. The engine also reports per-tick latency. The backend status exposes LRU cache hits/misses and entries.

For acceptance, measure p50/p95 SQL-read, canonical, L1, L2/policy, file persistence and API response latency on the target workstation. This repository does not claim those measurements until a credentialed file-only run has completed. Memory is bounded by the backend LRU batch cache and per-machine ring; frontend state is capped at 1,500 events per panel.
