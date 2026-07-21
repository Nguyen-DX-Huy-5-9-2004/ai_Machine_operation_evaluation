"""Read-only path and artifact preflight for the bounded online worker."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from .artifacts import load_config, resolve_obad_root, resolve_runtime_path
from .l1_scorer import L1Scorer
from .l2_scorer import L2Scorer
from .production_lineage_dry_run import POLICY_CONFIG, _selected_l2


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _path_record(name: str, raw: str | Path, root: Path, source_file: str, source_line: int) -> dict[str, Any]:
    resolved = resolve_runtime_path(root, raw, artifact_role=name)
    return {
        "name": name,
        "raw_config_value": str(raw),
        "resolved_value": str(resolved),
        "resolution_base": str(root),
        "exists": resolved.exists(),
        "is_file": resolved.is_file(),
        "source_file": source_file,
        "source_line": source_line,
        "sha256": _sha256(resolved) if resolved.is_file() else None,
        "status": "PASS" if resolved.is_file() else "FAIL",
    }


def run_worker_path_preflight(cfg: dict[str, Any]) -> dict[str, Any]:
    root = resolve_obad_root(cfg)
    artifacts = cfg["artifacts"]
    paths = [
        _path_record("l1_base_config", "modeling/l1_tcn/configs/base.yaml", root, "inference/online/l1_scorer.py", 31),
        _path_record("l1_lenient_model", Path(artifacts["l1_artifact_dir"]) / "lenient/model_best.pt", root, "inference/online/l1_scorer.py", 47),
        _path_record("l1_lenient_preprocessor", Path(artifacts["l1_artifact_dir"]) / "lenient/preprocessor.json", root, "inference/online/l1_scorer.py", 47),
        _path_record("l1_lenient_thresholds", Path(artifacts["l1_artifact_dir"]) / "lenient/thresholds.json", root, "inference/online/l1_scorer.py", 47),
        _path_record("l1_strict_model", Path(artifacts["l1_artifact_dir"]) / "strict/model_best.pt", root, "inference/online/l1_scorer.py", 47),
        _path_record("l1_strict_preprocessor", Path(artifacts["l1_artifact_dir"]) / "strict/preprocessor.json", root, "inference/online/l1_scorer.py", 47),
        _path_record("l1_strict_thresholds", Path(artifacts["l1_artifact_dir"]) / "strict/thresholds.json", root, "inference/online/l1_scorer.py", 47),
        _path_record("l2_production_selection", artifacts["l2_production_selection"], root, "inference/online/l2_scorer.py", 29),
        _path_record("l2_feature_policy", artifacts["l2_feature_policy"], root, "inference/online/l2_scorer.py", 30),
        _path_record("policy_v2", POLICY_CONFIG, root, "inference/online/production_lineage_dry_run.py", 29),
        _path_record("production_lineage_manifest", "data/runtime_manifest/ai_production_lineage_manifest.json", root, "runtime_manifest", 0),
        _path_record("runtime_bundle_manifest", "data/runtime_manifest/ai_runtime_bundle_manifest.json", root, "runtime_manifest", 0),
    ]
    _, _, selected = _selected_l2(root)
    for target, item in sorted(selected.items()):
        paths.append(_path_record(f"l2_{target}_model", item["model_path"], root, "inference/online/l2_scorer.py", 53))
        paths.append(_path_record(f"l2_{target}_metadata", item["metadata_path"], root, "inference/online/l2_scorer.py", 54))

    result = "PASS" if all(item["status"] == "PASS" for item in paths) else "FAIL"
    load_status: dict[str, Any] = {"l1": "NOT_ATTEMPTED", "l2": "NOT_ATTEMPTED"}
    if result == "PASS":
        try:
            l1 = L1Scorer(artifacts)
            load_status["l1"] = {"result": "PASS", "profiles": list(l1.profiles), "device": str(next(iter(l1.profiles.values())).device)}
            l2 = L2Scorer(artifacts)
            load_status["l2"] = {"result": "PASS", "targets": sorted(l2.models), "target_count": len(l2.models)}
        except Exception as exc:  # retain useful failure detail; the caller gates execution.
            load_status["error"] = {"type": type(exc).__name__, "message": str(exc)}
            result = "FAIL"
    return {
        "generated_at": datetime.now().isoformat(),
        "result": result,
        "project_root": str(root),
        "candidate_a_only": True,
        "candidate_c_used": False,
        "paths": paths,
        "load_status": load_status,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only Candidate A and L2 runtime path preflight.")
    parser.add_argument("--config", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    cfg = load_config(args.config)
    cfg.setdefault("artifacts", {})["obad_root"] = str(resolve_obad_root(cfg))
    payload = run_worker_path_preflight(cfg)
    output = Path(args.output_dir).resolve()
    output.mkdir(parents=True, exist_ok=True)
    (output / "worker_artifact_preflight.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"result": payload["result"], "output": str(output)}, ensure_ascii=False))
    return 0 if payload["result"] == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
