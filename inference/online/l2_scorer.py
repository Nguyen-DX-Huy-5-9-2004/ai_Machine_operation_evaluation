from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

import numpy as np
import pandas as pd

from .artifacts import resolve_runtime_path, resolve_runtime_project_root


TARGET_SHORT = {
    "future_fault_within_10_events": "fault_10_events",
    "future_fault_within_30_events": "fault_30_events",
    "future_fault_within_30min": "fault_30min",
    "future_fault_within_60min": "fault_60min",
    "future_maintenance_within_30_events": "maintenance_30_events",
    "future_repair_within_30_events": "repair_30_events",
}


class L2Scorer:
    def __init__(self, cfg: Mapping[str, Any]) -> None:
        self.obad_root = resolve_runtime_project_root({"artifacts": dict(cfg)})
        self.artifact_dir = self._resolve(cfg["l2_artifact_dir"])
        self.selection_path = self._resolve(cfg["l2_production_selection"])
        self.feature_policy_path = self._resolve(cfg["l2_feature_policy"])
        self.selection = json.loads(self.selection_path.read_text(encoding="utf-8"))
        self.feature_policy = json.loads(self.feature_policy_path.read_text(encoding="utf-8"))
        self.models: dict[str, Any] = {}
        self.features: dict[str, list[str]] = {}
        self.categorical_features: dict[str, set[str]] = {}
        self.thresholds: dict[str, float] = {}
        self._load()

    def _resolve(self, raw: str | Path) -> Path:
        return resolve_runtime_path(self.obad_root, raw, artifact_role="l2_runtime_input")

    def _selected_items(self) -> list[dict[str, Any]]:
        targets = self.selection.get("targets", self.selection)
        if isinstance(targets, list):
            return [dict(item) for item in targets]
        if isinstance(targets, dict):
            rows = []
            for target, info in targets.items():
                row = dict(info)
                row.setdefault("target", target)
                rows.append(row)
            return rows
        raise ValueError(f"Unsupported production selection format: {self.selection_path}")

    def _load(self) -> None:
        import joblib

        for item in self._selected_items():
            target = item["target"]
            profile = item.get("selected_profile") or item.get("profile")
            if not profile:
                raise ValueError(f"Missing selected_profile for {target}")
            model_path = self.artifact_dir / profile / target / "model.joblib"
            meta_path = self.artifact_dir / profile / target / "metadata.json"
            if not model_path.exists():
                raise FileNotFoundError(model_path)
            self.models[target] = joblib.load(model_path)
            self.features[target] = self._feature_columns(profile, meta_path)
            self.categorical_features[target] = self._categorical_columns(meta_path)
            self.thresholds[target] = float(
                item.get("valid_threshold")
                or item.get("selected_threshold")
                or item.get("threshold")
                or item.get("best_threshold")
                or 0.5
            )

    def _feature_columns(self, profile: str, meta_path: Path) -> list[str]:
        if meta_path.exists():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            for key in ["feature_columns", "features", "input_features", "selected_features"]:
                value = meta.get(key)
                if isinstance(value, list) and value:
                    return [str(v) for v in value]
        profiles = self.feature_policy.get("feature_profiles", {})
        value = profiles.get(profile)
        if isinstance(value, list) and value:
            return [str(v) for v in value]
        raise RuntimeError(f"Cannot determine L2 features for profile={profile}")

    def _categorical_columns(self, meta_path: Path) -> set[str]:
        if not meta_path.exists():
            return set()
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        value = meta.get("categorical_features")
        if isinstance(value, list):
            return {str(v) for v in value}
        model_meta = meta.get("model_metadata", {})
        value = model_meta.get("categorical_features") if isinstance(model_meta, dict) else None
        if isinstance(value, list):
            return {str(v) for v in value}
        return set()

    def predict(self, features: pd.DataFrame) -> pd.DataFrame:
        out = features.copy()
        missing = self.missing_features(out)
        if missing:
            details = "; ".join(f"{target}: {cols}" for target, cols in missing.items())
            raise ValueError(f"Missing runtime features for L2 models: {details}")
        ready, reasons = self.readiness(out)
        if not ready.all():
            reason_counts = reasons.loc[~ready].value_counts().to_dict()
            raise ValueError(f"Non-finite or invalid L2 model input: {reason_counts}")
        for target, model in self.models.items():
            short = TARGET_SHORT[target]
            feature_cols = self.features[target]
            categorical = self.categorical_features.get(target, set())
            # Preserve the artifact's feature names and order. Passing a named
            # DataFrame avoids LightGBM's feature-name warning without altering
            # feature values, dtypes, query results, or model behavior.
            x = out.reindex(columns=feature_cols).copy()
            for column in feature_cols:
                if column in categorical:
                    x[column] = pd.to_numeric(x[column], errors="raise").astype("int32")
                else:
                    x[column] = pd.to_numeric(x[column], errors="raise").astype(float)
            proba = model.predict_proba(x)[:, 1]
            if not np.isfinite(proba).all():
                raise RuntimeError(f"L2 model produced non-finite probability for {target}")
            threshold = self.thresholds[target]
            out[f"risk_{short}"] = proba
            out[f"threshold_{short}"] = threshold
            out[f"pred_{short}"] = (proba >= threshold).astype("int8")
        return out

    def readiness(self, features: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
        """Return per-row readiness without filling a required model input."""
        ready = pd.Series(True, index=features.index, dtype=bool)
        reasons = pd.Series("READY", index=features.index, dtype="object")
        required = list(dict.fromkeys(column for columns in self.features.values() for column in columns))
        for column in required:
            if column not in features.columns:
                bad = pd.Series(True, index=features.index)
                reason = f"L2_MISSING_REQUIRED_FEATURE:{column}"
            else:
                numeric = pd.to_numeric(features[column], errors="coerce").to_numpy(dtype=float, na_value=np.nan)
                bad = pd.Series(~np.isfinite(numeric), index=features.index)
                reason = f"L2_NON_FINITE_REQUIRED_FEATURE:{column}"
            first_failure = ready & bad
            reasons.loc[first_failure] = reason
            ready &= ~bad
        return ready, reasons

    def missing_features(self, features: pd.DataFrame) -> dict[str, list[str]]:
        missing: dict[str, list[str]] = {}
        columns = set(features.columns)
        for target, feature_cols in self.features.items():
            target_missing = [column for column in feature_cols if column not in columns]
            if target_missing:
                missing[target] = target_missing
        return missing
