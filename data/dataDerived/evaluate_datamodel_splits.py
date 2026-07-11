# -*- coding: utf-8 -*-
"""
evaluate_datamodel_splits.py

Đánh giá toàn diện các file dataModel sau khi split train/valid/test cho bài toán AI vận hành Weldcom.

Mục tiêu:
1) Kiểm tra các file train/valid/test đã được export đúng chưa.
2) Đánh giá L1 normal_strict và normal_lenient để quyết định bộ nào phù hợp train Normal Behavior Deviation Detection.
3) Đánh giá L2 train/valid/test, đặc biệt các nhãn future fault để quyết định chiến thuật Fault Confidence / Deviation Validation.
4) Xuất báo cáo Markdown + CSV summary để làm cơ sở chọn kiến trúc ML/DL.

Cách chạy mẫu:
python evaluate_datamodel_splits.py ^
  --base "C:\\Users\\huynd1\\Downloads\\OBAD\\data" ^
  --out "C:\\Users\\huynd1\\Downloads\\OBAD\\data\\dataReport\\datamodel_eval_report"

Nếu CSV dùng dấu ;:
python evaluate_datamodel_splits.py --base "C:\\Users\\huynd1\\Downloads\\OBAD\\data" --sep ";"

Script này chỉ đánh giá dữ liệu, chưa train model.
python evaluate_datamodel_splits.py --base "C:\Users\huynd1\Downloads\OBAD\data" --sep ";"
"""

from __future__ import annotations

import argparse
import json
import math
import os
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pandas as pd


SPLITS = ["train", "valid", "test"]
L1_DATASETS = ["normal_strict", "normal_lenient"]

# Các feature nên xem xét cho L1. Script sẽ tự bỏ qua cột không tồn tại.
L1_RECOMMENDED_FEATURES = [
    "status_id",
    "status_type_code",
    "current_signal_code",
    "is_loaded",
    "is_no_load",
    "is_current_near_zero",
    "duration_sec",
    "gap_from_prev_sec",
    "overlap_sec",
    "kwh_available_flag",
    "kwh_missing_flag",
    "kwh_imputed_or_missing_flag",
    "kwh_delta_model_value",
    "kwh_rate_per_hour",
    "kwh_rate_missing_flag",
    "loaded_zero_kwh_flag",
    "loaded_without_kwh_flag",
    "is_raw_end_missing",
    "is_invalid_raw_end",
    "end_time_imputed_flag",
    "is_gap",
    "is_big_gap",
    "is_overlap",
    "machine_group_id",
    "location_id",
    "hour_of_day",
    "day_of_week",
]

L1_GROUP_SORT_COLUMNS = [
    "event_id",
    "machine_id",
    "sequence_segment_id",
    "event_order_in_segment",
]

# Các feature evidence cho L2. Script sẽ tự bỏ qua cột không tồn tại.
L2_RECOMMENDED_FEATURES = [
    "duration_sec_model_value",
    "gap_from_prev_sec_model_value",
    "overlap_sec",
    "status_id",
    "status_type_code",
    "current_signal_code",
    "is_loaded",
    "is_no_load",
    "is_current_near_zero",
    "known_fault_status",
    "known_maintenance_status",
    "known_repair_status",
    "off_with_fault_status",
    "kwh_available_flag",
    "kwh_missing_flag",
    "kwh_imputed_flag",
    "kwh_delta_model_value",
    "kwh_rate_per_hour_model_value",
    "loaded_zero_kwh_flag",
    "loaded_without_kwh_flag",
    "energy_inconsistency_flag",
    "loaded_energy_unavailable_flag",
    "loaded_energy_positive_evidence",
    "time_quality_issue_flag",
    "kwh_quality_issue_flag",
    "data_quality_issue_flag",
    "data_quality_issue_count",
    "machine_group_id",
    "location_id",
    "hour_of_day",
    "day_of_week",
    "fault_evidence_count",
    "maintenance_evidence_count",
]

# Các cột target/label của L2. Không đưa vào feature train.
L2_TARGET_COLUMNS = [
    "future_fault_within_10_events",
    "future_fault_within_30_events",
    "future_fault_within_30min",
    "future_fault_within_60min",
    "future_maintenance_within_30_events",
    "future_repair_within_30_events",
]

L2_EXPLAIN_TARGET_COLUMNS = [
    "next_fault_status_id",
    "events_to_next_fault",
    "seconds_to_next_fault",
]

