from __future__ import annotations

from typing import Mapping

import numpy as np
import pandas as pd


TARGET_SHORT = {
    "future_fault_within_10_events": "fault_10_events",
    "future_fault_within_30_events": "fault_30_events",
    "future_fault_within_30min": "fault_30min",
    "future_fault_within_60min": "fault_60min",
    "future_maintenance_within_30_events": "maintenance_30_events",
    "future_repair_within_30_events": "repair_30_events",
}


def apply_policy_v2(
    df: pd.DataFrame,
    thresholds: Mapping[str, float],
    *,
    threshold_epsilon: float = 1e-6,
    policy_version: str = "policy_v2_operational_quality_split_sensitive_audit_only",
) -> pd.DataFrame:
    out = df.copy()

    for target, short in TARGET_SHORT.items():
        risk_col = f"risk_{short}"
        threshold = float(thresholds.get(target, thresholds.get(short, 1.0)))
        policy_threshold = max(threshold - threshold_epsilon, 0.0)
        out[f"policy_threshold_{short}"] = policy_threshold
        out[f"policy_pred_{short}"] = (_float(out, risk_col) >= policy_threshold).astype("int8")

    known_fault = _bool(out, "known_fault_status")
    known_repair = _bool(out, "known_repair_status")
    known_maint = _bool(out, "known_maintenance_status")
    off_fault = _bool(out, "off_with_fault_status")
    l1_behavior = _bool(out, "is_behavior_anomaly")

    p10 = _bool(out, "policy_pred_fault_10_events")
    p30e = _bool(out, "policy_pred_fault_30_events")
    p30m = _bool(out, "policy_pred_fault_30min")
    p60m = _bool(out, "policy_pred_fault_60min")
    pm = _bool(out, "policy_pred_maintenance_30_events")
    pr = _bool(out, "policy_pred_repair_30_events")

    r10 = _float(out, "risk_fault_10_events")
    r30e = _float(out, "risk_fault_30_events")
    r30m = _float(out, "risk_fault_30min")
    r60m = _float(out, "risk_fault_60min")
    rm = _float(out, "risk_maintenance_30_events")
    rr = _float(out, "risk_repair_30_events")

    critical = known_fault | off_fault | p10
    high = (~critical) & (p30m | p30e | pr)
    medium = (~critical) & (~high) & (p60m | pm | known_maint | l1_behavior)

    out["operational_action_level"] = np.select(
        [critical, high, medium],
        ["CRITICAL", "HIGH", "MEDIUM"],
        default="LOW",
    )
    out["operational_judgment"] = np.select(
        [
            known_fault | off_fault,
            p10,
            p30m | p30e,
            pr | known_repair,
            p60m,
            pm | known_maint,
            l1_behavior,
        ],
        [
            "KNOWN_FAULT_CONFIRMED",
            "PRE_FAULT_CRITICAL_NEAR_TERM",
            "PRE_FAULT_HIGH_CONFIDENCE",
            "REPAIR_RELATED",
            "PRE_FAULT_MEDIUM_CONFIDENCE",
            "MAINTENANCE_RELATED",
            "UNKNOWN_BEHAVIOR_ANOMALY",
        ],
        default="NORMAL_LIKE",
    )

    data_q = _bool(out, "data_quality_issue_flag")
    energy = _bool(out, "energy_inconsistency_flag")
    kwh_q = _bool(out, "kwh_quality_issue_flag")
    time_q = _bool(out, "time_quality_issue_flag")

    out["quality_judgment"] = np.select(
        [data_q & energy, data_q, energy, kwh_q, time_q],
        ["DATA_AND_ENERGY_QUALITY_ISSUE", "DATA_QUALITY_ISSUE", "ENERGY_INCONSISTENCY", "KWH_QUALITY_ISSUE", "TIME_QUALITY_ISSUE"],
        default="QUALITY_OK",
    )
    out["quality_action_level"] = np.select(
        [data_q & energy, data_q, energy, kwh_q | time_q],
        ["CHECK_DATA_AND_ENERGY", "CHECK_DATA", "CHECK_ENERGY", "CHECK_DATA_DETAIL"],
        default="QUALITY_OK",
    )

    quality_risk = np.zeros(len(out), dtype=float)
    quality_risk = np.maximum(quality_risk, data_q.to_numpy().astype(float) * 0.60)
    quality_risk = np.maximum(quality_risk, energy.to_numpy().astype(float) * 0.50)
    quality_risk = np.maximum(quality_risk, kwh_q.to_numpy().astype(float) * 0.40)
    quality_risk = np.maximum(quality_risk, time_q.to_numpy().astype(float) * 0.40)
    out["quality_risk_score"] = quality_risk

    model_fault = np.maximum.reduce([r10, r30e, r30m, r60m])
    out["operational_fault_confidence_score"] = np.maximum.reduce(
        [
            model_fault,
            (known_fault | off_fault).to_numpy().astype(float),
            known_repair.to_numpy().astype(float) * 0.85,
            l1_behavior.to_numpy().astype(float) * 0.20,
        ]
    )
    out["operational_maintenance_confidence_score"] = np.maximum(rm.to_numpy(), known_maint.to_numpy().astype(float) * 0.70)
    out["operational_repair_confidence_score"] = np.maximum(rr.to_numpy(), known_repair.to_numpy().astype(float) * 0.85)
    out["operational_overall_risk_score"] = np.maximum.reduce(
        [
            out["operational_fault_confidence_score"].to_numpy(),
            out["operational_maintenance_confidence_score"].to_numpy(),
            out["operational_repair_confidence_score"].to_numpy(),
        ]
    )

    out["action_level_v2"] = out["operational_action_level"]
    out["fault_judgment_v2"] = out["operational_judgment"]
    out["final_reason_v2"] = (
        "op=" + out["operational_judgment"].astype(str)
        + "|op_action=" + out["operational_action_level"].astype(str)
        + "|quality=" + out["quality_judgment"].astype(str)
        + "|quality_action=" + out["quality_action_level"].astype(str)
    )
    out["policy_version"] = policy_version
    return out


def _bool(df: pd.DataFrame, column: str) -> pd.Series:
    if column not in df.columns:
        return pd.Series(False, index=df.index)
    return pd.to_numeric(df[column], errors="coerce").fillna(0).astype(bool)


def _float(df: pd.DataFrame, column: str) -> pd.Series:
    if column not in df.columns:
        return pd.Series(0.0, index=df.index, dtype=float)
    return pd.to_numeric(df[column], errors="coerce").fillna(0.0).astype(float)
