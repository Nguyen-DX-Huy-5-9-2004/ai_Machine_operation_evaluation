from __future__ import annotations

import json
from typing import Any, Mapping

import numpy as np
import pandas as pd

from .policy_engine import TARGET_SHORT


EXPLANATION_VERSION = "explanation_v1_policy_evidence"
CONTRIBUTION_METHODOLOGY = "POLICY_EVIDENCE_CONTRIBUTION"


def build_explanation(
    row: Mapping[str, Any],
    thresholds: Mapping[str, float],
    *,
    selected_models: Mapping[str, Mapping[str, Any]] | None = None,
    policy_version: str | None = None,
    historical: bool = False,
) -> dict[str, Any]:
    """Build deterministic evidence, never model inference or invented SHAP values."""
    ready = bool(_number(row.get("l2_ready_flag"), 1 if not historical else 0))
    l1_ready = bool(_number(row.get("l1_score_available_flag"), 0))
    readiness_reason = _text(row.get("readiness_reason")) or ("READY" if ready else "NOT_AVAILABLE_IN_HISTORICAL_EXPORT" if historical else "UNREADY")

    l1 = {
        "available": l1_ready,
        "scoreLenientRaw": _number(row.get("score_lenient")),
        "scoreLenientNormalized": _first_number(row, "score_lenient_normalized", "score_lenient_norm"),
        "thresholdLenient": _number(row.get("threshold_lenient")),
        "marginLenient": _margin(_first_number(row, "score_lenient_normalized", "score_lenient_norm"), 1.0),
        "scoreStrictRaw": _number(row.get("score_strict")),
        "scoreStrictNormalized": _first_number(row, "score_strict_normalized", "score_strict_norm"),
        "thresholdStrict": _number(row.get("threshold_strict")),
        "marginStrict": _margin(_first_number(row, "score_strict_normalized", "score_strict_norm"), 1.0),
        "isBehaviorAnomaly": bool(_number(row.get("is_behavior_anomaly"), 0)),
        "isSensitiveWarning": bool(_number(row.get("is_sensitive_warning"), 0)),
        "behaviorReason": _behavior_reason(row, l1_ready),
    }

    l2_targets: list[dict[str, Any]] = []
    selected_models = selected_models or {}
    for target, short in TARGET_SHORT.items():
        probability = _number(row.get(f"risk_{short}"))
        threshold = _number(thresholds.get(target, thresholds.get(short)))
        model = selected_models.get(target, {})
        l2_targets.append(
            {
                "target": target,
                "probability": probability,
                "threshold": threshold,
                "prediction": None if probability is None or threshold is None else probability >= threshold,
                "margin": _margin(probability, threshold),
                "selectedProfile": model.get("selected_profile") or model.get("profile"),
                "selectedModelRun": model.get("run_id"),
                "available": probability is not None,
            }
        )

    evidence = {
        "knownFaultStatus": _boolean(row, "known_fault_status"),
        "offWithFaultStatus": _boolean(row, "off_with_fault_status"),
        "knownMaintenanceStatus": _boolean(row, "known_maintenance_status"),
        "knownRepairStatus": _boolean(row, "known_repair_status"),
        "faultEvidenceCount": _number(row.get("fault_evidence_count")),
        "maintenanceEvidenceCount": _number(row.get("maintenance_evidence_count")),
        "durationSec": _number(row.get("duration_sec")),
        "gapFromPrevSec": _number(row.get("gap_from_prev_sec")),
        "overlapSec": _number(row.get("overlap_sec")),
        "kwhDelta": _number(row.get("kwh_delta")),
        "kwhRate": _first_number(row, "kwh_rate_per_hour", "kwh_rate_per_hour_model_value"),
        "kwhAvailable": _boolean(row, "kwh_available_flag"),
        "kwhMissing": _boolean(row, "kwh_missing_flag"),
        "kwhImputed": _boolean(row, "kwh_imputed_flag"),
        "kwhSource": _text(row.get("kwh_start_source")) or _text(row.get("kwh_end_source")),
        "loadedZeroKwh": _boolean(row, "loaded_zero_kwh_flag"),
        "loadedWithoutKwh": _boolean(row, "loaded_without_kwh_flag"),
        "negativeKwh": _boolean(row, "kwh_negative_delta_flag"),
        "energyInconsistency": _boolean(row, "energy_inconsistency_flag"),
        "timeQualityIssue": _boolean(row, "time_quality_issue_flag"),
        "kwhQualityIssue": _boolean(row, "kwh_quality_issue_flag"),
        "dataQualityIssue": _boolean(row, "data_quality_issue_flag"),
        "issueCount": _number(row.get("data_quality_issue_count")),
    }

    contributions = decision_contributions(row, thresholds)
    triggered, suppressed = _triggered_rules(row, thresholds)
    policy = {
        "available": ready and bool(_text(row.get("operational_action_level"))),
        "operationalActionLevel": _text(row.get("operational_action_level")),
        "operationalJudgment": _text(row.get("operational_judgment")),
        "operationalOverallRiskScore": _number(row.get("operational_overall_risk_score")),
        "qualityActionLevel": _text(row.get("quality_action_level")),
        "qualityJudgment": _text(row.get("quality_judgment")),
        "qualityRiskScore": _number(row.get("quality_risk_score")),
        "finalReasonV2": _text(row.get("final_reason_v2")),
        "policyVersion": policy_version or _text(row.get("policy_version")),
        "triggeredRules": triggered,
        "suppressedReasons": suppressed,
        "primaryReason": triggered[0] if triggered else None,
        "supportingReasons": triggered[1:],
    }

    return {
        "explanationVersion": EXPLANATION_VERSION,
        "methodology": CONTRIBUTION_METHODOLOGY,
        "availability": ready,
        "historical": historical,
        "readiness": {"l1Ready": l1_ready, "policyReady": ready, "reason": readiness_reason},
        "l1Activation": l1,
        "l2Risks": l2_targets,
        "qualityAndEvidence": evidence,
        "policyDecision": policy,
        "decisionContributions": contributions,
        "notShap": True,
    }