BINARY_LIKE_COLUMNS = [
    "is_on",
    "is_loaded",
    "is_no_load",
    "is_current_near_zero",
    "has_error_token",
    "has_maintenance_token",
    "kwh_available_flag",
    "kwh_missing_flag",
    "kwh_imputed_or_missing_flag",
    "kwh_imputed_flag",
    "kwh_start_imputed_flag",
    "kwh_end_imputed_flag",
    "kwh_zero_delta_flag",
    "kwh_positive_delta_flag",
    "kwh_negative_delta_flag",
    "kwh_rate_missing_flag",
    "loaded_positive_kwh_flag",
    "loaded_zero_kwh_flag",
    "loaded_without_kwh_flag",
    "is_raw_end_missing",
    "is_invalid_raw_end",
    "is_open_event",
    "end_time_imputed_flag",
    "is_non_positive_duration",
    "is_long_duration",
    "is_gap",
    "is_big_gap",
    "is_overlap",
    "known_fault_status",
    "known_maintenance_status",
    "known_repair_status",
    "off_with_fault_status",
    "info_status",
    "normal_loaded_production_status",
    "normal_no_load_production_status",
    "power_on_near_zero_status",
    "normal_power_off_status",
    "energy_inconsistency_flag",
    "loaded_energy_unavailable_flag",
    "loaded_energy_positive_evidence",
    "energy_counter_suspect_flag",
    "time_quality_issue_flag",
    "time_imputed_or_repaired_flag",
    "kwh_quality_issue_flag",
    "data_quality_issue_flag",
] + L2_TARGET_COLUMNS

NUMERIC_CANDIDATE_COLUMNS = sorted(set(
    L1_RECOMMENDED_FEATURES
    + L2_RECOMMENDED_FEATURES
    + L2_TARGET_COLUMNS
    + L2_EXPLAIN_TARGET_COLUMNS
    + [
        "event_id",
        "machine_id",
        "sequence_segment_id",
        "event_order_in_segment",
        "duration_sec",
        "duration_sec_model_value",
        "gap_from_prev_sec",
        "gap_from_prev_sec_model_value",
        "overlap_sec",
        "kwh_delta",
        "kwh_delta_model_value",
        "kwh_rate_per_hour",
        "kwh_rate_per_hour_model_value",
    ]
))

CATEGORICAL_DISTRIBUTION_COLUMNS = [
    "status_id",
    "status_type_code",
    "current_signal_code",
    "machine_id",
    "machine_group_id",
    "location_id",
    "hour_of_day",
    "day_of_week",
    "status_evidence_class",
    "data_quality_reason",
]

WINDOW_SIZES = [5, 10, 20, 30, 50]


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def file_size_mb(path: Path) -> float:
    if not path.exists():
        return 0.0
    return round(path.stat().st_size / (1024 * 1024), 3)


def safe_read_header(path: Path, sep: str) -> List[str]:
    if not path.exists():
        return []
    return list(pd.read_csv(path, sep=sep, nrows=0, encoding="utf-8-sig").columns)


def to_numeric_series(s: pd.Series) -> pd.Series:
    if pd.api.types.is_numeric_dtype(s):
        return s
    return pd.to_numeric(
        s.astype(str)
        .str.strip()
        .str.replace("\u00a0", "", regex=False)
        .str.replace(",", ".", regex=False)
        .replace({"": None, "NULL": None, "None": None, "nan": None, "NaN": None}),
        errors="coerce",
    )


def normalize_numeric(df: pd.DataFrame, cols: Iterable[str]) -> None:
    for c in cols:
        if c in df.columns:
            df[c] = to_numeric_series(df[c])


def to_dt(s: pd.Series) -> pd.Series:
    return pd.to_datetime(s, errors="coerce")


def pct(n: float, d: float) -> float:
    if not d:
        return 0.0
    return round(100.0 * float(n) / float(d), 6)


def write_csv(df: pd.DataFrame, path: Path) -> None:
    df.to_csv(path, index=False, encoding="utf-8-sig")


def md_table(df: pd.DataFrame, max_rows: int = 25) -> str:
    if df is None or df.empty:
        return "_Không có dữ liệu._"
    show = df.head(max_rows).copy()
    for c in show.columns:
        if pd.api.types.is_float_dtype(show[c]):
            show[c] = show[c].map(lambda x: "" if pd.isna(x) else f"{x:,.6f}")
    headers = list(show.columns)
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
    for row in show.astype(str).values.tolist():
        lines.append("| " + " | ".join(row) + " |")
    if len(df) > max_rows:
        lines.append(f"\n_Ghi chú: chỉ hiển thị {max_rows}/{len(df)} dòng._")
    return "\n".join(lines)


class NumericAccumulator:
    def __init__(self) -> None:
        self.count = 0
        self.null = 0
        self.sum = 0.0
        self.min = None
        self.max = None
        self.sum_sq = 0.0

    def update(self, s: pd.Series) -> None:
        self.null += int(s.isna().sum())
        nn = s.dropna()
        if nn.empty:
            return
        vals = pd.to_numeric(nn, errors="coerce").dropna()
        if vals.empty:
            return
        self.count += int(vals.count())
        self.sum += float(vals.sum())
        self.sum_sq += float((vals.astype(float) ** 2).sum())
        mn = float(vals.min())
        mx = float(vals.max())
        self.min = mn if self.min is None else min(self.min, mn)
        self.max = mx if self.max is None else max(self.max, mx)

    def as_dict(self, col: str, total_rows: int) -> Dict[str, Any]:
        mean = self.sum / self.count if self.count else None
        std = None
        if self.count > 1:
            var = max((self.sum_sq - (self.sum * self.sum) / self.count) / (self.count - 1), 0.0)
            std = math.sqrt(var)
        return {
            "column": col,
            "count": self.count,
            "null_count": self.null,
            "null_pct": pct(self.null, total_rows),
            "mean": mean,
            "std": std,
            "min": self.min,
            "max": self.max,
        }


