from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Mapping

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class StatusSemantics:
    status_id: int
    status_type_code: int
    current_signal_code: float
    status_type_label: str
    current_signal_label: str
    is_on: int
    is_loaded: int
    is_no_load: int
    is_current_near_zero: int
    has_error_token: int
    has_maintenance_token: int
    known_fault_status: int
    known_maintenance_status: int
    known_repair_status: int
    off_with_fault_status: int
    info_status: int
    normal_loaded_production_status: int
    normal_no_load_production_status: int
    power_on_near_zero_status: int
    normal_power_off_status: int
    status_evidence_class: str


STATUS_MAP: dict[int, StatusSemantics] = {
    1: StatusSemantics(1, 1, 0.0, "POWER_ON", "ON_CURRENT_NEAR_ZERO", 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, "POWER_ON_NEAR_ZERO"),
    2: StatusSemantics(2, 1, 1.0, "RUN_PRODUCTION_NO_LOAD", "ON_NO_LOAD", 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, "NORMAL_NO_LOAD_PRODUCTION"),
    3: StatusSemantics(3, 1, 2.0, "RUN_PRODUCTION_LOADED", "ON_LOADED", 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, "NORMAL_LOADED_PRODUCTION"),
    4: StatusSemantics(4, 1, 1.0, "RUN_MAINTENANCE_NO_LOAD", "ON_NO_LOAD_MAINTENANCE", 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, "MAINTENANCE_STATUS"),
    5: StatusSemantics(5, 1, 2.0, "RUN_MAINTENANCE_LOADED", "ON_LOADED_MAINTENANCE", 1, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, "MAINTENANCE_STATUS"),
    6: StatusSemantics(6, 1, 1.0, "RUN_REPAIR_NO_LOAD", "ON_NO_LOAD_REPAIR", 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, "REPAIR_STATUS"),
    7: StatusSemantics(7, 1, 2.0, "RUN_REPAIR_LOADED", "ON_LOADED_REPAIR", 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, "REPAIR_STATUS"),
    8: StatusSemantics(8, 0, np.nan, "POWER_OFF", "OFF_NORMAL", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, "NORMAL_POWER_OFF"),
    9: StatusSemantics(9, 0, np.nan, "POWER_OFF_FAULT", "OFF_WITH_FAULT", 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, "OFF_WITH_FAULT"),
    10: StatusSemantics(10, 0, np.nan, "POWER_OFF_MAINTENANCE", "OFF_MAINTENANCE", 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, "OFF_WITH_FAULT"),
}


def get_status_semantics(status_id: int) -> StatusSemantics:
    return STATUS_MAP.get(
        int(status_id),
        StatusSemantics(int(status_id), -1, np.nan, "UNKNOWN", "UNKNOWN", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, "UNKNOWN_STATUS"),
    )


