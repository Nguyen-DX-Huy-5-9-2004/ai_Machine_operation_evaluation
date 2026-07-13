from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping

import pandas as pd


class L1Scorer:
    """Runtime adapter for L1.

    The first realtime phase focuses on rebuilding event features. L1 PyTorch
    scoring is deliberately disabled by default until online windows are
    validated against the historical L1 dataset.
    """

    def __init__(self, cfg: Mapping[str, Any]) -> None:
        self.enabled = bool(cfg.get("l1_enabled", False))
        self.artifact_dir = Path(str(cfg.get("l1_artifact_dir", "")))
        if self.enabled:
            raise NotImplementedError(
                "L1 realtime scorer is not enabled yet. Validate stage-only data first, "
                "then wire TCN artifacts/preprocessor here."
            )

    def score(self, features: pd.DataFrame) -> pd.DataFrame:
        out = features.copy()
        for column in [
            "score_lenient",
            "score_strict",
            "score_lenient_norm",
            "score_strict_norm",
            "behavior_anomaly_score",
            "behavior_sensitive_score",
            "behavior_combined_score",
        ]:
            out[column] = 0.0
        out["is_behavior_anomaly"] = 0
        out["is_sensitive_warning"] = 0
        out["l1_score_available_flag"] = 0
        out["l1_join_missing_flag"] = 1
        return out