@dataclass
class FileSpec:
    level: str              # l1 hoặc l2
    dataset: str            # normal_strict, normal_lenient, final
    split: str              # train/valid/test
    path: Path


class FileAnalyzer:
    def __init__(self, spec: FileSpec, sep: str, chunksize: int, out_dir: Path):
        self.spec = spec
        self.sep = sep
        self.chunksize = chunksize
        self.out_dir = out_dir
        self.columns = safe_read_header(spec.path, sep)
        self.total_rows = 0
        self.null_counts = Counter()
        self.non_null_counts = Counter()
        self.numeric_stats: Dict[str, NumericAccumulator] = defaultdict(NumericAccumulator)
        self.category_counters: Dict[str, Counter] = defaultdict(Counter)
        self.machine_counter = Counter()
        self.machine_status_counter = Counter()
        self.machine_target_counter = Counter()
        self.machine_flag_sum: Dict[str, Counter] = defaultdict(Counter)
        self.machine_minmax_order: Dict[Any, Dict[str, Any]] = defaultdict(dict)
        self.segment_counts = Counter()
        self.binary_sums = Counter()
        self.event_id_counter = Counter()
        self.duplicate_event_id_est = 0
        self.warnings: List[str] = []

    def analyze(self) -> Dict[str, Any]:
        if not self.spec.path.exists():
            self.warnings.append(f"Missing file: {self.spec.path}")
            return self.summary_dict()

        usecols = None
        for chunk in pd.read_csv(
            self.spec.path,
            sep=self.sep,
            chunksize=self.chunksize,
            encoding="utf-8-sig",
            low_memory=False,
            usecols=usecols,
        ):
            self._process_chunk(chunk)

        self._write_detail_outputs()
        return self.summary_dict()

    def _process_chunk(self, chunk: pd.DataFrame) -> None:
        self.total_rows += len(chunk)
        self.null_counts.update(chunk.isna().sum().to_dict())
        self.non_null_counts.update(chunk.notna().sum().to_dict())

        numeric_cols = [c for c in NUMERIC_CANDIDATE_COLUMNS if c in chunk.columns]
        normalize_numeric(chunk, numeric_cols)

        if "event_start_time" in chunk.columns:
            chunk["event_start_time"] = to_dt(chunk["event_start_time"])
        if "event_end_time" in chunk.columns:
            chunk["event_end_time"] = to_dt(chunk["event_end_time"])

        for c in numeric_cols:
            self.numeric_stats[c].update(chunk[c])

        for c in CATEGORICAL_DISTRIBUTION_COLUMNS:
            if c in chunk.columns:
                self.category_counters[c].update(chunk[c].fillna("NULL").astype(str).value_counts().to_dict())

        for c in [col for col in BINARY_LIKE_COLUMNS if col in chunk.columns]:
            s = pd.to_numeric(chunk[c], errors="coerce")
            self.binary_sums[c] += float(s.fillna(0).sum())

        if "machine_id" in chunk.columns:
            self.machine_counter.update(chunk["machine_id"].fillna("NULL").astype(str).value_counts().to_dict())

            # Machine-level status distribution
            if "status_id" in chunk.columns:
                g = chunk.groupby(["machine_id", "status_id"], dropna=False).size()
                for idx, cnt in g.items():
                    self.machine_status_counter[(str(idx[0]), str(idx[1]))] += int(cnt)

            # Machine-level target sums for L2
            for target in L2_TARGET_COLUMNS:
                if target in chunk.columns:
                    g = chunk.groupby("machine_id")[target].sum(min_count=1)
                    for mid, val in g.items():
                        if pd.notna(val):
                            self.machine_target_counter[(str(mid), target)] += float(val)

            # Machine-level binary feature sums
            for flag in [col for col in BINARY_LIKE_COLUMNS if col in chunk.columns]:
                g = chunk.groupby("machine_id")[flag].sum(min_count=1)
                for mid, val in g.items():
                    if pd.notna(val):
                        self.machine_flag_sum[str(mid)][flag] += float(val)

            # Min/max sequence order by machine for split leakage check.
            if "sequence_segment_id" in chunk.columns and "event_order_in_segment" in chunk.columns:
                tmp = chunk[["machine_id", "sequence_segment_id", "event_order_in_segment"]].dropna()
                if not tmp.empty:
                    tmp["sequence_segment_id"] = pd.to_numeric(tmp["sequence_segment_id"], errors="coerce")
                    tmp["event_order_in_segment"] = pd.to_numeric(tmp["event_order_in_segment"], errors="coerce")
                    tmp = tmp.dropna()
                    for mid, part in tmp.groupby("machine_id"):
                        tuples = list(zip(part["sequence_segment_id"].astype(int), part["event_order_in_segment"].astype(int)))
                        if not tuples:
                            continue
                        mn = min(tuples)
                        mx = max(tuples)
                        rec = self.machine_minmax_order[str(mid)]
                        rec["min_tuple"] = mn if "min_tuple" not in rec else min(rec["min_tuple"], mn)
                        rec["max_tuple"] = mx if "max_tuple" not in rec else max(rec["max_tuple"], mx)

            # Min/max time by machine if event_start_time exists.
            if "event_start_time" in chunk.columns:
                g = chunk.groupby("machine_id")["event_start_time"].agg(["min", "max"])
                for mid, row in g.iterrows():
                    rec = self.machine_minmax_order[str(mid)]
                    if pd.notna(row["min"]):
                        rec["min_time"] = row["min"] if "min_time" not in rec else min(rec["min_time"], row["min"])
                    if pd.notna(row["max"]):
                        rec["max_time"] = row["max"] if "max_time" not in rec else max(rec["max_time"], row["max"])

        # Segment counts for window availability.
        if "machine_id" in chunk.columns and "sequence_segment_id" in chunk.columns:
            g = chunk.groupby(["machine_id", "sequence_segment_id"], dropna=False).size()
            for idx, cnt in g.items():
                self.segment_counts[(str(idx[0]), str(idx[1]))] += int(cnt)

        # Duplicate event estimate inside this file. Exact enough for typical memory? We only store counts keys once.
        if "event_id" in chunk.columns:
            ids = pd.to_numeric(chunk["event_id"], errors="coerce").dropna().astype("int64")
            vc = ids.value_counts()
            for eid, cnt in vc.items():
                prev = self.event_id_counter.get(int(eid), 0)
                if prev > 0:
                    self.duplicate_event_id_est += int(cnt)
                elif cnt > 1:
                    self.duplicate_event_id_est += int(cnt - 1)
                self.event_id_counter[int(eid)] += int(cnt)

    def _write_detail_outputs(self) -> None:
        prefix = f"{self.spec.level}_{self.spec.dataset}_{self.spec.split}"

        col_profile = pd.DataFrame({
            "column": self.columns,
            "null_count": [self.null_counts.get(c, 0) for c in self.columns],
            "non_null_count": [self.non_null_counts.get(c, 0) for c in self.columns],
            "null_pct": [pct(self.null_counts.get(c, 0), self.total_rows) for c in self.columns],
        })
        write_csv(col_profile, self.out_dir / f"{prefix}_column_profile.csv")

        numeric_df = pd.DataFrame([
            acc.as_dict(col, self.total_rows) for col, acc in sorted(self.numeric_stats.items())
        ])
        write_csv(numeric_df, self.out_dir / f"{prefix}_numeric_stats.csv")

        for col, counter in self.category_counters.items():
            df = pd.DataFrame([
                {"value": k, "row_count": v, "pct": pct(v, self.total_rows)}
                for k, v in counter.most_common()
            ])
            write_csv(df, self.out_dir / f"{prefix}_dist_{col}.csv")

        machine_df = pd.DataFrame([
            {"machine_id": k, "row_count": v, "pct": pct(v, self.total_rows)}
            for k, v in self.machine_counter.most_common()
        ])
        write_csv(machine_df, self.out_dir / f"{prefix}_machine_distribution.csv")

        machine_status_df = pd.DataFrame([
            {"machine_id": k[0], "status_id": k[1], "row_count": v}
            for k, v in self.machine_status_counter.items()
        ])
        if not machine_status_df.empty:
            machine_status_df = machine_status_df.sort_values(["machine_id", "status_id"])
        write_csv(machine_status_df, self.out_dir / f"{prefix}_status_by_machine.csv")

        # Window availability.
        window_rows = []
        for (mid, seg), n in self.segment_counts.items():
            rec = {"machine_id": mid, "sequence_segment_id": seg, "row_count": n}
            for w in WINDOW_SIZES:
                rec[f"window_{w}_count"] = max(n - w + 1, 0)
            window_rows.append(rec)
        seg_df = pd.DataFrame(window_rows)
        if not seg_df.empty:
            write_csv(seg_df, self.out_dir / f"{prefix}_segment_window_counts.csv")

        # Binary positive summary.
        binary_rows = []
        for c, s in sorted(self.binary_sums.items()):
            binary_rows.append({
                "column": c,
                "positive_count": int(s),
                "positive_pct": pct(s, self.total_rows),
                "negative_or_null_count": int(self.total_rows - s),
            })
        write_csv(pd.DataFrame(binary_rows), self.out_dir / f"{prefix}_binary_positive_summary.csv")

    def summary_dict(self) -> Dict[str, Any]:
        window_summary = self._window_summary()
        feature_health = self._feature_health_summary()
        return {
            "level": self.spec.level,
            "dataset": self.spec.dataset,
            "split": self.spec.split,
            "path": str(self.spec.path),
            "exists": self.spec.path.exists(),
            "file_size_mb": file_size_mb(self.spec.path),
            "rows": self.total_rows,
            "columns": len(self.columns),
            "machine_count": len(self.machine_counter),
            "duplicate_event_id_est": self.duplicate_event_id_est,
            "status_count": len(self.category_counters.get("status_id", {})),
            "window_summary": window_summary,
            "feature_health": feature_health,
            "warnings": self.warnings,
        }

    def _window_summary(self) -> Dict[str, Any]:
        if not self.segment_counts:
            return {}
        values = list(self.segment_counts.values())
        result = {
            "segment_count": len(values),
            "segment_len_min": min(values),
            "segment_len_max": max(values),
            "segment_len_mean": round(sum(values) / len(values), 6),
        }
        for w in WINDOW_SIZES:
            result[f"segments_ge_{w}"] = sum(1 for n in values if n >= w)
            result[f"windows_{w}_total"] = sum(max(n - w + 1, 0) for n in values)
        return result

    def _feature_health_summary(self) -> Dict[str, Any]:
        high_null = []
        constant_or_near_constant = []
        recommended = L1_RECOMMENDED_FEATURES if self.spec.level == "l1" else L2_RECOMMENDED_FEATURES
        present = [c for c in recommended if c in self.columns]
        missing = [c for c in recommended if c not in self.columns]

        for c in present:
            null_p = pct(self.null_counts.get(c, 0), self.total_rows)
            if null_p >= 50:
                high_null.append({"column": c, "null_pct": null_p})

        for c, s in self.binary_sums.items():
            p = pct(s, self.total_rows)
            if p <= 0.01 or p >= 99.99:
                constant_or_near_constant.append({"column": c, "positive_pct": p})

        return {
            "recommended_feature_present_count": len(present),
            "recommended_feature_missing_count": len(missing),
            "recommended_feature_missing": missing,
            "high_null_recommended_features": high_null,
            "near_constant_binary_features": constant_or_near_constant,
        }