def decision_contributions(row: Mapping[str, Any], thresholds: Mapping[str, float]) -> list[dict[str, Any]]:
    components: list[tuple[str, float]] = []
    l1_margin = max(0.0, (_first_number(row, "score_lenient_normalized", "score_lenient_norm") or 0.0) - 1.0)
    components.append(("L1_BEHAVIOR_MARGIN", l1_margin))
    for target, short in TARGET_SHORT.items():
        probability = _number(row.get(f"risk_{short}"))
        threshold = _number(thresholds.get(target, thresholds.get(short)))
        if probability is not None and threshold is not None:
            components.append((f"L2_{short.upper()}_MARGIN", max(0.0, probability - threshold)))
    components.extend(
        [
            ("KNOWN_FAULT_EVIDENCE", 1.0 if _boolean(row, "known_fault_status") or _boolean(row, "off_with_fault_status") else 0.0),
            ("KNOWN_MAINTENANCE_REPAIR_EVIDENCE", 0.7 if _boolean(row, "known_maintenance_status") or _boolean(row, "known_repair_status") else 0.0),
            ("ENERGY_DATA_QUALITY_EVIDENCE", 0.4 if _boolean(row, "energy_inconsistency_flag") or _boolean(row, "kwh_quality_issue_flag") else 0.0),
            ("TIME_GAP_EVIDENCE", 0.4 if _boolean(row, "time_quality_issue_flag") or _boolean(row, "is_big_gap") or _boolean(row, "is_overlap") else 0.0),
        ]
    )
    positive = [(name, value) for name, value in components if np.isfinite(value) and value > 0]
    total = sum(value for _, value in positive)
    if total <= 0:
        return []
    return [
        {"evidence": name, "rawWeight": round(value, 8), "percent": round(value * 100.0 / total, 6)}
        for name, value in positive
    ]


def explanation_json(*args: Any, **kwargs: Any) -> str:
    return json.dumps(build_explanation(*args, **kwargs), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _triggered_rules(row: Mapping[str, Any], thresholds: Mapping[str, float]) -> tuple[list[str], list[str]]:
    triggered: list[str] = []
    if _boolean(row, "known_fault_status") or _boolean(row, "off_with_fault_status"):
        triggered.append("CRITICAL_KNOWN_OR_OFF_FAULT")
    for target, short in TARGET_SHORT.items():
        risk = _number(row.get(f"risk_{short}"))
        threshold = _number(thresholds.get(target, thresholds.get(short)))
        if risk is not None and threshold is not None and risk >= threshold:
            triggered.append(f"L2_{short.upper()}_THRESHOLD")
    if _boolean(row, "known_maintenance_status"):
        triggered.append("KNOWN_MAINTENANCE")
    if _boolean(row, "is_behavior_anomaly"):
        triggered.append("L1_BEHAVIOR_ANOMALY")
    suppressed = ["STRICT_ONLY_AUDIT_NO_ACTION_UPLIFT"] if _boolean(row, "is_sensitive_warning") and not _boolean(row, "is_behavior_anomaly") else []
    return triggered, suppressed


def _behavior_reason(row: Mapping[str, Any], ready: bool) -> str:
    if not ready:
        return _text(row.get("readiness_reason")) or "L1_WINDOW_NOT_READY"
    if _boolean(row, "is_behavior_anomaly"):
        return "LENIENT_RECONSTRUCTION_THRESHOLD_EXCEEDED"
    if _boolean(row, "is_sensitive_warning"):
        return "STRICT_ONLY_AUDIT_WARNING"
    return "L1_BEHAVIOR_WITHIN_PRODUCTION_THRESHOLD"


def _boolean(row: Mapping[str, Any], key: str) -> bool | None:
    value = _number(row.get(key))
    return None if value is None else bool(value)


def _first_number(row: Mapping[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = _number(row.get(key))
        if value is not None:
            return value
    return None


def _number(value: Any, default: float | None = None) -> float | None:
    if value is None or pd.isna(value):
        return default
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if np.isfinite(parsed) else default


def _text(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def _margin(value: float | None, threshold: float | None) -> float | None:
    return None if value is None or threshold is None else value - threshold
