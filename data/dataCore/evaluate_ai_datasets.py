from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pandas as pd

DEFAULT_L1 = r"C:\Users\huynd1\Downloads\OBAD\data\dataCore\ai_l1_operation_event_sequence.csv"
DEFAULT_L2 = r"C:\Users\huynd1\Downloads\OBAD\data\dataCore\ai_l2_fault_confidence_event.csv"
#python evaluate_ai_datasets.py --l1 "C:\Users\huynd1\Downloads\OBAD\data\dataCore\ai_l1_operation_event_sequence.csv" --l2 "C:\Users\huynd1\Downloads\OBAD\data\dataCore\ai_l2_fault_confidence_event.csv" --out "C:\Users\huynd1\Downloads\OBAD\data\dataCore\dataset_eval_report" --sep ";"

def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def safe_read_header(path: Path, sep: str) -> List[str]:
    if not path.exists():
        return []
    return list(pd.read_csv(path, sep=sep, nrows=0, encoding="utf-").columns)


def existing(columns: Iterable[str], available: Iterable[str]) -> List[str]:
    s = set(available)
    return [c for c in columns if c in s]


def to_numeric_series(s: pd.Series) -> pd.Series:
    if pd.api.types.is_numeric_dtype(s):
        return s
    return pd.to_numeric(
        s.astype(str)
         .str.strip()
         .str.replace("\u00a0", "", regex=False)
         .str.replace(",", ".", regex=False)
         .replace({"": None, "NULL": None, "None": None, "nan": None}),
        errors="coerce",
    )


def normalize_numeric(df: pd.DataFrame, cols: Iterable[str]) -> None:
    for c in cols:
        if c in df.columns:
            df[c] = to_numeric_series(df[c])


def to_datetime_series(s: pd.Series) -> pd.Series:
    return pd.to_datetime(s, errors="coerce")


def ratio(n: float, d: float) -> float:
    if d is None or d == 0 or pd.isna(d):
        return 0.0
    return float(n) / float(d)


def pct(n: float, d: float) -> float:
    return round(100.0 * ratio(n, d), 4)


def write_csv(df: pd.DataFrame, path: Path) -> None:
    df.to_csv(path, index=False, encoding="utf-8-sig")


def save_json(obj: Any, path: Path) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def md_table(df: pd.DataFrame, max_rows: int = 20) -> str:
    if df is None or df.empty:
        return "_Không có dữ liệu._"
    show = df.head(max_rows).copy()
    for c in show.columns:
        if pd.api.types.is_float_dtype(show[c]):
            show[c] = show[c].map(lambda x: "" if pd.isna(x) else f"{x:,.4f}")
    headers = list(show.columns)
    rows = show.astype(str).values.tolist()
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
    for r in rows:
        lines.append("| " + " | ".join(r) + " |")
    if len(df) > max_rows:
        lines.append(f"\n_Ghi chú: chỉ hiển thị {max_rows}/{len(df)} dòng._")
    return "\n".join(lines)


def chunk_reader(path: Path, sep: str, chunksize: int, usecols: Optional[List[str]] = None):
    return pd.read_csv(
        path,
        sep=sep,
        chunksize=chunksize,
        encoding="utf-8-sig",
        low_memory=False,
        usecols=usecols,
    )


def profile_generic_csv(path: Path, sep: str, chunksize: int, dataset_name: str, out_dir: Path) -> Dict[str, Any]:
    cols = safe_read_header(path, sep)
    if not cols:
        return {"dataset": dataset_name, "path": str(path), "exists": False}
    total_rows = 0
    null_counts = Counter()
    non_null_counts = Counter()
    sample_dtypes = {}
    first_values = {}
    for i, chunk in enumerate(chunk_reader(path, sep, chunksize)):
        total_rows += len(chunk)
        null_counts.update(chunk.isna().sum().to_dict())
        non_null_counts.update(chunk.notna().sum().to_dict())
        if i == 0:
            sample_dtypes = {c: str(t) for c, t in chunk.dtypes.items()}
            for c in cols:
                vals = chunk[c].dropna()
                first_values[c] = None if vals.empty else str(vals.iloc[0])
    col_profile = pd.DataFrame({
        "column": cols,
        "dtype_sample": [sample_dtypes.get(c) for c in cols],
        "null_count": [null_counts.get(c, 0) for c in cols],
        "non_null_count": [non_null_counts.get(c, 0) for c in cols],
        "null_pct": [pct(null_counts.get(c, 0), total_rows) for c in cols],
        "first_non_null_sample": [first_values.get(c) for c in cols],
    })
    write_csv(col_profile, out_dir / f"{dataset_name}_column_profile.csv")
    return {"dataset": dataset_name, "path": str(path), "exists": True, "total_rows": total_rows, "total_columns": len(cols), "columns": cols}