def discover_files(base: Path) -> List[FileSpec]:
    specs: List[FileSpec] = []
    for ds in L1_DATASETS:
        for split in SPLITS:
            specs.append(FileSpec(
                level="l1",
                dataset=ds,
                split=split,
                path=base / "dataModel" / "l1" / ds / f"{split}.csv",
            ))
    for split in SPLITS:
        specs.append(FileSpec(
            level="l2",
            dataset="final",
            split=split,
            path=base / "dataModel" / "l2" / f"{split}.csv",
        ))
    return specs


def collect_split_order_records(summary_by_file: Dict[str, Dict[str, Any]], out_dir: Path, sep: str) -> pd.DataFrame:
    # Re-open small machine distribution files? Better compute order by reading original files once more but only needed columns.
    # This function is intentionally not heavy; it reads only id/order/time columns when available.
    rows = []
    for key, info in summary_by_file.items():
        path = Path(info["path"])
        if not path.exists():
            continue
        cols = safe_read_header(path, sep)
        usecols = [c for c in ["machine_id", "sequence_segment_id", "event_order_in_segment", "event_start_time", "event_id"] if c in cols]
        if "machine_id" not in usecols:
            continue
        minmax: Dict[str, Dict[str, Any]] = defaultdict(dict)
        for chunk in pd.read_csv(path, sep=sep, chunksize=200_000, encoding="utf-8-sig", low_memory=False, usecols=usecols):
            normalize_numeric(chunk, [c for c in ["machine_id", "sequence_segment_id", "event_order_in_segment", "event_id"] if c in chunk.columns])
            if "event_start_time" in chunk.columns:
                chunk["event_start_time"] = to_dt(chunk["event_start_time"])
            for mid, part in chunk.groupby("machine_id"):
                rec = minmax[str(int(mid)) if pd.notna(mid) else "NULL"]
                if "sequence_segment_id" in part.columns and "event_order_in_segment" in part.columns:
                    tmp = part[["sequence_segment_id", "event_order_in_segment"]].dropna()
                    if not tmp.empty:
                        tuples = list(zip(tmp["sequence_segment_id"].astype(int), tmp["event_order_in_segment"].astype(int)))
                        mn, mx = min(tuples), max(tuples)
                        rec["min_tuple"] = mn if "min_tuple" not in rec else min(rec["min_tuple"], mn)
                        rec["max_tuple"] = mx if "max_tuple" not in rec else max(rec["max_tuple"], mx)
                if "event_start_time" in part.columns:
                    tmin = part["event_start_time"].min()
                    tmax = part["event_start_time"].max()
                    if pd.notna(tmin):
                        rec["min_time"] = tmin if "min_time" not in rec else min(rec["min_time"], tmin)
                    if pd.notna(tmax):
                        rec["max_time"] = tmax if "max_time" not in rec else max(rec["max_time"], tmax)
        level, dataset, split = info["level"], info["dataset"], info["split"]
        for mid, rec in minmax.items():
            row = {
                "level": level,
                "dataset": dataset,
                "split": split,
                "machine_id": mid,
                "min_tuple": str(rec.get("min_tuple")),
                "max_tuple": str(rec.get("max_tuple")),
                "min_time": rec.get("min_time"),
                "max_time": rec.get("max_time"),
            }
            rows.append(row)
    df = pd.DataFrame(rows)
    write_csv(df, out_dir / "split_order_minmax_by_machine.csv")
    return df