def build_realtime_features(
    raw_events: pd.DataFrame,
    *,
    location_map: pd.DataFrame | None = None,
    kwh_gap_limit_seconds: int = 300,
    small_gap_seconds: int = 300,
    big_gap_seconds: int = 3600,
    long_duration_seconds: int = 86400,
) -> pd.DataFrame:
    """Build event-level features using the same rules documented for training."""
    if raw_events.empty:
        return pd.DataFrame()

    df = raw_events.copy()
    df["event_start_time"] = pd.to_datetime(df["event_start_time"], errors="coerce")
    df["raw_event_end_time"] = pd.to_datetime(df["raw_event_end_time"], errors="coerce")
    df["event_id"] = pd.to_numeric(df["event_id"], errors="coerce").astype("Int64")
    df["machine_id"] = pd.to_numeric(df["machine_id"], errors="coerce").astype("Int64")
    df["status_id"] = pd.to_numeric(df["status_id"], errors="coerce").fillna(-1).astype(int)
    df = df.sort_values(["machine_id", "event_start_time", "event_id"]).reset_index(drop=True)

    grp = df.groupby("machine_id", group_keys=False)
    df["next_event_start_time"] = _next_greater_distinct_start(df)
    raw_valid = df["raw_event_end_time"].notna() & (df["raw_event_end_time"] > df["event_start_time"])
    next_ok = df["next_event_start_time"].notna() & (df["next_event_start_time"] > df["event_start_time"])

    df["event_end_time"] = pd.NaT
    df.loc[raw_valid, "event_end_time"] = df.loc[raw_valid, "raw_event_end_time"]
    df.loc[~raw_valid & next_ok, "event_end_time"] = df.loc[~raw_valid & next_ok, "next_event_start_time"]
    df["end_time_source"] = np.select(
        [
            raw_valid,
            (~raw_valid) & df["raw_event_end_time"].isna() & next_ok,
            (~raw_valid) & df["raw_event_end_time"].notna() & next_ok,
            (~raw_valid) & (~next_ok),
        ],
        ["RAW", "NEXT_EVENT_START_FROM_NULL", "NEXT_EVENT_START_FROM_INVALID_RAW", "OPEN_EVENT"],
        default="UNRESOLVED_INVALID_TIME",
    )

    df["is_raw_end_missing"] = df["raw_event_end_time"].isna().astype("int8")
    df["is_invalid_raw_end"] = (df["raw_event_end_time"].notna() & (df["raw_event_end_time"] <= df["event_start_time"])).astype("int8")
    df["is_open_event"] = (df["end_time_source"] == "OPEN_EVENT").astype("int8")
    df["end_time_imputed_flag"] = df["end_time_source"].isin(["NEXT_EVENT_START_FROM_NULL", "NEXT_EVENT_START_FROM_INVALID_RAW"]).astype("int8")
    df["duration_sec"] = _datediff_seconds(df["event_start_time"], df["event_end_time"])
    df["duration_sec_model_value"] = df["duration_sec"].fillna(0).clip(lower=0)
    df["prev_event_end_time"] = grp["event_end_time"].shift(1)
    df["gap_from_prev_sec"] = _datediff_seconds(df["prev_event_end_time"], df["event_start_time"])
    df["gap_from_prev_sec_model_value"] = df["gap_from_prev_sec"].fillna(0)
    df["overlap_sec"] = (-df["gap_from_prev_sec"]).clip(lower=0).fillna(0)
    df["is_non_positive_duration"] = ((df["duration_sec"].fillna(0) <= 0) & (df["is_open_event"] == 0)).astype("int8")
    df["is_long_duration"] = (df["duration_sec"].fillna(0) > long_duration_seconds).astype("int8")
    df["is_gap"] = (df["gap_from_prev_sec"].fillna(0) > small_gap_seconds).astype("int8")
    df["is_big_gap"] = (df["gap_from_prev_sec"].fillna(0) > big_gap_seconds).astype("int8")
    df["is_overlap"] = (df["overlap_sec"] > 0).astype("int8")

    semantics = pd.DataFrame([asdict(get_status_semantics(status_id)) for status_id in df["status_id"]])
    for column in semantics.columns:
        if column != "status_id":
            df[column] = semantics[column].values

    _add_kwh_features(df, kwh_gap_limit_seconds)
    _add_quality_features(df)
    _add_context_features(df, location_map)
    _add_sequence_features(df)
    return df


def build_l1_event_features(
    raw_events: pd.DataFrame,
    machine_status: pd.DataFrame | None = None,
    machine_context: pd.DataFrame | None = None,
    location_context: pd.DataFrame | None = None,
    config: Mapping | None = None,
) -> pd.DataFrame:
    """Pure DataFrame transformer for canonical L1 event rows.

    SQL loading stays outside this function. ``machine_status`` and
    ``machine_context`` are accepted so tests/offline replay can pass the same
    inputs as the SQL pipeline; canonical status_id 1-10 remains the source of
    model features.
    """
    runtime = (config or {}).get("runtime", {}) if isinstance(config, Mapping) else {}
    location_map = location_context
    if machine_context is not None and not machine_context.empty:
        if location_map is None or location_map.empty:
            location_map = machine_context
        elif "machine_group_id" not in location_map.columns and "machine_group_id" in machine_context.columns:
            location_map = location_map.merge(
                machine_context[["machine_id", "machine_group_id"]].drop_duplicates("machine_id"),
                on="machine_id",
                how="left",
            )
    return build_realtime_features(
        raw_events,
        location_map=location_map,
        kwh_gap_limit_seconds=int(runtime.get("kwh_impute_gap_limit_seconds", 300)),
        small_gap_seconds=int(runtime.get("small_gap_seconds", 300)),
        big_gap_seconds=int(runtime.get("big_gap_seconds", 3600)),
        long_duration_seconds=int(runtime.get("long_duration_seconds", 86400)),
    )


