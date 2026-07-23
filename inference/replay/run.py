from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

import pandas as pd

from inference.online.artifacts import load_config, resolve_obad_root

from .engine import HistoricalReplayEngine, apply_preset, artifact_fingerprint
from .processor import TwoLayerReplayProcessor
from .parity import build_parity_report, write_parity_report
from .source import SqlReplaySource
from .types import ReplayConfig


def main() -> int:
    args = parse_args()
    cfg = load_config(args.config)
    replay = ReplayConfig.from_mapping(cfg)
    if args.mode != "file-only":
        raise PermissionError("SQL_WRITE_NOT_APPROVED: replay currently supports only --mode file-only")
    if args.profile:
        profile = json.loads(Path(args.profile).read_text(encoding="utf-8"))
        args.start = args.start or profile.get("replay_start_time")
        args.end = args.end or profile.get("replay_end_time")
    if args.start:
        replay = ReplayConfig(**{**replay.as_dict(), "replay_start_time": datetime.fromisoformat(args.start)})
    if args.end:
        replay = ReplayConfig(**{**replay.as_dict(), "replay_end_time": datetime.fromisoformat(args.end)})
    if replay.replay_start_time is None:
        raise ValueError("--start is required until read-only source bounds are available")
    replay = apply_preset(replay, args.preset)
    source = SqlReplaySource(cfg, replay)
    root = resolve_obad_root(cfg)
    processor = TwoLayerReplayProcessor(cfg, root)
    engine = HistoricalReplayEngine(config=replay, source=source, processor=processor, run_id=args.run_id)
    artifact_paths = [Path(args.config)]
    for key in ("l1_artifact_dir", "l2_artifact_dir", "l2_production_selection", "l2_feature_policy"):
        value = cfg.get("artifacts", {}).get(key)
        if value:
            candidate = Path(value)
            artifact_paths.append(candidate if candidate.is_absolute() else root / candidate)
    engine.open(artifact_fingerprint=artifact_fingerprint(artifact_paths))
    result = engine.run_ticks(args.ticks)
    if args.parity:
        replay_rows = engine.store.events(limit=max(1, args.parity_limit))
        historical_rows = source.load_historical_policy_rows(pd.to_numeric(replay_rows.get("event_id"), errors="coerce").dropna().astype(int).tolist())
        summary, mismatches = build_parity_report(replay_rows, historical_rows)
        write_parity_report(engine.store.root, summary, mismatches)
        result["parity"] = summary
    print(result)
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Read-only historical replay with file-first persistence.")
    parser.add_argument("--config", default="inference/online/config.replay.local.yaml")
    parser.add_argument("--mode", choices=["file-only"], default="file-only")
    parser.add_argument("--preset", choices=["realtime_1x", "demo_fast", "demo_tomorrow", "demo_very_fast", "manual_step"], default="demo_fast")
    parser.add_argument("--start", help="ISO replay start timestamp; required when config has no demo range")
    parser.add_argument("--end", help="Optional ISO replay end timestamp")
    parser.add_argument("--ticks", type=int, default=1)
    parser.add_argument("--run-id")
    parser.add_argument("--profile", help="Read replay start/end from a read-only generated demo profile JSON.")
    parser.add_argument("--audit", action="store_true", help="Reserved; file-only metrics and state logs are always written.")
    parser.add_argument("--parity", action="store_true", help="Read historical Policy v2 rows and write an explicit parity report.")
    parser.add_argument("--parity-limit", type=int, default=5000)
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(main())