def compare_split_order(order_df: pd.DataFrame, out_dir: Path) -> pd.DataFrame:
    if order_df.empty:
        return pd.DataFrame()

    def parse_tuple(x: Any) -> Optional[Tuple[int, int]]:
        if pd.isna(x) or str(x) in ["None", "nan"]:
            return None
        s = str(x).strip().replace("(", "").replace(")", "")
        parts = [p.strip() for p in s.split(",")]
        if len(parts) != 2:
            return None
        try:
            return int(parts[0]), int(parts[1])
        except Exception:
            return None

    records = []
    for (level, dataset, mid), part in order_df.groupby(["level", "dataset", "machine_id"]):
        by_split = {r["split"]: r for _, r in part.iterrows()}
        rec = {"level": level, "dataset": dataset, "machine_id": mid}
        ok = True
        reason = []

        for a, b in [("train", "valid"), ("valid", "test")]:
            if a in by_split and b in by_split:
                max_a = parse_tuple(by_split[a].get("max_tuple"))
                min_b = parse_tuple(by_split[b].get("min_tuple"))
                if max_a is not None and min_b is not None:
                    good = max_a <= min_b
                    rec[f"{a}_max_tuple"] = str(max_a)
                    rec[f"{b}_min_tuple"] = str(min_b)
                    rec[f"{a}_before_{b}_by_tuple"] = int(good)
                    if not good:
                        ok = False
                        reason.append(f"{a}_after_{b}_by_tuple")
                # time check if available
                max_t_a = by_split[a].get("max_time")
                min_t_b = by_split[b].get("min_time")
                if pd.notna(max_t_a) and pd.notna(min_t_b):
                    good_t = pd.to_datetime(max_t_a) <= pd.to_datetime(min_t_b)
                    rec[f"{a}_max_time"] = max_t_a
                    rec[f"{b}_min_time"] = min_t_b
                    rec[f"{a}_before_{b}_by_time"] = int(good_t)
                    if not good_t:
                        ok = False
                        reason.append(f"{a}_after_{b}_by_time")
        rec["order_check_ok"] = int(ok)
        rec["reason"] = ";".join(reason) if reason else "OK"
        records.append(rec)

    df = pd.DataFrame(records)
    write_csv(df, out_dir / "split_order_check.csv")
    return df