def _add_kwh_features(df: pd.DataFrame, kwh_gap_limit_seconds: int) -> None:
    df["raw_status_kwh_start"] = pd.to_numeric(df.get("raw_status_kwh_start"), errors="coerce")
    df["raw_status_kwh_end"] = pd.to_numeric(df.get("raw_status_kwh_end"), errors="coerce")
    grp = df.groupby("machine_id", group_keys=False)
    df["prev_raw_status_kwh_end"] = grp["raw_status_kwh_end"].shift(1)
    # KWh is resolved from the adjacent ordered event (SQL ``LEAD``), unlike
    # end-time repair which deliberately uses the next *greater* start time.
    df["next_raw_status_kwh_start"] = grp["raw_status_kwh_start"].shift(-1)
    df["prev_event_end_for_kwh"] = grp["event_end_time"].shift(1)
    df["next_event_start_for_kwh"] = grp["event_start_time"].shift(-1)

    df["kwh_start_value"] = df["raw_status_kwh_start"]
    df["kwh_end_value"] = df["raw_status_kwh_end"]
    df["kwh_start_source"] = np.where(df["kwh_start_value"].notna(), "RAW", "MISSING")
    df["kwh_end_source"] = np.where(df["kwh_end_value"].notna(), "RAW", "MISSING")

    # Historical SQL permits KWh carry-over only in chronological order:
    # ``gap_from_prev_sec BETWEEN 0 AND @KwhFillMaxGapSec``.  An absolute
    # difference would incorrectly impute across an overlap.
    gap_prev = (df["event_start_time"] - df["prev_event_end_for_kwh"]).dt.total_seconds()
    fill_start = df["kwh_start_value"].isna() & df["prev_raw_status_kwh_end"].notna() & gap_prev.notna() & (gap_prev.between(0, kwh_gap_limit_seconds))
    df.loc[fill_start, "kwh_start_value"] = df.loc[fill_start, "prev_raw_status_kwh_end"]
    df.loc[fill_start, "kwh_start_source"] = "PREV_EVENT_END"

    gap_next = (df["next_event_start_for_kwh"] - df["event_end_time"]).dt.total_seconds()
    fill_end = df["kwh_end_value"].isna() & df["next_raw_status_kwh_start"].notna() & gap_next.notna() & (gap_next.between(0, kwh_gap_limit_seconds))
    df.loc[fill_end, "kwh_end_value"] = df.loc[fill_end, "next_raw_status_kwh_start"]
    df.loc[fill_end, "kwh_end_source"] = "NEXT_EVENT_START"

    df["kwh_raw_available_flag"] = (df["raw_status_kwh_start"].notna() & df["raw_status_kwh_end"].notna()).astype("int8")
    df["kwh_available_flag"] = (df["kwh_start_value"].notna() & df["kwh_end_value"].notna()).astype("int8")
    df["kwh_missing_flag"] = (df["kwh_available_flag"] == 0).astype("int8")
    df["kwh_start_imputed_flag"] = (df["kwh_start_source"] == "PREV_EVENT_END").astype("int8")
    df["kwh_end_imputed_flag"] = (df["kwh_end_source"] == "NEXT_EVENT_START").astype("int8")
    df["kwh_imputed_flag"] = ((df["kwh_start_imputed_flag"] == 1) | (df["kwh_end_imputed_flag"] == 1)).astype("int8")
    df["kwh_imputed_or_missing_flag"] = ((df["kwh_imputed_flag"] == 1) | (df["kwh_missing_flag"] == 1)).astype("int8")
    df["kwh_delta"] = df["kwh_end_value"] - df["kwh_start_value"]
    df.loc[df["kwh_available_flag"] == 0, "kwh_delta"] = np.nan
    df["kwh_delta_model_value"] = df["kwh_delta"].fillna(0)
    df["kwh_zero_delta_flag"] = ((df["kwh_available_flag"] == 1) & (df["kwh_delta"].fillna(0) == 0)).astype("int8")
    df["kwh_positive_delta_flag"] = ((df["kwh_available_flag"] == 1) & (df["kwh_delta"].fillna(0) > 0)).astype("int8")
    df["kwh_negative_delta_flag"] = ((df["kwh_available_flag"] == 1) & (df["kwh_delta"].fillna(0) < 0)).astype("int8")

    hours = df["duration_sec"] / 3600.0
    valid_rate = (df["kwh_available_flag"] == 1) & hours.notna() & (hours > 0)
    df["kwh_rate_per_hour"] = np.nan
    df.loc[valid_rate, "kwh_rate_per_hour"] = df.loc[valid_rate, "kwh_delta"] / hours.loc[valid_rate]
    df["kwh_rate_per_hour_model_value"] = df["kwh_rate_per_hour"].fillna(0)
    df["kwh_rate_missing_flag"] = df["kwh_rate_per_hour"].isna().astype("int8")