def event_id_check(l1_path: Path, l2_path: Path, sep: str, chunksize: int, out_dir: Path, do_set_check: bool) -> Dict[str, Any]:
    result = {"set_check_enabled": do_set_check}
    if not do_set_check:
        return result
    def read_ids(path: Path) -> Tuple[set, int]:
        seen = set()
        dup = 0
        if "event_id" not in safe_read_header(path, sep):
            return seen, -1
        for chunk in chunk_reader(path, sep, chunksize, usecols=["event_id"]):
            ids = pd.to_numeric(chunk["event_id"], errors="coerce").dropna().astype("int64")
            for v in ids:
                iv = int(v)
                if iv in seen:
                    dup += 1
                else:
                    seen.add(iv)
        return seen, dup
    l1_ids, l1_dup = read_ids(l1_path)
    l2_ids, l2_dup = read_ids(l2_path)
    result.update({
        "l1_unique_event_id_count": len(l1_ids),
        "l2_unique_event_id_count": len(l2_ids),
        "l1_duplicate_event_id_count": l1_dup,
        "l2_duplicate_event_id_count": l2_dup,
        "l2_not_in_l1_count": len(l2_ids - l1_ids),
        "l1_not_in_l2_count": len(l1_ids - l2_ids),
    })
    pd.DataFrame({"metric": list(result.keys()), "value": list(result.values())}).to_csv(out_dir / "event_id_consistency.csv", index=False, encoding="utf-8-sig")
    return result


L1_NUMERIC_COLS = [
    "event_id", "machine_id", "sequence_segment_id", "event_order_in_segment", "duration_sec", "gap_from_prev_sec", "overlap_sec",
    "status_id", "status_type_code", "is_on", "current_signal_code", "is_loaded", "is_no_load", "is_current_near_zero", "has_error_token", "has_maintenance_token",
    "raw_status_kwh_start", "raw_status_kwh_end", "kwh_start_value", "kwh_end_value", "kwh_raw_available_flag", "kwh_available_flag", "kwh_missing_flag", "kwh_imputed_or_missing_flag", "kwh_start_imputed_flag", "kwh_end_imputed_flag", "kwh_delta", "kwh_delta_model_value", "kwh_zero_delta_flag", "kwh_positive_delta_flag", "kwh_negative_delta_flag", "kwh_rate_per_hour", "kwh_rate_missing_flag", "loaded_positive_kwh_flag", "loaded_zero_kwh_flag", "loaded_without_kwh_flag",
    "is_raw_end_missing", "is_invalid_raw_end", "is_open_event", "end_time_imputed_flag", "is_non_positive_duration", "is_long_duration", "is_gap", "is_big_gap", "is_overlap", "machine_group_id", "location_id", "hour_of_day", "day_of_week",
]
L1_FLAG_COLS = [
    "is_loaded", "is_no_load", "is_current_near_zero", "has_error_token", "has_maintenance_token", "kwh_raw_available_flag", "kwh_available_flag", "kwh_missing_flag", "kwh_imputed_or_missing_flag", "kwh_start_imputed_flag", "kwh_end_imputed_flag", "kwh_zero_delta_flag", "kwh_positive_delta_flag", "kwh_negative_delta_flag", "kwh_rate_missing_flag", "loaded_positive_kwh_flag", "loaded_zero_kwh_flag", "loaded_without_kwh_flag", "is_raw_end_missing", "is_invalid_raw_end", "is_open_event", "end_time_imputed_flag", "is_non_positive_duration", "is_long_duration", "is_gap", "is_big_gap", "is_overlap",
]
NUM_SAMPLE_COLS = ["duration_sec", "gap_from_prev_sec", "overlap_sec", "kwh_delta", "kwh_delta_model_value", "kwh_rate_per_hour"]