def build_summary_tables(file_summaries: Dict[str, Dict[str, Any]], out_dir: Path) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    rows = []
    for key, info in file_summaries.items():
        ws = info.get("window_summary", {}) or {}
        fh = info.get("feature_health", {}) or {}
        rows.append({
            "key": key,
            "level": info.get("level"),
            "dataset": info.get("dataset"),
            "split": info.get("split"),
            "exists": info.get("exists"),
            "file_size_mb": info.get("file_size_mb"),
            "rows": info.get("rows"),
            "columns": info.get("columns"),
            "machine_count": info.get("machine_count"),
            "duplicate_event_id_est": info.get("duplicate_event_id_est"),
            "segment_count": ws.get("segment_count"),
            "segment_len_mean": ws.get("segment_len_mean"),
            "windows_10_total": ws.get("windows_10_total"),
            "windows_20_total": ws.get("windows_20_total"),
            "windows_30_total": ws.get("windows_30_total"),
            "recommended_feature_present_count": fh.get("recommended_feature_present_count"),
            "recommended_feature_missing_count": fh.get("recommended_feature_missing_count"),
        })
    summary_df = pd.DataFrame(rows)
    write_csv(summary_df, out_dir / "datamodel_file_summary.csv")

    # L1 strict vs lenient comparison.
    l1 = summary_df[summary_df["level"] == "l1"].copy()
    compare_rows = []
    for split in SPLITS:
        s = l1[(l1["dataset"] == "normal_strict") & (l1["split"] == split)]
        le = l1[(l1["dataset"] == "normal_lenient") & (l1["split"] == split)]
        if not s.empty and not le.empty:
            strict_rows = int(s.iloc[0]["rows"])
            lenient_rows = int(le.iloc[0]["rows"])
            compare_rows.append({
                "split": split,
                "strict_rows": strict_rows,
                "lenient_rows": lenient_rows,
                "strict_vs_lenient_pct": pct(strict_rows, lenient_rows),
                "strict_windows_20": int(s.iloc[0].get("windows_20_total") or 0),
                "lenient_windows_20": int(le.iloc[0].get("windows_20_total") or 0),
            })
    compare_df = pd.DataFrame(compare_rows)
    write_csv(compare_df, out_dir / "l1_strict_vs_lenient_summary.csv")

    # L2 target label summary from per-file binary_positive output.
    target_rows = []
    for split in SPLITS:
        f = out_dir / f"l2_final_{split}_binary_positive_summary.csv"
        if f.exists():
            df = pd.read_csv(f, encoding="utf-8-sig")
            for target in L2_TARGET_COLUMNS:
                part = df[df["column"] == target]
                if not part.empty:
                    r = part.iloc[0]
                    target_rows.append({
                        "split": split,
                        "target": target,
                        "positive_count": int(r["positive_count"]),
                        "positive_pct": float(r["positive_pct"]),
                        "negative_or_null_count": int(r["negative_or_null_count"]),
                    })
    target_df = pd.DataFrame(target_rows)
    write_csv(target_df, out_dir / "l2_target_distribution_by_split.csv")

    return summary_df, compare_df, target_df