def _add_quality_features(df: pd.DataFrame) -> None:
    df["loaded_positive_kwh_flag"] = ((df["is_loaded"] == 1) & (df["kwh_delta"].fillna(0) > 0)).astype("int8")
    df["loaded_zero_kwh_flag"] = ((df["is_loaded"] == 1) & (df["kwh_available_flag"] == 1) & (df["kwh_delta"].fillna(0) == 0)).astype("int8")
    df["loaded_without_kwh_flag"] = ((df["is_loaded"] == 1) & (df["kwh_available_flag"] == 0)).astype("int8")
    df["energy_counter_suspect_flag"] = (df["kwh_negative_delta_flag"] == 1).astype("int8")
    df["loaded_energy_unavailable_flag"] = df["loaded_without_kwh_flag"]
    df["loaded_energy_positive_evidence"] = df["loaded_positive_kwh_flag"]
    df["energy_inconsistency_flag"] = (
        ((df["is_loaded"] == 1) & ((df["loaded_zero_kwh_flag"] == 1) | (df["loaded_without_kwh_flag"] == 1)))
        | (df["kwh_negative_delta_flag"] == 1)
    ).astype("int8")

    df["time_quality_issue_flag"] = (
        (df["is_open_event"] == 1)
        | (df["is_non_positive_duration"] == 1)
        | (df["is_big_gap"] == 1)
        | (df["is_overlap"] == 1)
    ).astype("int8")
    df["time_imputed_or_repaired_flag"] = df["end_time_imputed_flag"]
    df["kwh_quality_issue_flag"] = (
        (df["kwh_missing_flag"] == 1)
        | (df["kwh_imputed_flag"] == 1)
        | (df["kwh_negative_delta_flag"] == 1)
    ).astype("int8")
    df["data_quality_issue_flag"] = ((df["time_quality_issue_flag"] == 1) | (df["kwh_quality_issue_flag"] == 1)).astype("int8")
    df["data_quality_issue_count"] = df[
        ["time_quality_issue_flag", "kwh_quality_issue_flag", "energy_counter_suspect_flag", "loaded_energy_unavailable_flag"]
    ].sum(axis=1).astype("int16")
    df["data_quality_reason"] = _quality_reason(df)
    df["fault_evidence_count"] = (df["known_fault_status"] + df["known_repair_status"] + df["off_with_fault_status"]).astype("int16")
    df["maintenance_evidence_count"] = (df["known_maintenance_status"] + df["known_repair_status"]).astype("int16")


def _quality_reason(df: pd.DataFrame) -> pd.Series:
    reasons = pd.Series("OK", index=df.index, dtype=object)
    parts: Mapping[str, pd.Series] = {
        "TIME_QUALITY": df["time_quality_issue_flag"] == 1,
        "KWH_QUALITY": df["kwh_quality_issue_flag"] == 1,
        "ENERGY_INCONSISTENCY": df["energy_inconsistency_flag"] == 1,
    }
    for label, mask in parts.items():
        reasons.loc[mask & (reasons == "OK")] = label
        reasons.loc[mask & (reasons != "OK") & ~reasons.str.contains(label)] = reasons.loc[
            mask & (reasons != "OK") & ~reasons.str.contains(label)
        ] + f"|{label}"
    return reasons