def update_num_acc(acc: Dict[str, Any], s: pd.Series) -> None:
    acc["null"] += int(s.isna().sum())
    nn = s.dropna()
    acc["count"] += int(nn.count())
    if not nn.empty:
        acc["sum"] += float(nn.sum())
        acc["min"] = float(nn.min()) if acc.get("min") is None else min(acc["min"], float(nn.min()))
        acc["max"] = float(nn.max()) if acc.get("max") is None else max(acc["max"], float(nn.max()))


def analyze_l1(path: Path, sep: str, chunksize: int, out_dir: Path) -> Dict[str, Any]:
    cols = safe_read_header(path, sep)
    if not cols:
        return {"exists": False}
    usecols = existing([
        "event_id", "machine_id", "sequence_segment_id", "event_order_in_segment", "event_start_time", "event_end_time", "end_time_source", "duration_sec", "gap_from_prev_sec", "overlap_sec", "status_id", "status_type_code", "is_on", "current_signal_code", "is_loaded", "is_no_load", "is_current_near_zero", "has_error_token", "has_maintenance_token", "raw_status_kwh_start", "raw_status_kwh_end", "kwh_start_value", "kwh_end_value", "kwh_start_source", "kwh_end_source", "kwh_raw_available_flag", "kwh_available_flag", "kwh_missing_flag", "kwh_imputed_or_missing_flag", "kwh_start_imputed_flag", "kwh_end_imputed_flag", "kwh_delta", "kwh_delta_model_value", "kwh_zero_delta_flag", "kwh_positive_delta_flag", "kwh_negative_delta_flag", "kwh_rate_per_hour", "kwh_rate_missing_flag", "loaded_positive_kwh_flag", "loaded_zero_kwh_flag", "loaded_without_kwh_flag", "is_raw_end_missing", "is_invalid_raw_end", "is_open_event", "end_time_imputed_flag", "is_non_positive_duration", "is_long_duration", "is_gap", "is_big_gap", "is_overlap", "machine_group_id", "location_id", "hour_of_day", "day_of_week"
    ], cols)
    total_rows = 0
    machine_agg = defaultdict(Counter)
    segment_max_by_machine = defaultdict(int)
    status_counter = Counter()
    status_by_machine = Counter()
    counters = {"end_time_source": Counter(), "kwh_start_source": Counter(), "kwh_end_source": Counter(), "current_signal_code": Counter(), "status_type_code": Counter()}
    numeric_global = {c: {"count": 0, "null": 0, "sum": 0.0, "min": None, "max": None} for c in existing(NUM_SAMPLE_COLS, cols)}
    per_machine_num = defaultdict(lambda: defaultdict(lambda: {"count": 0, "null": 0, "sum": 0.0, "min": None, "max": None}))
    for chunk in chunk_reader(path, sep, chunksize, usecols=usecols):
        total_rows += len(chunk)
        normalize_numeric(chunk, existing(L1_NUMERIC_COLS, chunk.columns))
        if "event_start_time" in chunk.columns:
            chunk["event_start_time"] = to_datetime_series(chunk["event_start_time"])
        if "machine_id" in chunk.columns:
            for mid, cnt in chunk.groupby("machine_id", dropna=False).size().items():
                machine_agg[mid]["row_count"] += int(cnt)
            if "event_start_time" in chunk.columns:
                g = chunk.groupby("machine_id")["event_start_time"].agg(["min", "max"])
                for mid, row in g.iterrows():
                    if pd.notna(row["min"]):
                        old = machine_agg[mid].get("first_event_time")
                        machine_agg[mid]["first_event_time"] = row["min"] if old in [None, 0] else min(old, row["min"])
                    if pd.notna(row["max"]):
                        old = machine_agg[mid].get("last_event_time")
                        machine_agg[mid]["last_event_time"] = row["max"] if old in [None, 0] else max(old, row["max"])
            if "sequence_segment_id" in chunk.columns:
                for mid, mx in chunk.groupby("machine_id")["sequence_segment_id"].max().items():
                    if pd.notna(mx):
                        segment_max_by_machine[mid] = max(segment_max_by_machine[mid], int(mx))
            for flag in existing(L1_FLAG_COLS, chunk.columns):
                for mid, val in chunk.groupby("machine_id")[flag].sum(min_count=1).items():
                    if pd.notna(val):
                        machine_agg[mid][flag + "_sum"] += float(val)
            for num_col in existing(NUM_SAMPLE_COLS, chunk.columns):
                g = chunk.groupby("machine_id")[num_col].agg(["count", "sum", "min", "max"])
                null_g = chunk.groupby("machine_id")[num_col].apply(lambda s: s.isna().sum())
                for mid, row in g.iterrows():
                    acc = per_machine_num[mid][num_col]
                    acc["count"] += int(row["count"])
                    acc["sum"] += float(row["sum"]) if pd.notna(row["sum"]) else 0.0
                    acc["null"] += int(null_g.loc[mid]) if mid in null_g.index else 0
                    if int(row["count"]) > 0:
                        acc["min"] = row["min"] if acc["min"] is None else min(acc["min"], row["min"])
                        acc["max"] = row["max"] if acc["max"] is None else max(acc["max"], row["max"])
        if "status_id" in chunk.columns:
            status_counter.update(chunk["status_id"].dropna().astype(str).value_counts().to_dict())
            if "machine_id" in chunk.columns:
                for idx, cnt in chunk.groupby(["machine_id", "status_id"]).size().items():
                    status_by_machine[(idx[0], idx[1])] += int(cnt)
        for c_name in counters:
            if c_name in chunk.columns:
                counters[c_name].update(chunk[c_name].fillna("NULL").astype(str).value_counts().to_dict())
        for c, acc in numeric_global.items():
            if c in chunk.columns:
                update_num_acc(acc, chunk[c])
    machine_rows = []
    for mid, c in sorted(machine_agg.items(), key=lambda x: x[0]):
        row = {"machine_id": mid, "row_count": int(c.get("row_count", 0)), "first_event_time": c.get("first_event_time"), "last_event_time": c.get("last_event_time"), "segment_count_est": segment_max_by_machine.get(mid)}
        for flag in existing(L1_FLAG_COLS, cols):
            v = float(c.get(flag + "_sum", 0))
            row[flag + "_count"] = int(v)
            row[flag + "_pct"] = pct(v, row["row_count"])
        for num_col, acc in per_machine_num.get(mid, {}).items():
            row[num_col + "_count"] = acc["count"]
            row[num_col + "_null"] = acc["null"]
            row[num_col + "_mean"] = round(acc["sum"] / acc["count"], 6) if acc["count"] else None
            row[num_col + "_min"] = acc["min"]
            row[num_col + "_max"] = acc["max"]
        machine_rows.append(row)
    machine_summary = pd.DataFrame(machine_rows)
    write_csv(machine_summary, out_dir / "l1_machine_summary.csv")
    write_csv(pd.DataFrame([{"status_id": k, "row_count": v, "pct": pct(v, total_rows)} for k, v in status_counter.most_common()]), out_dir / "l1_status_distribution.csv")
    write_csv(pd.DataFrame([{"machine_id": k[0], "status_id": k[1], "row_count": v} for k, v in status_by_machine.items()]).sort_values(["machine_id", "status_id"]) if status_by_machine else pd.DataFrame(), out_dir / "l1_status_by_machine.csv")
    for name, counter in counters.items():
        write_csv(pd.DataFrame([{"value": k, "row_count": v, "pct": pct(v, total_rows)} for k, v in counter.most_common()]), out_dir / f"l1_{name}_distribution.csv")
    num_rows = []
    for c, acc in numeric_global.items():
        num_rows.append({"column": c, "count": acc["count"], "null": acc["null"], "mean": round(acc["sum"] / acc["count"], 6) if acc["count"] else None, "min": acc["min"], "max": acc["max"]})
    write_csv(pd.DataFrame(num_rows), out_dir / "l1_numeric_stats.csv")
    return {"exists": True, "total_rows": total_rows, "machine_count": len(machine_summary)}