def generate_recommendations(summary_df: pd.DataFrame, compare_df: pd.DataFrame, target_df: pd.DataFrame, order_check: pd.DataFrame) -> List[Dict[str, str]]:
    recs: List[Dict[str, str]] = []

    # Split order check.
    if not order_check.empty and "order_check_ok" in order_check.columns:
        bad = int((order_check["order_check_ok"] == 0).sum())
        if bad > 0:
            recs.append({
                "level": "critical",
                "topic": "Split order",
                "recommendation": f"Có {bad} machine/dataset có dấu hiệu train-valid-test không đúng thứ tự. Cần xem split_order_check.csv và export lại nếu cần.",
            })
        else:
            recs.append({
                "level": "ok",
                "topic": "Split order",
                "recommendation": "Train/valid/test giữ được thứ tự chuỗi theo sequence_segment_id + event_order_in_segment. Có thể tiếp tục đánh giá mô hình.",
            })

    # L1 strict vs lenient.
    if not compare_df.empty:
        train_row = compare_df[compare_df["split"] == "train"]
        if not train_row.empty:
            p = float(train_row.iloc[0]["strict_vs_lenient_pct"])
            if p < 70:
                recs.append({
                    "level": "warning",
                    "topic": "L1 strict vs lenient",
                    "recommendation": f"normal_strict chỉ còn {p:.2f}% so với lenient ở train. Nên train thử cả hai, nhưng lenient có thể đại diện thực tế tốt hơn.",
                })
            else:
                recs.append({
                    "level": "ok",
                    "topic": "L1 strict vs lenient",
                    "recommendation": f"normal_strict còn {p:.2f}% so với lenient ở train. Có thể dùng strict làm baseline sạch và lenient làm mô hình thực tế.",
                })

    # Window counts L1.
    l1_train = summary_df[(summary_df["level"] == "l1") & (summary_df["split"] == "train")]
    for _, row in l1_train.iterrows():
        windows20 = int(row.get("windows_20_total") or 0)
        ds = row.get("dataset")
        if windows20 >= 100_000:
            recs.append({
                "level": "ok",
                "topic": f"L1 {ds} window",
                "recommendation": f"Có khoảng {windows20:,} cửa sổ độ dài 20 trong train. Đủ để thử sequence autoencoder như GRU/LSTM/TCN.",
            })
        elif windows20 >= 10_000:
            recs.append({
                "level": "warning",
                "topic": f"L1 {ds} window",
                "recommendation": f"Có {windows20:,} cửa sổ độ dài 20. Nên bắt đầu bằng tabular/window-stat anomaly trước, sau đó thử sequence model.",
            })
        else:
            recs.append({
                "level": "critical",
                "topic": f"L1 {ds} window",
                "recommendation": f"Chỉ có {windows20:,} cửa sổ độ dài 20. Không nên dùng deep sequence model ở cấu hình này.",
            })

    # L2 target distribution.
    if not target_df.empty:
        train_targets = target_df[target_df["split"] == "train"]
        for _, r in train_targets.iterrows():
            pos = int(r["positive_count"])
            target = r["target"]
            if pos == 0:
                recs.append({
                    "level": "critical",
                    "topic": f"L2 target {target}",
                    "recommendation": "Train không có positive label. Không thể train supervised cho target này; cần đổi horizon/split hoặc dùng rule/weak scoring.",
                })
            elif pos < 500:
                recs.append({
                    "level": "warning",
                    "topic": f"L2 target {target}",
                    "recommendation": f"Train chỉ có {pos:,} positive. Nên dùng class_weight, threshold tuning, hoặc rule scoring hỗ trợ.",
                })
            else:
                recs.append({
                    "level": "ok",
                    "topic": f"L2 target {target}",
                    "recommendation": f"Train có {pos:,} positive. Có thể thử supervised classifier, ưu tiên LightGBM/RandomForest/Logistic class_weight trước.",
                })

    # General architecture.
    recs.append({
        "level": "strategy",
        "topic": "Kiến trúc đề xuất",
        "recommendation": "L1 nên bắt đầu bằng baseline thống kê + IsolationForest trên window feature; sau đó thử GRU/LSTM/TCN Autoencoder nếu window đủ nhiều. L2 nên là multi-label/weak-supervised, dùng behavior_anomaly_score từ L1 + status/KWh/data-quality/future labels.",
    })

    return recs


