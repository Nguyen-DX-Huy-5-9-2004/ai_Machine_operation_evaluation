from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping

import numpy as np
import pandas as pd

from .l1_shadow import (
    artifact_contract,
    build_window_manifest,
    combine_shadow_scores,
    load_l1_base_config,
    load_shadow_profile,
    rows_for_ready_windows,
    score_windows,
)
from .artifacts import RuntimePathResolutionError, resolve_runtime_path, resolve_runtime_project_root


class L1Scorer:
    """Candidate A runtime scorer using the locked canonical window contract."""

    def __init__(self, cfg: Mapping[str, Any]) -> None:
        self.project_root = resolve_runtime_project_root({"artifacts": dict(cfg)})
        configured = Path(str(cfg.get("l1_artifact_dir", "modeling/l1_tcn/artifacts")))
        self.artifact_root = resolve_runtime_path(
            self.project_root, configured, artifact_role="candidate_a_l1_artifact_root"
        )
        expected = (self.project_root / "modeling/l1_tcn/artifacts").resolve()
        if self.artifact_root != expected or "artifacts_candidates" in self.artifact_root.parts:
            raise ValueError(f"Candidate A runtime must use {expected}; Candidate C paths are forbidden")
        base_cfg_path = resolve_runtime_path(
            self.project_root,
            "modeling/l1_tcn/configs/base.yaml",
            artifact_role="l1_base_config",
            require_exists=True,
        )
        try:
            self.base_cfg = load_l1_base_config(self.project_root)
        except FileNotFoundError as exc:
            raise RuntimePathResolutionError(
                error_code="L1_BASE_CONFIG_MISSING",
                requested_path="modeling/l1_tcn/configs/base.yaml",
                resolved_path=base_cfg_path,
                project_root=self.project_root,
                artifact_role="l1_base_config",
            ) from exc
        for profile in ("lenient", "strict"):
            for filename, role in (
                ("model_best.pt", "model"),
                ("preprocessor.json", "preprocessor"),
                ("thresholds.json", "thresholds"),
            ):
                resolve_runtime_path(
                    self.project_root,
                    self.artifact_root / profile / filename,
                    artifact_role=f"l1_{profile}_{role}",
                    require_exists=True,
                )
        self.profiles = {
            profile: load_shadow_profile(
                self.project_root,
                profile,
                self.base_cfg,
                artifact_dir=self.artifact_root / profile,
            )
            for profile in ("lenient", "strict")
        }
        self.contract = artifact_contract(self.project_root, list(self.profiles.values()), self.base_cfg)
        if self.contract.get("result") != "PASS":
            raise RuntimeError(f"Candidate A artifact contract failed: {self.contract}")

    def score(
        self,
        features_with_context: pd.DataFrame,
        *,
        candidate_ids: set[int] | None = None,
        batch_size: int = 512,
    ) -> pd.DataFrame:
        if features_with_context.empty:
            return features_with_context.copy()
        candidate_ids = candidate_ids or set(pd.to_numeric(features_with_context["event_id"], errors="raise").astype(int))
        manifest = build_window_manifest(features_with_context, candidate_ids, window_size=20)
        ready_rows = rows_for_ready_windows(features_with_context, manifest)
        scores: dict[str, pd.DataFrame] = {}
        for profile_name, profile in self.profiles.items():
            scores[profile_name] = score_windows(profile, self.base_cfg, ready_rows, batch_size=batch_size)[0]
        combined = combine_shadow_scores(manifest, scores["lenient"], scores["strict"])
        runtime_scores = _runtime_score_columns(combined)
        targets = features_with_context[
            pd.to_numeric(features_with_context["event_id"], errors="coerce").astype("Int64").isin(candidate_ids)
        ].copy()
        out = targets.merge(runtime_scores, on="event_id", how="left", validate="one_to_one")
        missing_manifest = out["l1_score_available_flag"].isna()
        if missing_manifest.any():
            out.loc[missing_manifest, "l1_score_available_flag"] = 0
            out.loc[missing_manifest, "l1_join_missing_flag"] = 1
            out.loc[missing_manifest, "readiness_reason"] = "MISSING_WINDOW_MANIFEST"
        return out


def _runtime_score_columns(scores: pd.DataFrame) -> pd.DataFrame:
    columns = [
        "event_id",
        "window_ready_flag",
        "not_scored_reason",
        "score_lenient",
        "score_strict",
        "threshold_lenient",
        "threshold_strict",
        "score_lenient_normalized",
        "score_strict_normalized",
        "is_anomaly_lenient",
        "is_anomaly_strict",
        "is_behavior_anomaly",
        "is_sensitive_warning",
    ]
    out = scores.reindex(columns=columns).copy()
    out["score_lenient_norm"] = pd.to_numeric(out["score_lenient_normalized"], errors="coerce")
    out["score_strict_norm"] = pd.to_numeric(out["score_strict_normalized"], errors="coerce")
    out["behavior_anomaly_score"] = out["score_lenient_norm"]
    out["behavior_sensitive_score"] = out["score_strict_norm"]
    out["behavior_combined_score"] = out[["behavior_anomaly_score", "behavior_sensitive_score"]].max(axis=1)
    out["l1_score_available_flag"] = pd.to_numeric(out["window_ready_flag"], errors="coerce").fillna(0).astype("int8")
    out["l1_join_missing_flag"] = (out["l1_score_available_flag"] == 0).astype("int8")
    out["readiness_reason"] = np.where(
        out["l1_score_available_flag"].eq(1),
        "READY",
        out["not_scored_reason"].fillna("L1_WINDOW_NOT_READY").astype(str),
    )
    score_columns = [
        "score_lenient",
        "score_strict",
        "score_lenient_normalized",
        "score_strict_normalized",
        "score_lenient_norm",
        "score_strict_norm",
        "behavior_anomaly_score",
        "behavior_sensitive_score",
        "behavior_combined_score",
    ]
    unready = out["l1_score_available_flag"].eq(0)
    out.loc[unready, score_columns] = np.nan
    return out.drop(columns=["window_ready_flag"])