L2_NUMERIC_COLS = [
    "event_id", "machine_id", "sequence_segment_id", "event_order_in_segment", "duration_sec", "duration_sec_model_value", "gap_from_prev_sec", "gap_from_prev_sec_model_value", "overlap_sec", "status_id", "status_type_code", "current_signal_code", "known_fault_status", "known_maintenance_status", "known_repair_status", "off_with_fault_status", "info_status", "normal_loaded_production_status", "normal_no_load_production_status", "power_on_near_zero_status", "normal_power_off_status", "kwh_available_flag", "kwh_missing_flag", "kwh_imputed_flag", "kwh_imputed_or_missing_flag", "kwh_delta", "kwh_delta_model_value", "kwh_zero_delta_flag", "kwh_positive_delta_flag", "kwh_negative_delta_flag", "kwh_rate_per_hour", "kwh_rate_per_hour_model_value", "loaded_positive_kwh_flag", "loaded_zero_kwh_flag", "loaded_without_kwh_flag", "energy_inconsistency_flag", "loaded_energy_unavailable_flag", "loaded_energy_positive_evidence", "energy_counter_suspect_flag", "time_quality_issue_flag", "time_imputed_or_repaired_flag", "kwh_quality_issue_flag", "data_quality_issue_flag", "data_quality_issue_count", "fault_evidence_count", "maintenance_evidence_count", "machine_group_id", "location_id", "hour_of_day", "day_of_week"
]
L2_FLAG_COLS = [
    "known_fault_status", "known_maintenance_status", "known_repair_status", "off_with_fault_status", "info_status", "normal_loaded_production_status", "normal_no_load_production_status", "power_on_near_zero_status", "normal_power_off_status", "kwh_available_flag", "kwh_missing_flag", "kwh_imputed_flag", "kwh_imputed_or_missing_flag", "kwh_zero_delta_flag", "kwh_positive_delta_flag", "kwh_negative_delta_flag", "loaded_positive_kwh_flag", "loaded_zero_kwh_flag", "loaded_without_kwh_flag", "energy_inconsistency_flag", "loaded_energy_unavailable_flag", "loaded_energy_positive_evidence", "energy_counter_suspect_flag", "time_quality_issue_flag", "time_imputed_or_repaired_flag", "kwh_quality_issue_flag", "data_quality_issue_flag"
]


