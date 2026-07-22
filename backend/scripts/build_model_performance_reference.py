from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "backend/data/reference/model_performance_reference.json"
SELECTION = ROOT / "data/dataModel/l2/model_report/l2_multilabel_20260711_043347/production_profile_selection.json"
LINEAGE = ROOT / "data/runtime_manifest/ai_production_lineage_manifest.json"


def _read(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return value


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _logical(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def build_reference() -> dict[str, Any]:
    lineage = _read(LINEAGE)
    selection = _read(SELECTION)
    provenance: list[dict[str, Any]] = []
    missing: list[str] = []
    profiles = []
    for profile in ("lenient", "strict"):
        source = ROOT / f"modeling/l1_tcn/artifacts/{profile}/valid_anomaly_summary.json"
        summary = _read(source)
        provenance.append({"role": f"l1_{profile}_valid", "path": _logical(source), "sha256": _sha256(source)})
        profiles.append({
            "profile": profile, "candidate": "A", "promoted": True, "split": "valid",
            "normalFpr": summary.get("anomaly_rate"), "knownFaultRecall": None,
            "precision": None, "f1": None, "support": summary.get("total_windows"),
            "sourceArtifact": _logical(source), "sourceHash": _sha256(source),
        })
        missing.extend([f"l1.{profile}.knownFaultRecall", f"l1.{profile}.precision", f"l1.{profile}.f1"])
    targets = []
    for row in selection.get("targets", []):
        targets.append({
            "target": row.get("target"), "profile": row.get("selected_profile"), "split": "valid",
            "positiveRate": None, "normalFpr": None, "knownFaultRecall": None,
            "precision": None, "f1": row.get("test_threshold_f1"),
            "auroc": row.get("test_roc_auc"), "prAuc": row.get("valid_metric_value"),
            "testPrAuc": row.get("test_average_precision"), "support": None,
            "threshold": row.get("valid_threshold"), "sourceArtifact": _logical(SELECTION),
            "sourceHash": _sha256(SELECTION),
        })
        missing.extend([f"l2.{row.get('target')}.positiveRate", f"l2.{row.get('target')}.support"])
    provenance.extend([
        {"role": "l2_production_selection", "path": _logical(SELECTION), "sha256": _sha256(SELECTION)},
        {"role": "production_lineage", "path": _logical(LINEAGE), "sha256": _sha256(LINEAGE)},
    ])
    return {
        "schemaVersion": "1.0", "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceType": "MODEL_ARTIFACT_REFERENCE", "isDatabaseBacked": False, "isMock": False,
        "l1": {"selectedCandidate": "A", "windowSize": lineage.get("l1_window_size"), "profiles": profiles},
        "l2": {"runId": lineage.get("l2_run_id"), "targets": targets},
        "policy": {"version": "policy_v2_operational_quality_split_sensitive_audit_only", "lineageHash": lineage.get("content_sha256"), "sourceManifest": _logical(LINEAGE)},
        "missingMetrics": sorted(missing), "provenance": provenance,
    }


def main() -> None:
    payload = build_reference()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(json.dumps({"result": "PASS", "output": _logical(OUTPUT), "targets": len(payload["l2"]["targets"])}, indent=2))


if __name__ == "__main__":
    main()