def _add_context_features(df: pd.DataFrame, location_map: pd.DataFrame | None) -> None:
    df["machine_group_id"] = -1
    df["location_id"] = -1
    if location_map is not None and not location_map.empty:
        if "machine_group_id" in location_map.columns:
            groups = location_map[["machine_id", "machine_group_id"]].dropna(subset=["machine_id"]).drop_duplicates("machine_id").copy()
            groups["machine_id"] = pd.to_numeric(groups["machine_id"], errors="coerce").astype(int)
            df_grouped = df.merge(groups, on="machine_id", how="left", suffixes=("", "_lookup"))
            df["machine_group_id"] = df_grouped["machine_group_id_lookup"].fillna(-1).astype(int).values

        if "event_id" in location_map.columns:
            loc = location_map[["event_id", "location_id"]].drop_duplicates("event_id").copy()
            loc["event_id"] = pd.to_numeric(loc["event_id"], errors="coerce").astype("Int64")
            df_merged = df.merge(loc, on="event_id", how="left", suffixes=("", "_lookup"))
        else:
            loc = location_map[["machine_id", "location_id"]].drop_duplicates("machine_id").copy()
            df["machine_id"] = df["machine_id"].astype(int)
            loc["machine_id"] = pd.to_numeric(loc["machine_id"], errors="coerce").astype(int)
            df_merged = df.merge(loc, on="machine_id", how="left", suffixes=("", "_lookup"))
        df["location_id"] = df_merged["location_id_lookup"].fillna(-1).astype(int).values

    df["hour_of_day"] = df["event_start_time"].dt.hour.fillna(0).astype("int16")
    # SQL Server DATEPART(WEEKDAY) with default DATEFIRST=7: Sunday=1, Monday=2.
    df["day_of_week"] = (((df["event_start_time"].dt.dayofweek + 1) % 7) + 1).fillna(0).astype("int16")


def _add_sequence_features(df: pd.DataFrame) -> None:
    first_in_machine = df.groupby("machine_id").cumcount() == 0
    boundary = (
        first_in_machine
        | (df["is_big_gap"] == 1)
        | (df["is_non_positive_duration"] == 1)
        | df["event_end_time"].isna()
    )
    df["sequence_segment_id"] = boundary.astype("int64").groupby(df["machine_id"]).cumsum().astype("int64")
    df["event_order_in_segment"] = df.groupby(["machine_id", "sequence_segment_id"]).cumcount() + 1
    df["is_first_event_in_segment"] = (df["event_order_in_segment"] == 1).astype("int8")


def _next_greater_distinct_start(df: pd.DataFrame) -> pd.Series:
    out = pd.Series(pd.NaT, index=df.index, dtype="datetime64[ns]")
    for _, idx in df.groupby("machine_id", sort=False).groups.items():
        machine = df.loc[idx, ["event_start_time"]].copy()
        unique_times = pd.Series(machine["event_start_time"].dropna().sort_values().unique())
        if len(unique_times) < 2:
            continue
        next_by_time = dict(zip(unique_times.iloc[:-1], unique_times.iloc[1:]))
        out.loc[idx] = pd.to_datetime(df.loc[idx, "event_start_time"].map(next_by_time), errors="coerce")
    return out


def _datediff_seconds(start: pd.Series, end: pd.Series) -> pd.Series:
    start_s = pd.to_datetime(start, errors="coerce").dt.floor("s")
    end_s = pd.to_datetime(end, errors="coerce").dt.floor("s")
    return (end_s - start_s).dt.total_seconds()


def _next_greater_distinct_value(df: pd.DataFrame, value_col: str) -> pd.Series:
    out = pd.Series(np.nan, index=df.index, dtype="float64")
    for _, idx in df.groupby("machine_id", sort=False).groups.items():
        machine = df.loc[idx, ["event_start_time", "event_id", value_col]].copy()
        first_by_time = (
            machine.dropna(subset=["event_start_time"])
            .sort_values(["event_start_time", "event_id"])
            .drop_duplicates("event_start_time", keep="first")
        )
        if first_by_time.empty:
            continue
        value_by_time = dict(zip(first_by_time["event_start_time"], first_by_time[value_col]))
        unique_times = pd.Series(first_by_time["event_start_time"].sort_values().unique())
        next_time_by_time = dict(zip(unique_times.iloc[:-1], unique_times.iloc[1:]))
        if len(unique_times) < 2:
            continue
        next_time = df.loc[idx, "event_start_time"].map(next_time_by_time)
        out.loc[idx] = next_time.map(value_by_time)
    return out