def analyze_l2(path: Path, sep: str, chunksize: int, out_dir: Path) -> Dict[str, Any]:
    cols = safe_read_header(path, sep)
    if not cols:
        return {"exists": False}
    usecols = existing([
        "event_id", "machine_id", "sequence_segment_id", "event_order_in_segment", "event_start_time", "event_end_time", "end_time_source", "duration_sec", "duration_sec_model_value", "gap_from_prev_sec", "gap_from_prev_sec_model_value", "overlap_sec", "status_id", "status_type_code", "current_signal_code", "is_loaded", "is_no_load", "is_current_near_zero", "known_fault_status", "known_maintenance_status", "known_repair_status", "off_with_fault_status", "info_status", "normal_loaded_production_status", "normal_no_load_production_status", "power_on_near_zero_status", "normal_power_off_status", "status_evidence_class", "kwh_available_flag", "kwh_missing_flag", "kwh_imputed_flag", "kwh_imputed_or_missing_flag", "kwh_delta", "kwh_delta_model_value", "kwh_zero_delta_flag", "kwh_positive_delta_flag", "kwh_negative_delta_flag", "kwh_rate_per_hour", "kwh_rate_per_hour_model_value", "loaded_positive_kwh_flag", "loaded_zero_kwh_flag", "loaded_without_kwh_flag", "energy_inconsistency_flag", "loaded_energy_unavailable_flag", "loaded_energy_positive_evidence", "energy_counter_suspect_flag", "time_quality_issue_flag", "time_imputed_or_repaired_flag", "kwh_quality_issue_flag", "data_quality_issue_flag", "data_quality_issue_count", "data_quality_reason", "fault_evidence_count", "maintenance_evidence_count", "machine_group_id", "location_id", "hour_of_day", "day_of_week"
    ], cols)
    total_rows = 0
    machine_agg = defaultdict(Counter)
    evidence_class_counter = Counter()
    data_quality_reason_counter = Counter()
    flag_combo_counter = Counter()
    for chunk in chunk_reader(path, sep, chunksize, usecols=usecols):
        total_rows += len(chunk)
        normalize_numeric(chunk, existing(L2_NUMERIC_COLS, chunk.columns))
        if "event_start_time" in chunk.columns:
            chunk["event_start_time"] = to_datetime_series(chunk["event_start_time"])
        if "machine_id" in chunk.columns:
            for mid, cnt in chunk.groupby("machine_id", dropna=False).size().items():
                machine_agg[mid]["row_count"] += int(cnt)
            if "event_start_time" in chunk.columns:
                g = chunk.groupby("machine_id")["event_start_time"].agg(["min", "max"])
                for mid, row in g.iterrows():
                    if pd.notna(row["min"]):
                        old = machine_agg[mid].get("first_event_time")
                        machine_agg[mid]["first_event_time"] = row["min"] if old in [None, 0] else min(old, row["min"])
                    if pd.notna(row["max"]):
                        old = machine_agg[mid].get("last_event_time")
                        machine_agg[mid]["last_event_time"] = row["max"] if old in [None, 0] else max(old, row["max"])
            for flag in existing(L2_FLAG_COLS, chunk.columns):
                for mid, val in chunk.groupby("machine_id")[flag].sum(min_count=1).items():
                    if pd.notna(val):
                        machine_agg[mid][flag + "_sum"] += float(val)
            for metric in existing(["data_quality_issue_count", "fault_evidence_count", "maintenance_evidence_count"], chunk.columns):
                g = chunk.groupby("machine_id")[metric].agg(["sum", "count", "max"])
                for mid, row in g.iterrows():
                    machine_agg[mid][metric + "_sum"] += float(row["sum"]) if pd.notna(row["sum"]) else 0.0
                    machine_agg[mid][metric + "_count"] += int(row["count"])
                    machine_agg[mid][metric + "_max"] = max(machine_agg[mid].get(metric + "_max", 0), float(row["max"]) if pd.notna(row["max"]) else 0.0)
        if "status_evidence_class" in chunk.columns:
            evidence_class_counter.update(chunk["status_evidence_class"].fillna("NULL").astype(str).value_counts().to_dict())
        if "data_quality_reason" in chunk.columns:
            data_quality_reason_counter.update(chunk["data_quality_reason"].fillna("NULL").astype(str).value_counts().to_dict())
        combo_cols = existing(["known_fault_status", "known_maintenance_status", "known_repair_status", "data_quality_issue_flag"], chunk.columns)
        if combo_cols:
            for idx, cnt in chunk.groupby(combo_cols).size().items():
                if not isinstance(idx, tuple):
                    idx = (idx,)
                flag_combo_counter[idx] += int(cnt)
    machine_rows = []
    for mid, c in sorted(machine_agg.items(), key=lambda x: x[0]):
        row = {"machine_id": mid, "row_count": int(c.get("row_count", 0)), "first_event_time": c.get("first_event_time"), "last_event_time": c.get("last_event_time")}
        for flag in existing(L2_FLAG_COLS, cols):
            v = float(c.get(flag + "_sum", 0))
            row[flag + "_count"] = int(v)
            row[flag + "_pct"] = pct(v, row["row_count"])
        for metric in existing(["data_quality_issue_count", "fault_evidence_count", "maintenance_evidence_count"], cols):
            cnt = c.get(metric + "_count", 0)
            row[metric + "_mean"] = round(c.get(metric + "_sum", 0.0) / cnt, 6) if cnt else None
            row[metric + "_max"] = c.get(metric + "_max", None)
        machine_rows.append(row)
    write_csv(pd.DataFrame(machine_rows), out_dir / "l2_machine_summary.csv")
    write_csv(pd.DataFrame([{"status_evidence_class": k, "row_count": v, "pct": pct(v, total_rows)} for k, v in evidence_class_counter.most_common()]), out_dir / "l2_status_evidence_class_distribution.csv")
    write_csv(pd.DataFrame([{"data_quality_reason": k, "row_count": v, "pct": pct(v, total_rows)} for k, v in data_quality_reason_counter.most_common()]), out_dir / "l2_data_quality_reason_distribution.csv")
    combo_rows = []
    combo_names = ["known_fault_status", "known_maintenance_status", "known_repair_status", "data_quality_issue_flag"]
    for key, cnt in flag_combo_counter.items():
        row = {combo_names[i]: key[i] for i in range(min(len(key), len(combo_names)))}
        row["row_count"] = cnt
        row["pct"] = pct(cnt, total_rows)
        combo_rows.append(row)
    write_csv(pd.DataFrame(combo_rows).sort_values("row_count", ascending=False) if combo_rows else pd.DataFrame(), out_dir / "l2_fault_label_combo_distribution.csv")
    return {"exists": True, "total_rows": total_rows, "machine_count": len(machine_agg)}