def build_markdown_report(out_dir: Path, summary_df: pd.DataFrame, compare_df: pd.DataFrame, target_df: pd.DataFrame, order_check: pd.DataFrame, recommendations: List[Dict[str, str]]) -> None:
    lines: List[str] = []
    lines.append("# Báo cáo đánh giá dataModel sau split")
    lines.append("")
    lines.append("## 1. Mục tiêu")
    lines.append("Báo cáo này đánh giá các file train/valid/test trong `dataModel` sau khi tách từ SQL view/bảng dẫn xuất. Mục tiêu là kiểm tra dữ liệu đã sẵn sàng để chọn kiến trúc L1/L2 chưa, tránh train ngay trên split bị lệch, thiếu máy, thiếu nhãn, thiếu cửa sổ chuỗi hoặc rò rỉ thời gian.")
    lines.append("")
    lines.append("## 2. Tổng quan file")
    lines.append(md_table(summary_df, 50))
    lines.append("")
    lines.append("## 3. So sánh L1 normal_strict và normal_lenient")
    lines.append(md_table(compare_df, 20))
    lines.append("")
    lines.append("## 4. Phân bố target L2 theo split")
    lines.append(md_table(target_df, 50))
    lines.append("")
    lines.append("## 5. Kiểm tra thứ tự split")
    if not order_check.empty:
        cols = [c for c in ["level", "dataset", "machine_id", "order_check_ok", "reason", "train_max_tuple", "valid_min_tuple", "valid_max_tuple", "test_min_tuple"] if c in order_check.columns]
        lines.append(md_table(order_check[cols] if cols else order_check, 50))
    else:
        lines.append("_Không có dữ liệu kiểm tra thứ tự._")
    lines.append("")
    lines.append("## 6. Khuyến nghị tự động")
    rec_df = pd.DataFrame(recommendations)
    lines.append(md_table(rec_df, 100))
    lines.append("")
    lines.append("## 7. Diễn giải chiến thuật")
    lines.append("### 7.1. Lớp 1 — Normal Behavior Deviation Detection")
    lines.append("L1 nên học nền vận hành bình thường của từng máy. Vì vậy L1 không dùng toàn bộ dữ liệu lỗi/bảo trì để train, mà dùng `normal_strict` và `normal_lenient`. `normal_strict` dùng làm baseline sạch; `normal_lenient` dùng để kiểm tra mô hình có thực tế hơn không khi dữ liệu có overlap/KWh missing/sửa thời gian.")
    lines.append("")
    lines.append("Không nên đưa `machine_id` như feature số trực tiếp trong phase đầu. `machine_id` dùng để group/sort/threshold theo máy. Model L1 nên score toàn bộ event sau khi train xong, rồi lưu ra `dataModel/l1/scored/ai_l1_operation_anomaly_result.csv`.")
    lines.append("")
    lines.append("### 7.2. Lớp 2 — Deviation Validation / Fault Confidence")
    lines.append("L2 chưa nên train trước khi có score từ L1. Dataset L2 hiện tại có evidence và future labels, nhưng cần join thêm `behavior_anomaly_score` và `is_behavior_anomaly` từ L1. L2 nên là multi-label/weak-supervised, không nên chỉ là binary lỗi/không lỗi.")
    lines.append("")
    lines.append("Các cột `future_fault_*`, `future_maintenance_*`, `future_repair_*` là target/label, không được đưa vào feature train.")
    lines.append("")
    lines.append("## 8. Các file CSV chi tiết đã sinh")
    for p in sorted(out_dir.glob("*.csv")):
        lines.append(f"- `{p.name}`")
    lines.append("")
    (out_dir / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Đánh giá dataModel split cho dự án AI vận hành Weldcom.")
    parser.add_argument("--base", required=True, help="Thư mục data gốc, ví dụ C:\\Users\\huynd1\\Downloads\\OBAD\\data")
    parser.add_argument("--out", default=None, help="Thư mục xuất report. Mặc định: <base>/dataReport/datamodel_eval_report")
    parser.add_argument("--sep", default=",", help="Delimiter CSV, mặc định dấu phẩy.")
    parser.add_argument("--chunksize", type=int, default=200_000, help="Số dòng mỗi chunk.")
    args = parser.parse_args()

    base = Path(args.base)
    out_dir = Path(args.out) if args.out else base / "dataReport" / "datamodel_eval_report"
    ensure_dir(out_dir)

    print("=== Evaluate dataModel splits ===")
    print(f"Base: {base}")
    print(f"Out : {out_dir}")

    specs = discover_files(base)
    summaries: Dict[str, Dict[str, Any]] = {}

    for i, spec in enumerate(specs, start=1):
        key = f"{spec.level}_{spec.dataset}_{spec.split}"
        print(f"[{i}/{len(specs)}] Analyze {key}: {spec.path}")
        analyzer = FileAnalyzer(spec, sep=args.sep, chunksize=args.chunksize, out_dir=out_dir)
        summaries[key] = analyzer.analyze()

    print("Build summary tables...")
    summary_df, compare_df, target_df = build_summary_tables(summaries, out_dir)

    print("Check split order...")
    order_records = collect_split_order_records(summaries, out_dir, args.sep)
    order_check = compare_split_order(order_records, out_dir)

    print("Generate recommendations...")
    recommendations = generate_recommendations(summary_df, compare_df, target_df, order_check)
    write_csv(pd.DataFrame(recommendations), out_dir / "recommendations.csv")

    print("Write report...")
    build_markdown_report(out_dir, summary_df, compare_df, target_df, order_check, recommendations)

    summary_json = {
        "base": str(base),
        "out_dir": str(out_dir),
        "files": summaries,
        "recommendations": recommendations,
    }
    (out_dir / "summary.json").write_text(json.dumps(summary_json, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    print("\nHoàn tất.")
    print(f"Report: {out_dir / 'REPORT.md'}")
    print(f"Summary: {out_dir / 'summary.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