def load_csv_if_exists(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    if path.stat().st_size <= 5:
        return pd.DataFrame()
    try:
        return pd.read_csv(path, encoding="utf-8-sig")
    except pd.errors.EmptyDataError:
        return pd.DataFrame()


def build_markdown_report(out_dir: Path, generic: Dict[str, Any], l1: Dict[str, Any], l2: Dict[str, Any], consistency: Dict[str, Any]) -> None:
    l1_machine = load_csv_if_exists(out_dir / "l1_machine_summary.csv")
    l2_machine = load_csv_if_exists(out_dir / "l2_machine_summary.csv")
    l1_status = load_csv_if_exists(out_dir / "l1_status_distribution.csv")
    l2_evidence = load_csv_if_exists(out_dir / "l2_status_evidence_class_distribution.csv")
    l2_dq = load_csv_if_exists(out_dir / "l2_data_quality_reason_distribution.csv")
    l1_end_src = load_csv_if_exists(out_dir / "l1_end_time_source_distribution.csv")
    l1_kwh_start_src = load_csv_if_exists(out_dir / "l1_kwh_start_source_distribution.csv")
    l1_kwh_end_src = load_csv_if_exists(out_dir / "l1_kwh_end_source_distribution.csv")
    l1_numeric = load_csv_if_exists(out_dir / "l1_numeric_stats.csv")
    lines = []
    lines.append("# Báo cáo đánh giá dataset AI vận hành Weldcom")
    lines.append("## 1. Mục tiêu đánh giá")
    lines.append("Báo cáo này đánh giá hai dataset L1 và L2 sau khi sinh từ SQL để chuẩn bị chọn chiến thuật train mô hình AI. Mục tiêu là kiểm tra đủ dòng, đủ cột, chất lượng thời gian, chất lượng KWh, phân bố status, phân bố bằng chứng lỗi/bảo trì và liên kết 1-1 qua event_id.")
    lines.append("## 2. Quan điểm bài toán")
    lines.append("Đối tượng chính là máy theo machine_id. Mỗi dòng là một event/khoảng trạng thái của máy. status_id vừa là token chuỗi vận hành cho L1, vừa là weak label/bằng chứng cho L2. Các status 6,7,9,10 là bằng chứng lỗi rõ, nhưng không nên biến toàn bộ hệ thống thành bài toán nhãn đơn giản vì dữ liệu có gap, KWh thiếu, thời gian sửa, bảo trì và trạng thái vận hành có nhiễu.")
    gen_rows = []
    for name in ["l1", "l2"]:
        info = generic.get(name, {})
        if info.get("exists"):
            gen_rows.append({"dataset": name, "rows": info.get("total_rows"), "columns": info.get("total_columns"), "path": info.get("path")})
    lines.append("## 3. Tổng quan dòng/cột")
    lines.append(md_table(pd.DataFrame(gen_rows)))
    lines.append("## 4. Kiểm tra liên kết L1-L2")
    lines.append(md_table(pd.DataFrame([consistency])))
    lines.append("## 5. Phân bố status_id L1")
    lines.append(md_table(l1_status, 20))
    lines.append("## 6. Nguồn xử lý thời gian L1")
    lines.append(md_table(l1_end_src, 20))
    lines.append("## 7. Nguồn KWh sau xử lý")
    lines.append("### KWh start source")
    lines.append(md_table(l1_kwh_start_src, 20))
    lines.append("### KWh end source")
    lines.append(md_table(l1_kwh_end_src, 20))
    lines.append("## 8. Numeric stats L1")
    lines.append(md_table(l1_numeric, 30))
    lines.append("## 9. Tổng quan theo máy L1")
    cols_l1_show = [c for c in ["machine_id", "row_count", "segment_count_est", "first_event_time", "last_event_time", "kwh_available_flag_pct", "kwh_missing_flag_pct", "kwh_imputed_or_missing_flag_pct", "loaded_zero_kwh_flag_pct", "loaded_without_kwh_flag_pct", "is_gap_pct", "is_big_gap_pct", "is_overlap_pct", "duration_sec_mean", "gap_from_prev_sec_mean"] if c in l1_machine.columns]
    lines.append(md_table(l1_machine[cols_l1_show] if cols_l1_show else l1_machine, 30))
    lines.append("## 10. Phân bố bằng chứng L2")
    lines.append(md_table(l2_evidence, 30))
    lines.append("## 11. Chất lượng dữ liệu L2")
    lines.append(md_table(l2_dq, 30))
    lines.append("## 12. Tổng quan theo máy L2")
    cols_l2_show = [c for c in ["machine_id", "row_count", "known_fault_status_pct", "known_maintenance_status_pct", "known_repair_status_pct", "off_with_fault_status_pct", "data_quality_issue_flag_pct", "time_quality_issue_flag_pct", "kwh_quality_issue_flag_pct", "energy_inconsistency_flag_pct", "loaded_energy_unavailable_flag_pct", "fault_evidence_count_mean", "maintenance_evidence_count_mean", "data_quality_issue_count_mean"] if c in l2_machine.columns]
    lines.append(md_table(l2_machine[cols_l2_show] if cols_l2_show else l2_machine, 30))
    lines.append("## 13. Đánh giá chiến thuật mô hình")
    lines.append("L1 nên là Behavior Anomaly Detection theo chuỗi event của từng máy, dùng sliding window theo machine_id + sequence_segment_id + event_order_in_segment. L2 nên là Fault Confidence/Fault Judgment, sử dụng output L1 cộng với bằng chứng status, KWh và data quality. Nếu phân bố nhãn lỗi đủ nhiều, L2 có thể mở rộng thành multi-label/multi-class: normal, fault, repair, maintenance-related, data-quality-issue.")
    lines.append("## 14. File CSV chi tiết đã xuất")
    for p in sorted(out_dir.glob("*.csv")):
        lines.append(f"- `{p.name}`")
    (out_dir / "REPORT.md").write_text("\n\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Đánh giá 2 dataset AI vận hành Weldcom L1/L2.")
    parser.add_argument("--l1", default=DEFAULT_L1)
    parser.add_argument("--l2", default=DEFAULT_L2)
    parser.add_argument("--out", default="dataset_eval_report")
    parser.add_argument("--sep", default=",")
    parser.add_argument("--chunksize", type=int, default=200_000)
    parser.add_argument("--skip-id-set-check", action="store_true")
    args = parser.parse_args()
    l1_path = Path(args.l1)
    l2_path = Path(args.l2)
    out_dir = Path(args.out)
    ensure_dir(out_dir)
    print("=== AI dataset evaluator ===")
    print(f"L1: {l1_path}")
    print(f"L2: {l2_path}")
    print(f"OUT: {out_dir.resolve()}")
    if not l1_path.exists():
        print(f"[ERROR] Không tìm thấy file L1: {l1_path}", file=sys.stderr)
        return 2
    if not l2_path.exists():
        print(f"[ERROR] Không tìm thấy file L2: {l2_path}", file=sys.stderr)
        return 2
    generic = {}
    print("[1/5] Profile L1...")
    generic["l1"] = profile_generic_csv(l1_path, args.sep, args.chunksize, "l1", out_dir)
    print("[2/5] Profile L2...")
    generic["l2"] = profile_generic_csv(l2_path, args.sep, args.chunksize, "l2", out_dir)
    print("[3/5] Phân tích L1...")
    l1_info = analyze_l1(l1_path, args.sep, args.chunksize, out_dir)
    print("[4/5] Phân tích L2...")
    l2_info = analyze_l2(l2_path, args.sep, args.chunksize, out_dir)
    print("[5/5] Kiểm tra event_id...")
    consistency = event_id_check(l1_path, l2_path, args.sep, args.chunksize, out_dir, do_set_check=not args.skip_id_set_check)
    summary = {"generic": generic, "l1": l1_info, "l2": l2_info, "event_id_consistency": consistency}
    save_json(summary, out_dir / "summary.json")
    build_markdown_report(out_dir, generic, l1_info, l2_info, consistency)
    print("\nHoàn tất.")
    print(f"Báo cáo chính: {out_dir / 'REPORT.md'}")
    print(f"Tóm tắt JSON: {out_dir / 'summary.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
