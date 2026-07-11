from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable


csv.field_size_limit(sys.maxsize)


NULL_TOKENS = {"", "null", "none", "nan", "nat", "n/a", "na"}
ENCODINGS = ("utf-8-sig", "utf-8", "utf-16", "latin1")
NUMBER_RE = re.compile(r"^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$")
YEAR_RE = re.compile(r"(19|20)\d{2}")
TOKEN_SPLIT_RE = re.compile(r"[_+\-|/]+")
TOP_K = 12
MAX_DISTINCT_TRACKED = 20000
MAX_VALUE_SAMPLES = 5
MAX_COUNTER_SIZE = 80
MAX_POSITION_TRACKED = 4
DETAILED_VALUE_LIMIT = 1200
PROGRESS_EVERY_ROWS = 1000000


def clean_text(value: str | None) -> str:
    if value is None:
        return ""
    value = value.replace("\ufeff", "").replace("\x00", "").strip()
    return value


def normalize_header(header: str) -> str:
    return clean_text(header).replace('"', "")


def is_null_like(value: str) -> bool:
    return value.lower() in NULL_TOKENS


def looks_like_number(value: str) -> bool:
    return bool(NUMBER_RE.match(value))


def try_parse_number(value: str) -> float | None:
    if not looks_like_number(value):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def looks_like_datetime(value: str) -> bool:
    if not value or not YEAR_RE.search(value):
        return False
    return any(mark in value for mark in ("-", "/", ":", "T"))


def try_parse_datetime(value: str) -> datetime | None:
    value = value.strip()
    if not looks_like_datetime(value):
        return None

    formats = (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y",
    )
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue

    try:
        return datetime.fromisoformat(value.replace("Z", ""))
    except ValueError:
        return None


def safe_round(value: float | None, digits: int = 2) -> float | None:
    if value is None or math.isnan(value):
        return None
    return round(value, digits)


def prune_counter(counter: Counter[str], max_size: int = MAX_COUNTER_SIZE) -> None:
    if len(counter) <= max_size * 2:
        return
    trimmed = counter.most_common(max_size)
    counter.clear()
    counter.update(dict(trimmed))


def top_items(counter: Counter[str], limit: int = 5) -> list[dict[str, Any]]:
    return [{"value": key, "count": count} for key, count in counter.most_common(limit)]


def normalize_table_stem(file_name: str) -> str:
    stem = Path(file_name).stem.lower()
    if stem.startswith("data_"):
        stem = stem[5:]
    return stem


def tokens_from_name(name: str) -> set[str]:
    return {token for token in normalize_table_stem(name).split("_") if token}


def name_affinity(column_name: str, table_name: str) -> float:
    stem = column_name.lower()
    if stem.endswith("_id"):
        stem = stem[:-3]
    elif stem == "id":
        stem = ""

    aliases = {
        "err_group": "error_group",
        "error": "error",
        "machine": "machine",
        "machine_group": "machine_group",
        "maintenance": "maintenance",
        "cabinetglobal": "electric_cabinetglobal",
        "electric_cabinet": "electric_cabinet",
        "component": "machine_component",
    }

    if stem in aliases:
        stem = aliases[stem]

    if not stem:
        return 0.0

    stem_tokens = {part for part in stem.split("_") if part}
    table_tokens = tokens_from_name(table_name)

    if not stem_tokens or not table_tokens:
        return 0.0
    if stem == normalize_table_stem(table_name):
        return 1.0
    if stem_tokens.issubset(table_tokens):
        if len(stem_tokens) == len(table_tokens):
            return 0.95
        if len(table_tokens) - len(stem_tokens) == 1:
            return 0.55
        return 0.4
    if table_tokens.issubset(stem_tokens):
        return 0.8
    overlap = len(stem_tokens & table_tokens)
    if overlap:
        return overlap / max(len(stem_tokens), len(table_tokens))
    return 0.0


def ratio(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator


def readiness_label(score: float) -> str:
    if score >= 80:
        return "High"
    if score >= 60:
        return "Medium"
    if score >= 40:
        return "Low-Medium"
    return "Low"


@dataclass
class NumericSummary:
    count: int = 0
    total: float = 0.0
    min_value: float | None = None
    max_value: float | None = None

    def update(self, value: float) -> None:
        self.count += 1
        self.total += value
        self.min_value = value if self.min_value is None else min(self.min_value, value)
        self.max_value = value if self.max_value is None else max(self.max_value, value)

    def mean(self) -> float | None:
        if self.count == 0:
            return None
        return self.total / self.count

    def as_dict(self) -> dict[str, Any]:
        return {
            "count": self.count,
            "min": safe_round(self.min_value),
            "max": safe_round(self.max_value),
            "mean": safe_round(self.mean()),
        }


@dataclass
class ColumnProfiler:
    name: str
    is_time_hint: bool = field(init=False)
    is_numeric_hint: bool = field(init=False)
    is_text_hint: bool = field(init=False)
    is_id_like: bool = field(init=False)
    empty_count: int = 0
    non_empty_count: int = 0
    sample_values: list[str] = field(default_factory=list)
    distinct_values: set[str] = field(default_factory=set)
    distinct_overflow: bool = False
    value_counter: Counter[str] = field(default_factory=Counter)
    numeric_count: int = 0
    integer_like_count: int = 0
    datetime_count: int = 0
    boolean_like_count: int = 0
    detailed_seen: int = 0
    min_length: int | None = None
    max_length: int = 0
    contains_null_bytes: int = 0
    numeric_summary: NumericSummary = field(default_factory=NumericSummary)
    datetime_min: datetime | None = None
    datetime_max: datetime | None = None
    compound_value_count: int = 0
    separator_counter: Counter[str] = field(default_factory=Counter)
    token_counter: Counter[str] = field(default_factory=Counter)
    position_tokens: list[Counter[str]] = field(
        default_factory=lambda: [Counter() for _ in range(MAX_POSITION_TRACKED)]
    )
    track_top_values: bool = field(init=False)

    def __post_init__(self) -> None:
        lower = self.name.lower()
        self.is_time_hint = any(token in lower for token in ("time", "date", "timestamp"))
        self.is_numeric_hint = any(
            token in lower
            for token in (
                "kwh",
                "cost",
                "power",
                "voltage",
                "current",
                "factor",
                "hour",
                "duration",
                "year",
                "count",
                "severity",
                "coordinate",
                "order",
                "rate",
            )
        )
        self.is_text_hint = any(
            token in lower
            for token in ("note", "desc", "reason", "comment", "title", "name", "standard", "model", "serial")
        )
        self.is_id_like = lower == "id" or lower.endswith("_id") or lower.endswith("_ids")
        self.track_top_values = (
            self.is_text_hint
            or self.is_time_hint
            or self.is_numeric_hint
            or any(token in lower for token in ("status", "group", "type", "code", "machine_id", "error_id"))
        )

    def update(self, raw_value: str) -> None:
        value = clean_text(raw_value)
        if not value or is_null_like(value):
            self.empty_count += 1
            return

        self.non_empty_count += 1
        value_length = len(value)
        self.min_length = value_length if self.min_length is None else min(self.min_length, value_length)
        self.max_length = max(self.max_length, value_length)

        if "\x00" in raw_value:
            self.contains_null_bytes += 1

        if len(self.sample_values) < MAX_VALUE_SAMPLES and value not in self.sample_values:
            self.sample_values.append(value)

        if not self.distinct_overflow:
            self.distinct_values.add(value)
            if len(self.distinct_values) > MAX_DISTINCT_TRACKED:
                self.distinct_overflow = True

        if self.track_top_values and value_length <= 120 and not (self.distinct_overflow and not self.is_text_hint):
            self.value_counter[value] += 1
            prune_counter(self.value_counter)

        needs_detail = self.is_time_hint or self.is_numeric_hint or self.detailed_seen < DETAILED_VALUE_LIMIT
        if not needs_detail:
            return

        self.detailed_seen += 1

        number_value = try_parse_number(value)
        if number_value is not None:
            self.numeric_count += 1
            if number_value.is_integer():
                self.integer_like_count += 1
            self.numeric_summary.update(number_value)

        if value.lower() in {"0", "1", "true", "false", "yes", "no"}:
            self.boolean_like_count += 1

        dt_value = try_parse_datetime(value)
        if dt_value is not None:
            self.datetime_count += 1
            self.datetime_min = dt_value if self.datetime_min is None else min(self.datetime_min, dt_value)
            self.datetime_max = dt_value if self.datetime_max is None else max(self.datetime_max, dt_value)

        if self.is_text_hint and any(sep in value for sep in ("_", "+", "-", "/", "|")):
            split_parts = [part.strip() for part in TOKEN_SPLIT_RE.split(value) if part.strip()]
            if len(split_parts) > 1:
                self.compound_value_count += 1
                for sep in ("_", "+", "-", "/", "|"):
                    if sep in value:
                        self.separator_counter[sep] += 1
                for index, token in enumerate(split_parts[:MAX_POSITION_TRACKED]):
                    self.position_tokens[index][token] += 1
                    if len(token) <= 40:
                        self.token_counter[token] += 1

    def unique_count_display(self) -> str:
        if not self.distinct_overflow:
            return str(len(self.distinct_values))
        return f">{MAX_DISTINCT_TRACKED}"

    def inferred_type(self) -> str:
        base = self.non_empty_count if self.non_empty_count else 1
        num_ratio = self.numeric_count / base
        dt_ratio = self.datetime_count / base
        bool_ratio = self.boolean_like_count / base
        if dt_ratio >= 0.9:
            return "datetime"
        if num_ratio >= 0.95 and self.integer_like_count / max(self.numeric_count, 1) >= 0.98:
            return "integer"
        if num_ratio >= 0.8:
            return "float"
        if bool_ratio >= 0.95:
            return "boolean"
        if self.is_id_like:
            return "id_like_text"
        if self.max_length >= 80:
            return "long_text"
        if not self.distinct_overflow and len(self.distinct_values) <= 25:
            return "categorical_text"
        if self.compound_value_count >= max(10, self.non_empty_count * 0.2):
            return "compound_string"
        return "string"

    def semantic_role(self) -> str:
        lower = self.name.lower()
        inferred = self.inferred_type()
        if lower == "id":
            return "primary_key_candidate"
        if lower.endswith("_id"):
            return "foreign_key_candidate"
        if self.is_time_hint:
            return "time_dimension"
        if any(token in lower for token in ("kwh", "cost", "power", "current", "voltage", "factor", "coordinate")):
            return "numeric_measure"
        if any(token in lower for token in ("status", "group", "type", "severity", "color")):
            return "categorical_code"
        if any(token in lower for token in ("note", "desc", "reason", "comment", "standard")):
            return "free_text_or_instruction"
        if "name" in lower or "title" in lower or "model" in lower:
            return "label_or_asset_name"
        if inferred == "compound_string":
            return "encoded_business_string"
        return "generic_feature"

    def compound_summary(self) -> dict[str, Any] | None:
        if self.compound_value_count == 0:
            return None
        ratio_pct = safe_round(100 * self.compound_value_count / max(self.non_empty_count, 1), 2)
        if ratio_pct is None or ratio_pct < 10:
            return None
        return {
            "ratio_percent": ratio_pct,
            "separators": top_items(self.separator_counter, limit=5),
            "top_tokens": top_items(self.token_counter, limit=8),
            "token_positions": {
                f"part_{index + 1}": top_items(counter, limit=3)
                for index, counter in enumerate(self.position_tokens)
                if counter
            },
        }

    def as_dict(self, total_rows: int) -> dict[str, Any]:
        missing_rate = safe_round(100 * self.empty_count / max(total_rows, 1), 2)
        payload = {
            "name": self.name,
            "semantic_role": self.semantic_role(),
            "inferred_type": self.inferred_type(),
            "non_empty_count": self.non_empty_count,
            "missing_percent": missing_rate,
            "unique_count": self.unique_count_display(),
            "sample_values": self.sample_values,
            "top_values": top_items(self.value_counter, limit=5),
            "min_length": self.min_length,
            "max_length": self.max_length,
            "numeric_summary": self.numeric_summary.as_dict() if self.numeric_count else None,
            "datetime_min": self.datetime_min.isoformat(sep=" ") if self.datetime_min else None,
            "datetime_max": self.datetime_max.isoformat(sep=" ") if self.datetime_max else None,
            "contains_null_byte_rows": self.contains_null_bytes,
        }
        compound = self.compound_summary()
        if compound:
            payload["compound_analysis"] = compound
        return payload


class BaseSpecialAnalyzer:
    def __init__(self, header_index: dict[str, int]) -> None:
        self.header_index = header_index

    def on_row(self, row: list[str]) -> None:
        return None

    def summary(self) -> dict[str, Any]:
        return {}


class IOTConvertAnalyzer(BaseSpecialAnalyzer):
    def __init__(self, header_index: dict[str, int]) -> None:
        super().__init__(header_index)
        self.machine_counts: Counter[str] = Counter()
        self.status_counts: Counter[str] = Counter()
        self.note_counts: Counter[str] = Counter()
        self.duration_seconds = NumericSummary()
        self.kwh_delta = NumericSummary()
        self.zero_or_negative_duration = 0
        self.zero_kwh_delta = 0
        self.negative_kwh_delta = 0

    def on_row(self, row: list[str]) -> None:
        machine_id = clean_text(row[self.header_index["machine_id"]]) if "machine_id" in self.header_index else ""
        status_id = clean_text(row[self.header_index["status_id"]]) if "status_id" in self.header_index else ""
        note = clean_text(row[self.header_index["note"]]) if "note" in self.header_index else ""
        start = clean_text(row[self.header_index["status_time_start"]]) if "status_time_start" in self.header_index else ""
        end = clean_text(row[self.header_index["status_time_end"]]) if "status_time_end" in self.header_index else ""
        kwh_start = clean_text(row[self.header_index["status_kwh_start"]]) if "status_kwh_start" in self.header_index else ""
        kwh_end = clean_text(row[self.header_index["status_kwh_end"]]) if "status_kwh_end" in self.header_index else ""

        if machine_id:
            self.machine_counts[machine_id] += 1
        if status_id:
            self.status_counts[status_id] += 1
        if note:
            self.note_counts[note] += 1
            prune_counter(self.note_counts)

        start_dt = try_parse_datetime(start)
        end_dt = try_parse_datetime(end)
        if start_dt and end_dt:
            duration = (end_dt - start_dt).total_seconds()
            self.duration_seconds.update(duration)
            if duration <= 0:
                self.zero_or_negative_duration += 1

        start_kwh = try_parse_number(kwh_start)
        end_kwh = try_parse_number(kwh_end)
        if start_kwh is not None and end_kwh is not None:
            delta = end_kwh - start_kwh
            self.kwh_delta.update(delta)
            if delta == 0:
                self.zero_kwh_delta += 1
            if delta < 0:
                self.negative_kwh_delta += 1

    def summary(self) -> dict[str, Any]:
        return {
            "machine_count": len(self.machine_counts),
            "top_machines": top_items(self.machine_counts, 8),
            "status_count": len(self.status_counts),
            "top_statuses": top_items(self.status_counts, 8),
            "top_notes": top_items(self.note_counts, 8),
            "duration_seconds": self.duration_seconds.as_dict(),
            "zero_or_negative_duration_rows": self.zero_or_negative_duration,
            "kwh_delta": self.kwh_delta.as_dict(),
            "zero_kwh_delta_rows": self.zero_kwh_delta,
            "negative_kwh_delta_rows": self.negative_kwh_delta,
        }


class IssueAnalyzer(BaseSpecialAnalyzer):
    def __init__(self, header_index: dict[str, int]) -> None:
        super().__init__(header_index)
        self.machine_counts: Counter[str] = Counter()
        self.error_counts: Counter[str] = Counter()
        self.status_counts: Counter[str] = Counter()
        self.severity_counts: Counter[str] = Counter()
        self.issue_desc_non_empty = 0
        self.reason_non_empty = 0

    def on_row(self, row: list[str]) -> None:
        for column, counter in (
            ("machine_id", self.machine_counts),
            ("error_id", self.error_counts),
            ("status_id", self.status_counts),
            ("severity_id", self.severity_counts),
        ):
            if column in self.header_index:
                value = clean_text(row[self.header_index[column]])
                if value:
                    counter[value] += 1
        if "issue_desc" in self.header_index and clean_text(row[self.header_index["issue_desc"]]):
            self.issue_desc_non_empty += 1
        if "reason" in self.header_index and clean_text(row[self.header_index["reason"]]):
            self.reason_non_empty += 1

    def summary(self) -> dict[str, Any]:
        return {
            "machine_count": len(self.machine_counts),
            "top_error_ids": top_items(self.error_counts, 8),
            "top_status_ids": top_items(self.status_counts, 8),
            "top_severity_ids": top_items(self.severity_counts, 8),
            "issue_desc_non_empty_rows": self.issue_desc_non_empty,
            "reason_non_empty_rows": self.reason_non_empty,
        }


class RepairAnalyzer(BaseSpecialAnalyzer):
    def __init__(self, header_index: dict[str, int]) -> None:
        super().__init__(header_index)
        self.machine_counts: Counter[str] = Counter()
        self.done_counts: Counter[str] = Counter()
        self.cost_summary = NumericSummary()
        self.desc_non_empty = 0

    def on_row(self, row: list[str]) -> None:
        if "machine_id" in self.header_index:
            machine_id = clean_text(row[self.header_index["machine_id"]])
            if machine_id:
                self.machine_counts[machine_id] += 1
        if "is_done" in self.header_index:
            is_done = clean_text(row[self.header_index["is_done"]])
            if is_done:
                self.done_counts[is_done] += 1
        if "repair_costs" in self.header_index:
            repair_cost = try_parse_number(clean_text(row[self.header_index["repair_costs"]]))
            if repair_cost is not None:
                self.cost_summary.update(repair_cost)
        if "repair_desc" in self.header_index and clean_text(row[self.header_index["repair_desc"]]):
            self.desc_non_empty += 1

    def summary(self) -> dict[str, Any]:
        return {
            "machine_count": len(self.machine_counts),
            "top_machines": top_items(self.machine_counts, 8),
            "done_flag_distribution": top_items(self.done_counts, 8),
            "repair_costs": self.cost_summary.as_dict(),
            "repair_desc_non_empty_rows": self.desc_non_empty,
        }


class MaintenanceHistoryAnalyzer(BaseSpecialAnalyzer):
    def __init__(self, header_index: dict[str, int]) -> None:
        super().__init__(header_index)
        self.machine_counts: Counter[str] = Counter()
        self.status_counts: Counter[str] = Counter()
        self.open_rows = 0
        self.lead_time_days = NumericSummary()

    def on_row(self, row: list[str]) -> None:
        if "machine_id" in self.header_index:
            machine_id = clean_text(row[self.header_index["machine_id"]])
            if machine_id:
                self.machine_counts[machine_id] += 1
        if "maintenance_status_id" in self.header_index:
            status_id = clean_text(row[self.header_index["maintenance_status_id"]])
            if status_id:
                self.status_counts[status_id] += 1
        due_date = clean_text(row[self.header_index["due_date"]]) if "due_date" in self.header_index else ""
        done_date = clean_text(row[self.header_index["done_date"]]) if "done_date" in self.header_index else ""
        due_dt = try_parse_datetime(due_date)
        done_dt = try_parse_datetime(done_date)
        if due_dt and done_dt:
            self.lead_time_days.update((done_dt - due_dt).total_seconds() / 86400.0)
        if due_dt and not done_dt:
            self.open_rows += 1

    def summary(self) -> dict[str, Any]:
        return {
            "machine_count": len(self.machine_counts),
            "top_machines": top_items(self.machine_counts, 8),
            "maintenance_status_distribution": top_items(self.status_counts, 8),
            "open_rows_without_done_date": self.open_rows,
            "lead_time_days": self.lead_time_days.as_dict(),
        }


class CabinetKwhAnalyzer(BaseSpecialAnalyzer):
    def __init__(self, header_index: dict[str, int]) -> None:
        super().__init__(header_index)
        self.asset_counts: Counter[str] = Counter()
        self.delta_summary = NumericSummary()
        self.negative_delta_rows = 0
        self.zero_delta_rows = 0
        self.interval_seconds = NumericSummary()
        self.last_kwh_by_asset: dict[str, float] = {}
        self.last_time_by_asset: dict[str, datetime] = {}

    def on_row(self, row: list[str]) -> None:
        asset_id = clean_text(row[self.header_index["cabinetglobal_id"]]) if "cabinetglobal_id" in self.header_index else ""
        kwh_text = clean_text(row[self.header_index["iot_kwh"]]) if "iot_kwh" in self.header_index else ""
        time_text = clean_text(row[self.header_index["iot_time"]]) if "iot_time" in self.header_index else ""

        if not asset_id:
            return

        self.asset_counts[asset_id] += 1
        kwh_value = try_parse_number(kwh_text)
        time_value = try_parse_datetime(time_text)

        if asset_id in self.last_kwh_by_asset and kwh_value is not None:
            delta = kwh_value - self.last_kwh_by_asset[asset_id]
            self.delta_summary.update(delta)
            if delta < 0:
                self.negative_delta_rows += 1
            if delta == 0:
                self.zero_delta_rows += 1
        if asset_id in self.last_time_by_asset and time_value is not None:
            gap_seconds = (time_value - self.last_time_by_asset[asset_id]).total_seconds()
            self.interval_seconds.update(gap_seconds)

        if kwh_value is not None:
            self.last_kwh_by_asset[asset_id] = kwh_value
        if time_value is not None:
            self.last_time_by_asset[asset_id] = time_value

    def summary(self) -> dict[str, Any]:
        return {
            "asset_count": len(self.asset_counts),
            "top_assets": top_items(self.asset_counts, 8),
            "delta_summary": self.delta_summary.as_dict(),
            "negative_delta_rows": self.negative_delta_rows,
            "zero_delta_rows": self.zero_delta_rows,
            "interval_seconds": self.interval_seconds.as_dict(),
        }


SPECIAL_ANALYZERS: dict[str, type[BaseSpecialAnalyzer]] = {
    "data_iot_convert.csv": IOTConvertAnalyzer,
    "data_machine_issue.csv": IssueAnalyzer,
    "data_machine_repair.csv": RepairAnalyzer,
    "data_machine_maintenance_his.csv": MaintenanceHistoryAnalyzer,
    "data_cabinetglobal_kwh.csv": CabinetKwhAnalyzer,
}


@dataclass
class TableProfile:
    file_path: Path
    encoding: str
    headers: list[str]
    row_count: int = 0
    bad_row_count: int = 0
    column_profiles: list[ColumnProfiler] = field(default_factory=list)
    special_summary_data: dict[str, Any] = field(default_factory=dict)
    head_rows: list[dict[str, str]] = field(default_factory=list)

    @property
    def file_name(self) -> str:
        return self.file_path.name

    @property
    def size_bytes(self) -> int:
        return self.file_path.stat().st_size

    def table_kind(self) -> str:
        lower = self.file_name.lower()
        header_set = {header.lower() for header in self.headers}
        if "status_time_start" in header_set and "status_time_end" in header_set:
            return "event_intervals"
        if "iot_time" in header_set:
            return "time_series"
        if "date" in header_set and self.row_count > 100:
            return "daily_aggregate"
        if "issue" in lower or "repair" in lower or "maintenance_his" in lower:
            return "operational_records"
        if self.row_count <= 10000 and "id" in header_set:
            return "master_data"
        return "mixed_table"

    def primary_time_column(self) -> str | None:
        time_candidates = []
        for profile in self.column_profiles:
            if profile.semantic_role() == "time_dimension" and profile.datetime_count > 0:
                time_candidates.append(profile)
        if not time_candidates:
            return None
        preferred_names = ("status_time_start", "iot_time", "error_date", "repair_date", "due_date", "date", "created_time")
        for preferred in preferred_names:
            for candidate in time_candidates:
                if candidate.name.lower() == preferred:
                    return candidate.name
        return time_candidates[0].name

    def get_column(self, name: str) -> ColumnProfiler | None:
        for profile in self.column_profiles:
            if profile.name.lower() == name.lower():
                return profile
        return None

    def as_dict(self) -> dict[str, Any]:
        time_column_name = self.primary_time_column()
        time_column = self.get_column(time_column_name) if time_column_name else None
        missing_cells = sum(profile.empty_count for profile in self.column_profiles)
        total_cells = max(self.row_count * max(len(self.column_profiles), 1), 1)
        return {
            "file_name": self.file_name,
            "file_path": str(self.file_path),
            "size_bytes": self.size_bytes,
            "encoding": self.encoding,
            "row_count": self.row_count,
            "column_count": len(self.column_profiles),
            "bad_row_count": self.bad_row_count,
            "table_kind": self.table_kind(),
            "missing_percent": safe_round(100 * missing_cells / total_cells, 2),
            "primary_time_column": time_column_name,
            "time_range": {
                "start": time_column.datetime_min.isoformat(sep=" ") if time_column and time_column.datetime_min else None,
                "end": time_column.datetime_max.isoformat(sep=" ") if time_column and time_column.datetime_max else None,
            },
            "columns": [profile.as_dict(self.row_count) for profile in self.column_profiles],
            "special_summary": self.special_summary_data,
            "head_rows": self.head_rows,
        }


class WeldcomDiscovery:
    def __init__(self, data_dir: Path, only_files: set[str] | None = None) -> None:
        self.data_dir = data_dir
        self.only_files = only_files
        self.table_profiles: list[TableProfile] = []

    def detect_encoding(self, file_path: Path) -> str:
        for encoding in ENCODINGS:
            try:
                with file_path.open("r", encoding=encoding, errors="strict", newline="") as handle:
                    handle.readline()
                return encoding
            except UnicodeError:
                continue
        return "utf-8"

    def read_headers(self, file_path: Path, encoding: str) -> list[str]:
        with file_path.open("r", encoding=encoding, errors="replace", newline="") as handle:
            reader = csv.reader(handle, delimiter=";")
            headers = next(reader, [])
        return [normalize_header(header) for header in headers]

    def build_special_analyzer(self, file_name: str, headers: list[str]) -> BaseSpecialAnalyzer:
        analyzer_class = SPECIAL_ANALYZERS.get(file_name)
        if not analyzer_class:
            return BaseSpecialAnalyzer({header.lower(): index for index, header in enumerate(headers)})
        return analyzer_class({header.lower(): index for index, header in enumerate(headers)})

    def profile_file(self, file_path: Path) -> TableProfile:
        encoding = self.detect_encoding(file_path)
        headers = self.read_headers(file_path, encoding)
        table_profile = TableProfile(
            file_path=file_path,
            encoding=encoding,
            headers=headers,
            column_profiles=[ColumnProfiler(name=header) for header in headers],
        )
        special = self.build_special_analyzer(file_path.name, headers)

        print(f"[scan] {file_path.name} | encoding={encoding} | columns={len(headers)} | size={file_path.stat().st_size:,} bytes")

        with file_path.open("r", encoding=encoding, errors="replace", newline="") as handle:
            reader = csv.reader(handle, delimiter=";")
            next(reader, None)
            for row_index, raw_row in enumerate(reader, start=1):
                if len(raw_row) != len(headers):
                    table_profile.bad_row_count += 1
                    if len(raw_row) < len(headers):
                        raw_row = raw_row + [""] * (len(headers) - len(raw_row))
                    else:
                        raw_row = raw_row[: len(headers)]

                table_profile.row_count += 1
                if len(table_profile.head_rows) < 5:
                    table_profile.head_rows.append(
                        {headers[index]: clean_text(value) for index, value in enumerate(raw_row)}
                    )
                for index, value in enumerate(raw_row):
                    table_profile.column_profiles[index].update(value)
                special.on_row(raw_row)

                if row_index % PROGRESS_EVERY_ROWS == 0:
                    print(f"  [progress] {file_path.name}: {row_index:,} rows scanned")

        table_profile.special_summary_data = special.summary()
        return table_profile

    def run(self) -> list[TableProfile]:
        files = sorted(self.data_dir.glob("*.csv"))
        if self.only_files:
            files = [file_path for file_path in files if file_path.name in self.only_files]
        if not files:
            raise FileNotFoundError(f"No CSV files found in {self.data_dir}")

        for file_path in files:
            self.table_profiles.append(self.profile_file(file_path))
        return self.table_profiles


def load_small_csv(data_dir: Path, file_name: str) -> list[dict[str, str]]:
    file_path = data_dir / file_name
    if not file_path.exists():
        return []
    encoding = "utf-16"
    for candidate in ENCODINGS:
        try:
            with file_path.open("r", encoding=candidate, newline="") as handle:
                reader = csv.DictReader(handle, delimiter=";")
                rows = []
                for row in reader:
                    cleaned = {
                        normalize_header(key): clean_text(value)
                        for key, value in row.items()
                        if key is not None
                    }
                    rows.append(cleaned)
                return rows
        except UnicodeError:
            continue
    return []


def coverage_ratio(source_values: Iterable[str], target_values: Iterable[str]) -> float:
    source = {clean_text(value) for value in source_values if clean_text(value)}
    target = {clean_text(value) for value in target_values if clean_text(value)}
    if not source:
        return 0.0
    return len(source & target) / len(source)


def build_focus_relationships(data_dir: Path, table_profiles: list[TableProfile]) -> list[dict[str, Any]]:
    table_map = {table.file_name: table for table in table_profiles}
    rows = {
        "data_machine.csv": load_small_csv(data_dir, "data_machine.csv"),
        "data_machine_status.csv": load_small_csv(data_dir, "data_machine_status.csv"),
        "machine_location_his.csv": load_small_csv(data_dir, "machine_location_his.csv"),
        "data_location.csv": load_small_csv(data_dir, "data_location.csv"),
        "data_electric_cabinet.csv": load_small_csv(data_dir, "data_electric_cabinet.csv"),
        "data_electric_cabinetglobal.csv": load_small_csv(data_dir, "data_electric_cabinetglobal.csv"),
        "data_cabinetglobal_kwh_daily.csv": load_small_csv(data_dir, "data_cabinetglobal_kwh_daily.csv"),
    }

    relationships: list[dict[str, Any]] = []

    def distinct_from_profile(file_name: str, column_name: str) -> set[str]:
        table = table_map.get(file_name)
        if not table:
            return set()
        column = table.get_column(column_name)
        if not column:
            return set()
        return {clean_text(value) for value in column.distinct_values if clean_text(value)}

    machine_rows = rows["data_machine.csv"]
    status_rows = rows["data_machine_status.csv"]
    location_rows = rows["data_location.csv"]
    location_his_rows = rows["machine_location_his.csv"]
    electric_cabinet_rows = rows["data_electric_cabinet.csv"]
    cabinet_rows = rows["data_electric_cabinetglobal.csv"]
    cabinet_daily_rows = rows["data_cabinetglobal_kwh_daily.csv"]
    iot_table = table_map.get("data_iot_convert.csv")
    cabinet_kwh_table = table_map.get("data_cabinetglobal_kwh.csv")

    machine_ids = distinct_from_profile("data_machine.csv", "id") or {row.get("id", "") for row in machine_rows}
    status_ids = distinct_from_profile("data_machine_status.csv", "id") or {row.get("id", "") for row in status_rows}
    location_ids = distinct_from_profile("data_location.csv", "id") or {row.get("id", "") for row in location_rows}
    cabinet_ids = distinct_from_profile("data_electric_cabinetglobal.csv", "id") or {row.get("id", "") for row in cabinet_rows}
    iot_machine_ids = set(iot_table.get_column("machine_id").distinct_values) if iot_table and iot_table.get_column("machine_id") else set()
    iot_status_ids = set(iot_table.get_column("status_id").distinct_values) if iot_table and iot_table.get_column("status_id") else set()
    cabinet_kwh_ids = (
        set(cabinet_kwh_table.get_column("cabinetglobal_id").distinct_values)
        if cabinet_kwh_table and cabinet_kwh_table.get_column("cabinetglobal_id")
        else set()
    )
    active_map: dict[str, list[dict[str, str]]] = defaultdict(list)

    if iot_machine_ids and machine_rows:
        relationships.append(
            {
                "relation": "data_iot_convert.machine_id -> data_machine.id",
                "kind": "direct_key",
                "coverage": safe_round(coverage_ratio(iot_machine_ids, machine_ids), 3),
                "observed_source_keys": sorted(iot_machine_ids),
                "observed_target_rows": len(machine_rows),
                "meaning": "Each machine state interval can be mapped to machine master data.",
            }
        )

    if iot_status_ids and status_rows:
        status_note = {row.get("id", ""): row.get("note", "") for row in status_rows}
        note_consistency = True
        if iot_table:
            for row in iot_table.head_rows:
                sid = row.get("status_id", "")
                note = row.get("note", "")
                if sid and note and sid in status_note and status_note[sid] and note != status_note[sid]:
                    note_consistency = False
                    break
        relationships.append(
            {
                "relation": "data_iot_convert.status_id -> data_machine_status.id",
                "kind": "direct_key",
                "coverage": safe_round(coverage_ratio(iot_status_ids, status_ids), 3),
                "observed_source_keys": sorted(iot_status_ids),
                "observed_target_rows": len(status_rows),
                "meaning": "Each interval state id resolves to a named machine status.",
                "note_consistency_on_sample": note_consistency,
            }
        )

    if location_his_rows and machine_rows:
        location_machine_ids = distinct_from_profile("machine_location_his.csv", "machine_id") or {
            row.get("machine_id", "") for row in location_his_rows if row.get("machine_id")
        }
        iot_location_bridge_coverage = None
        if iot_machine_ids:
            iot_location_bridge_coverage = safe_round(coverage_ratio(iot_machine_ids, location_machine_ids), 3)
        relationships.append(
            {
                "relation": "machine_location_his.machine_id -> data_machine.id",
                "kind": "direct_key",
                "coverage": safe_round(coverage_ratio(location_machine_ids, machine_ids), 3),
                "observed_source_keys": len(location_machine_ids),
                "observed_target_rows": len(machine_rows),
                "meaning": "Machine location history is the bridge from machine to shop-floor location.",
                "iot_domain_coverage": iot_location_bridge_coverage,
            }
        )

    if location_his_rows and location_rows:
        location_his_ids = distinct_from_profile("machine_location_his.csv", "location_id") or {
            row.get("location_id", "") for row in location_his_rows if row.get("location_id")
        }
        location_name = {row.get("id", ""): row.get("location_name", "") for row in location_rows}
        for row in location_his_rows:
            if row.get("machine_id") and row.get("location_id") and not row.get("end_time") and row.get("is_deleted", "0") == "0":
                active_map[row["machine_id"]].append(
                    {
                        "location_id": row["location_id"],
                        "location_name": location_name.get(row["location_id"], ""),
                        "start_time": row.get("start_time", ""),
                    }
                )
        relationships.append(
            {
                "relation": "machine_location_his.location_id -> data_location.id",
                "kind": "direct_key",
                "coverage": safe_round(coverage_ratio(location_his_ids, location_ids), 3),
                "observed_source_keys": sorted(location_his_ids),
                "observed_target_rows": len(location_rows),
                "meaning": "Machine locations resolve to the location hierarchy.",
                "active_machine_locations_for_iot_domain": {
                    machine_id: active_map[machine_id]
                    for machine_id in sorted(iot_machine_ids)
                    if machine_id in active_map
                },
            }
        )

    if electric_cabinet_rows and machine_rows:
        machine_name_set = {row.get("machine_name", "") for row in machine_rows if row.get("machine_name")}
        electric_name_set = {row.get("electric_cabinet", "") for row in electric_cabinet_rows if row.get("electric_cabinet")}
        relationships.append(
            {
                "relation": "data_electric_cabinet.electric_cabinet ~= data_machine.machine_name",
                "kind": "soft_name_match",
                "coverage": safe_round(coverage_ratio(electric_name_set, machine_name_set), 3),
                "matched_names": sorted(electric_name_set & machine_name_set)[:12],
                "meaning": "Electric cabinet master often duplicates machine names, so it can enrich the machine domain when exact-name matching is acceptable.",
                "caveat": "This is a name-based bridge, not a stable foreign key.",
            }
        )

    if cabinet_rows and cabinet_kwh_table:
        cabinet_location_ids = {row.get("location_id", "") for row in cabinet_rows if row.get("location_id")}
        relationships.append(
            {
                "relation": "data_cabinetglobal_kwh.cabinetglobal_id -> data_electric_cabinetglobal.id",
                "kind": "direct_key",
                "coverage": safe_round(coverage_ratio(cabinet_kwh_ids, cabinet_ids), 3) if cabinet_kwh_ids else 0.0,
                "observed_source_keys": sorted(cabinet_kwh_ids)[:12],
                "observed_target_rows": len(cabinet_rows),
                "meaning": "Each raw KWH point belongs to a cabinetglobal asset.",
                "caveat": "This relation is validated from the scanned id domain of the raw KWH fact table.",
            }
        )
        relationships.append(
            {
                "relation": "data_electric_cabinetglobal.location_id -> data_location.id",
                "kind": "direct_key",
                "coverage": safe_round(coverage_ratio(cabinet_location_ids, location_ids), 3) if cabinet_location_ids else 0.0,
                "observed_source_keys": sorted(cabinet_location_ids),
                "observed_target_rows": len(location_rows),
                "meaning": "Direct location is mostly empty in current cabinetglobal master export.",
            }
        )

    if cabinet_daily_rows and cabinet_rows:
        daily_cabinet_ids = {row.get("cabinetglobal_id", "") for row in cabinet_daily_rows if row.get("cabinetglobal_id")}
        daily_location_ids = {row.get("location_id", "") for row in cabinet_daily_rows if row.get("location_id")}
        relationships.append(
            {
                "relation": "data_cabinetglobal_kwh_daily.cabinetglobal_id -> data_electric_cabinetglobal.id",
                "kind": "direct_key",
                "coverage": safe_round(coverage_ratio(daily_cabinet_ids, cabinet_ids), 3),
                "observed_source_keys": sorted(daily_cabinet_ids),
                "observed_target_rows": len(cabinet_rows),
                "meaning": "Daily KWH aggregate resolves to cabinetglobal master.",
            }
        )
        relationships.append(
            {
                "relation": "data_cabinetglobal_kwh_daily.location_id -> data_location.id",
                "kind": "direct_key",
                "coverage": safe_round(coverage_ratio(daily_location_ids, location_ids), 3),
                "observed_source_keys": sorted(daily_location_ids),
                "observed_target_rows": len(location_rows),
                "meaning": "Daily KWH already contains the location bridge needed for area-level analysis.",
            }
        )
        if iot_machine_ids:
            relationships.append(
                {
                    "relation": "data_iot_convert <-> data_cabinetglobal_kwh_daily via data_location",
                    "kind": "coarse_bridge",
                    "coverage": safe_round(coverage_ratio(daily_location_ids, {item for item in location_ids if item}), 3),
                    "shared_location_keys": sorted(daily_location_ids & {loc["location_id"] for items in active_map.values() for loc in items}),
                    "meaning": "Operation and energy domains can be aligned at location level, not at machine level, using locations such as CNC Thanh / CNC Ma.",
                    "caveat": "There is no direct machine_id or cabinetglobal_id bridge in the current export.",
                }
            )

    return relationships


def infer_relationships(table_profiles: list[TableProfile]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    master_ids: dict[str, set[str]] = {}
    master_rows: dict[str, int] = {}
    relationships: list[dict[str, Any]] = []
    missing_links: list[dict[str, Any]] = []

    for table in table_profiles:
        id_column = table.get_column("id")
        if id_column and not id_column.distinct_overflow and id_column.distinct_values:
            master_ids[table.file_name] = {clean_text(value) for value in id_column.distinct_values if clean_text(value)}
            master_rows[table.file_name] = table.row_count

    for table in table_profiles:
        for column in table.column_profiles:
            lower = column.name.lower()
            if not lower.endswith("_id") or lower in {"created_user_id", "last_modified_user_id", "organization_id", "user_note_id"}:
                continue

            if not column.distinct_values:
                continue

            best_match: dict[str, Any] | None = None
            sample_values = {clean_text(value) for value in column.distinct_values if clean_text(value)}
            if not sample_values:
                continue

            for master_name, id_values in master_ids.items():
                if master_name == table.file_name:
                    continue
                affinity = name_affinity(column.name, master_name)
                if affinity <= 0:
                    continue
                overlap = len(sample_values & id_values)
                coverage = overlap / max(len(sample_values), 1)
                score = affinity * 0.7 + coverage * 0.3
                candidate = {
                    "source_table": table.file_name,
                    "source_column": column.name,
                    "target_table": master_name,
                    "name_affinity": safe_round(affinity, 3),
                    "sample_overlap_count": overlap,
                    "sample_coverage": safe_round(coverage, 3),
                    "score": safe_round(score, 3),
                }
                if best_match is None or candidate["score"] > best_match["score"]:
                    best_match = candidate

            if best_match and best_match["score"] >= 0.7:
                relationships.append(best_match)
            else:
                missing_links.append(
                    {
                        "source_table": table.file_name,
                        "source_column": column.name,
                        "reason": "No matching exported dimension table found with strong name/value overlap",
                    }
                )

    relationships.sort(key=lambda item: item["score"], reverse=True)
    return relationships, missing_links


def build_overview(table_profiles: list[TableProfile]) -> dict[str, Any]:
    return {
        "table_count": len(table_profiles),
        "total_rows_scanned": sum(table.row_count for table in table_profiles),
        "total_size_bytes": sum(table.size_bytes for table in table_profiles),
        "largest_tables": sorted(
            (
                {
                    "file_name": table.file_name,
                    "row_count": table.row_count,
                    "size_bytes": table.size_bytes,
                    "table_kind": table.table_kind(),
                }
                for table in table_profiles
            ),
            key=lambda item: item["size_bytes"],
            reverse=True,
        )[:8],
    }


def score_energy_anomaly(table_map: dict[str, TableProfile]) -> dict[str, Any]:
    table = table_map.get("data_cabinetglobal_kwh.csv")
    if not table:
        return {"problem": "Energy anomaly detection", "score": 0.0, "readiness": "Low", "status": "Missing core table"}

    asset_col = table.get_column("cabinetglobal_id")
    time_col = table.get_column("iot_time")
    value_col = table.get_column("iot_kwh")
    special = table.special_summary_data

    reasons = []
    score = 0.0

    if table.row_count >= 1_000_000:
        score += 25
        reasons.append("Very large time-series volume for energy measurements")
    elif table.row_count >= 100_000:
        score += 15
        reasons.append("Enough historical rows for time-series modeling")

    if time_col and time_col.datetime_min and time_col.datetime_max:
        span_days = (time_col.datetime_max - time_col.datetime_min).total_seconds() / 86400.0
        if span_days >= 180:
            score += 25
            reasons.append(f"Energy history spans about {safe_round(span_days, 1)} days")
        elif span_days >= 90:
            score += 15
            reasons.append(f"Energy history spans about {safe_round(span_days, 1)} days")

    asset_count = len(asset_col.distinct_values) if asset_col and not asset_col.distinct_overflow else 0
    if asset_count >= 4:
        score += 20
        reasons.append(f"Multiple monitored assets are present ({asset_count} cabinetglobal ids)")
    elif asset_count >= 2:
        score += 10

    if value_col and value_col.numeric_count >= max(1000, int(value_col.non_empty_count * 0.8)):
        score += 15
        reasons.append("Energy reading column is consistently numeric")

    negative_delta_rows = special.get("negative_delta_rows", 0)
    if negative_delta_rows == 0:
        score += 10
        reasons.append("No negative energy jumps detected in scan order")
    else:
        score -= 8
        reasons.append(f"Detected {negative_delta_rows} negative jumps, so counter resets or ordering should be reviewed")

    return {
        "problem": "Energy anomaly detection",
        "score": safe_round(min(score, 100.0), 1),
        "readiness": readiness_label(score),
        "grain": "cabinetglobal_id x timestamp",
        "target": "detect abnormal consumption patterns, flat-lines, spikes, counter resets",
        "required_tables": ["data_cabinetglobal_kwh.csv", "data_electric_cabinetglobal.csv"],
        "reasons": reasons,
        "risks": ["Need business threshold for 'abnormal' and confirmation of cabinet-to-line mapping"],
    }


def score_machine_state_anomaly(table_map: dict[str, TableProfile]) -> dict[str, Any]:
    table = table_map.get("data_iot_convert.csv")
    if not table:
        return {"problem": "Machine operation state anomaly detection", "score": 0.0, "readiness": "Low", "status": "Missing core table"}

    machine_col = table.get_column("machine_id")
    status_col = table.get_column("status_id")
    note_col = table.get_column("note")
    time_col = table.get_column("status_time_start")
    special = table.special_summary_data
    reasons = []
    score = 0.0

    if table.row_count >= 1_000_000:
        score += 30
        reasons.append("Large interval-event history is available")
    elif table.row_count >= 100_000:
        score += 20
        reasons.append("Enough interval-event history for pattern learning")

    machine_count = len(machine_col.distinct_values) if machine_col and not machine_col.distinct_overflow else special.get("machine_count", 0)
    if machine_count >= 8:
        score += 20
        reasons.append(f"Coverage spans {machine_count} machines")
    elif machine_count >= 3:
        score += 12
        reasons.append(f"Coverage spans {machine_count} machines")

    status_count = len(status_col.distinct_values) if status_col and not status_col.distinct_overflow else special.get("status_count", 0)
    if status_count >= 5:
        score += 15
        reasons.append(f"Multiple machine states detected ({status_count} status ids)")

    if note_col and note_col.compound_summary():
        score += 10
        reasons.append("Operational note strings encode machine state semantics")

    if time_col and time_col.datetime_min and time_col.datetime_max:
        span_days = (time_col.datetime_max - time_col.datetime_min).total_seconds() / 86400.0
        if span_days >= 180:
            score += 20
            reasons.append(f"Operation log spans about {safe_round(span_days, 1)} days")
        elif span_days >= 90:
            score += 12

    if table_map.get("data_machine.csv"):
        score += 5
        reasons.append("Machine master data exists for enrichment")

    risks = []
    if "data_machine_status.csv" not in table_map:
        score -= 10
        risks.append("Status dictionary table is not exported, so status_id meaning must be recovered from SQL or app metadata")

    return {
        "problem": "Machine operation state anomaly detection",
        "score": safe_round(min(score, 100.0), 1),
        "readiness": readiness_label(score),
        "grain": "machine_id x status interval",
        "target": "flag abnormal state sequences, excessive idle, unstable ON/OFF behavior",
        "required_tables": ["data_iot_convert.csv", "data_machine.csv"],
        "reasons": reasons,
        "risks": risks or ["Need confirmation of business meaning for each status_id"],
    }


def score_failure_precursor(table_map: dict[str, TableProfile]) -> dict[str, Any]:
    iot_table = table_map.get("data_iot_convert.csv")
    issue_table = table_map.get("data_machine_issue.csv")
    repair_table = table_map.get("data_machine_repair.csv")

    if not iot_table or (not issue_table and not repair_table):
        return {"problem": "Failure precursor / predictive maintenance", "score": 0.0, "readiness": "Low", "status": "Need both operating data and labeled breakdown events"}

    score = 0.0
    reasons = []
    risks = []

    if iot_table.row_count >= 1_000_000:
        score += 20
        reasons.append("Dense machine-state history exists before events")

    label_rows = 0
    overlap_machines = 0
    if issue_table:
        label_rows += issue_table.row_count
        reasons.append(f"Issue log exported with {issue_table.row_count:,} rows")
        issue_machine_col = issue_table.get_column("machine_id")
        iot_machine_col = iot_table.get_column("machine_id")
        if issue_machine_col and iot_machine_col:
            overlap_machines = max(
                overlap_machines,
                len(issue_machine_col.distinct_values & iot_machine_col.distinct_values),
            )
        issue_desc = issue_table.special_summary_data.get("issue_desc_non_empty_rows", 0)
        if issue_desc:
            score += 10
            reasons.append("Issue descriptions can support root-cause context")

    if repair_table:
        label_rows += repair_table.row_count
        reasons.append(f"Repair log exported with {repair_table.row_count:,} rows")
        repair_machine_col = repair_table.get_column("machine_id")
        iot_machine_col = iot_table.get_column("machine_id")
        if repair_machine_col and iot_machine_col:
            overlap_machines = max(
                overlap_machines,
                len(repair_machine_col.distinct_values & iot_machine_col.distinct_values),
            )
        if repair_table.special_summary_data.get("repair_costs", {}).get("count", 0):
            score += 8
            reasons.append("Repair costs are available for impact weighting")

    if label_rows >= 1000:
        score += 20
    elif label_rows >= 100:
        score += 12

    if overlap_machines >= 3:
        score += 15
        reasons.append(f"At least {overlap_machines} machines overlap between operation and event logs")
    elif overlap_machines == 0:
        score -= 15
        risks.append("No clear machine overlap detected between operation logs and incident labels")

    if table_map.get("data_machine_component.csv"):
        score += 5
        reasons.append("Machine component master can support component-level narratives")

    if issue_table and "data_error.csv" in table_map:
        score += 7
        reasons.append("Error taxonomy exists for structured labels")

    if "data_machine_status.csv" not in table_map:
        score -= 8
        risks.append("Missing machine status dictionary limits interpretation of leading indicators")
    if not issue_table or not repair_table:
        risks.append("Only one of issue/repair logs is available, so labels may be incomplete")

    return {
        "problem": "Failure precursor / predictive maintenance",
        "score": safe_round(min(score, 100.0), 1),
        "readiness": readiness_label(score),
        "grain": "machine_id x time window before issue/repair",
        "target": "predict likelihood of incident or repair in the next horizon",
        "required_tables": ["data_iot_convert.csv", "data_machine_issue.csv", "data_machine_repair.csv"],
        "reasons": reasons,
        "risks": risks or ["Need a strict label definition for what counts as a failure event"],
    }


def score_maintenance_compliance(table_map: dict[str, TableProfile]) -> dict[str, Any]:
    history_table = table_map.get("data_machine_maintenance_his.csv")
    maintenance_table = table_map.get("data_maintenance.csv")
    if not history_table or not maintenance_table:
        return {"problem": "Maintenance compliance and delay risk", "score": 0.0, "readiness": "Low", "status": "Need history and maintenance catalog exports"}

    score = 0.0
    reasons = []

    if history_table.row_count >= 1000:
        score += 25
        reasons.append("Maintenance history volume is sufficient for pattern analysis")
    elif history_table.row_count >= 100:
        score += 15

    due_date = history_table.get_column("due_date")
    done_date = history_table.get_column("done_date")
    if due_date and done_date and due_date.datetime_count > 0:
        score += 20
        reasons.append("Both due date and done date exist for SLA / delay analysis")

    status_dist = history_table.special_summary_data.get("maintenance_status_distribution", [])
    if status_dist:
        score += 10
        reasons.append("Maintenance status tracking is present")

    machine_count = history_table.special_summary_data.get("machine_count", 0)
    if machine_count >= 3:
        score += 15
        reasons.append(f"Maintenance records cover {machine_count} machines")

    if maintenance_table.row_count >= 50:
        score += 10
        reasons.append("Maintenance checklist catalog is rich enough to support task-level analytics")

    open_rows = history_table.special_summary_data.get("open_rows_without_done_date", 0)
    if open_rows:
        score += 8
        reasons.append(f"There are {open_rows} planned jobs without done_date, useful for backlog monitoring")

    return {
        "problem": "Maintenance compliance and delay risk",
        "score": safe_round(min(score, 100.0), 1),
        "readiness": readiness_label(score),
        "grain": "maintenance job / machine / due date",
        "target": "predict overdue maintenance, optimize workload, surface repeated late tasks",
        "required_tables": ["data_machine_maintenance_his.csv", "data_maintenance.csv", "data_machine.csv"],
        "reasons": reasons,
        "risks": ["Need meaning of maintenance_status_id and setup_id from application metadata"],
    }


def score_issue_nlp(table_map: dict[str, TableProfile]) -> dict[str, Any]:
    issue_table = table_map.get("data_machine_issue.csv")
    repair_table = table_map.get("data_machine_repair.csv")
    if not issue_table and not repair_table:
        return {"problem": "Issue text clustering and triage assist", "score": 0.0, "readiness": "Low", "status": "Need issue or repair free-text data"}

    score = 0.0
    reasons = []
    total_text_rows = 0

    if issue_table:
        issue_desc = issue_table.special_summary_data.get("issue_desc_non_empty_rows", 0)
        reason_rows = issue_table.special_summary_data.get("reason_non_empty_rows", 0)
        total_text_rows += issue_desc + reason_rows
        if issue_desc >= 100:
            score += 25
            reasons.append(f"Issue descriptions are present in {issue_desc:,} rows")
        elif issue_desc > 0:
            score += 12
        if "data_error.csv" in table_map:
            score += 15
            reasons.append("Structured error taxonomy can be used as weak labels")

    if repair_table:
        repair_desc = repair_table.special_summary_data.get("repair_desc_non_empty_rows", 0)
        total_text_rows += repair_desc
        if repair_desc >= 100:
            score += 20
            reasons.append(f"Repair descriptions are present in {repair_desc:,} rows")
        elif repair_desc > 0:
            score += 8

    if total_text_rows >= 1000:
        score += 20
        reasons.append("Enough text volume for clustering, retrieval, or triage support")
    elif total_text_rows >= 100:
        score += 10

    if "data_error_group.csv" in table_map:
        score += 10
        reasons.append("Error groups provide a clean hierarchy for summarization")

    return {
        "problem": "Issue text clustering and triage assist",
        "score": safe_round(min(score, 100.0), 1),
        "readiness": readiness_label(score),
        "grain": "issue / repair record",
        "target": "cluster similar incidents, suggest error group, retrieve similar fixes",
        "required_tables": ["data_machine_issue.csv", "data_machine_repair.csv", "data_error.csv", "data_error_group.csv"],
        "reasons": reasons,
        "risks": ["Need text cleanup because some notes contain null bytes or placeholders"],
    }


def build_problem_recommendations(table_profiles: list[TableProfile]) -> list[dict[str, Any]]:
    table_map = {table.file_name: table for table in table_profiles}
    problems = [
        score_machine_state_anomaly(table_map),
        score_energy_anomaly(table_map),
        score_failure_precursor(table_map),
        score_maintenance_compliance(table_map),
        score_issue_nlp(table_map),
    ]
    return sorted(problems, key=lambda item: item.get("score", 0), reverse=True)


def detect_key_findings(table_profiles: list[TableProfile], missing_links: list[dict[str, Any]]) -> list[str]:
    findings: list[str] = []
    table_map = {table.file_name: table for table in table_profiles}

    if "data_iot_convert.csv" in table_map:
        table = table_map["data_iot_convert.csv"]
        note_col = table.get_column("note")
        if note_col and note_col.compound_summary():
            findings.append(
                "Column `note` in `data_iot_convert.csv` is not a plain comment field; it encodes machine state components such as ON/OFF, error presence, maintenance state, and current behavior."
            )

    if "data_electric_cabinetglobal.csv" in table_map:
        tag_col = table_map["data_electric_cabinetglobal.csv"].get_column("iot_tagname")
        if tag_col and tag_col.compound_summary():
            findings.append(
                "Column `iot_tagname` in `data_electric_cabinetglobal.csv` behaves like an encoded identifier that can be decomposed into asset code, location, and metric token such as `Kwh`."
            )

    if "data_machine_issue.csv" in table_map:
        issue_desc = table_map["data_machine_issue.csv"].get_column("issue_desc")
        if issue_desc and issue_desc.non_empty_count > 0:
            findings.append(
                "Issue logs contain user-written descriptions, which enables root-cause clustering or retrieval tasks in addition to purely numeric forecasting."
            )

    if any(link["source_column"] == "location_id" for link in missing_links):
        findings.append(
            "Several tables reference `location_id`, but no location dimension export is present, so spatial/contextual analysis is partially blocked."
        )

    if "data_iot_convert.csv" in table_map and "data_machine_status.csv" not in table_map:
        findings.append(
            "The current export includes `status_id` in machine operations but does not include its dictionary table, so any supervised modeling must first recover the business meaning of each status."
        )

    return findings


def render_markdown(
    data_dir: Path,
    overview: dict[str, Any],
    relationships: list[dict[str, Any]],
    focus_relationships: list[dict[str, Any]],
    missing_links: list[dict[str, Any]],
    findings: list[str],
    problem_recommendations: list[dict[str, Any]],
    table_profiles: list[TableProfile],
) -> str:
    lines: list[str] = []
    lines.append("# Weldcom Data Discovery Report")
    lines.append("")
    lines.append(
        f"This report was generated from the exported CSV files in `{data_dir}` using a streaming scan designed for large files."
    )
    lines.append("")
    lines.append("## 1. Portfolio overview")
    lines.append("")
    lines.append(f"- Tables scanned: {overview['table_count']}")
    lines.append(f"- Total rows scanned: {overview['total_rows_scanned']:,}")
    lines.append(f"- Total data size: {overview['total_size_bytes']:,} bytes")
    lines.append("")
    lines.append("Largest tables:")
    for item in overview["largest_tables"]:
        lines.append(
            f"- `{item['file_name']}` | rows={item['row_count']:,} | size={item['size_bytes']:,} bytes | kind={item['table_kind']}"
        )

    lines.append("")
    lines.append("## 2. Key findings")
    lines.append("")
    for finding in findings:
        lines.append(f"- {finding}")

    lines.append("")
    lines.append("## 3. Recommended AI problem ladder")
    lines.append("")
    for problem in problem_recommendations:
        lines.append(
            f"- **{problem['problem']}** | readiness={problem.get('readiness')} | score={problem.get('score')}"
        )
        if "target" in problem:
            lines.append(f"  Target: {problem['target']}")
        if "grain" in problem:
            lines.append(f"  Grain: {problem['grain']}")
        if problem.get("reasons"):
            lines.append(f"  Why now: {'; '.join(problem['reasons'][:4])}")
        if problem.get("risks"):
            lines.append(f"  Watch-outs: {'; '.join(problem['risks'][:3])}")

    lines.append("")
    lines.append("## 4. Inferred relationships")
    lines.append("")
    if relationships:
        for relation in relationships[:25]:
            lines.append(
                f"- `{relation['source_table']}.{relation['source_column']}` -> `{relation['target_table']}.id` | score={relation['score']} | coverage={relation['sample_coverage']}"
            )
    else:
        lines.append("- No strong relationships were inferred from the exported tables.")

    lines.append("")
    lines.append("Likely missing dimensions:")
    for missing in missing_links[:20]:
        lines.append(f"- `{missing['source_table']}.{missing['source_column']}` | {missing['reason']}")

    lines.append("")
    lines.append("## 5. Focus relationship map")
    lines.append("")
    for relation in focus_relationships:
        lines.append(
            f"- **{relation['relation']}** | kind={relation.get('kind')} | coverage={relation.get('coverage')}"
        )
        lines.append(f"  Meaning: {relation.get('meaning')}")
        if relation.get("shared_location_keys"):
            lines.append(f"  Shared locations: {relation['shared_location_keys']}")
        if relation.get("iot_domain_coverage") is not None:
            lines.append(f"  IOT machine coverage: {relation['iot_domain_coverage']}")
        if relation.get("active_machine_locations_for_iot_domain"):
            lines.append(
                f"  Active machine->location map: {json.dumps(relation['active_machine_locations_for_iot_domain'], ensure_ascii=False)}"
            )
        if relation.get("caveat"):
            lines.append(f"  Caveat: {relation['caveat']}")
        if relation.get("note_consistency_on_sample") is not None:
            lines.append(f"  Status note consistency on sample: {relation['note_consistency_on_sample']}")

    lines.append("")
    lines.append("## 6. First 5 rows per table")
    lines.append("")
    for table in table_profiles:
        lines.append(f"### {table.file_name}")
        lines.append("")
        if not table.head_rows:
            lines.append("- No sample rows captured.")
            lines.append("")
            continue
        headers = list(table.head_rows[0].keys())
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("|" + "|".join(["---"] * len(headers)) + "|")
        for row in table.head_rows:
            lines.append("| " + " | ".join(str(row.get(header, "")).replace("\n", " ") for header in headers) + " |")
        lines.append("")

    lines.append("")
    lines.append("## 7. Table details")
    lines.append("")
    for table in table_profiles:
        summary = table.as_dict()
        lines.append(f"### {table.file_name}")
        lines.append("")
        lines.append(
            f"- kind={summary['table_kind']} | rows={summary['row_count']:,} | columns={summary['column_count']} | missing={summary['missing_percent']}% | bad_rows={summary['bad_row_count']}"
        )
        if summary["primary_time_column"]:
            lines.append(
                f"- primary_time={summary['primary_time_column']} | start={summary['time_range']['start']} | end={summary['time_range']['end']}"
            )
        if summary["special_summary"]:
            lines.append(f"- special_summary={json.dumps(summary['special_summary'], ensure_ascii=False)}")
        lines.append("")
        lines.append("| column | role | type | missing% | unique | sample |")
        lines.append("|---|---|---:|---:|---:|---|")
        for column in summary["columns"]:
            sample = ", ".join(column["sample_values"][:2])
            lines.append(
                f"| `{column['name']}` | {column['semantic_role']} | {column['inferred_type']} | {column['missing_percent']} | {column['unique_count']} | {sample} |"
            )
        lines.append("")

    return "\n".join(lines)


def write_outputs(
    data_dir: Path,
    overview: dict[str, Any],
    relationships: list[dict[str, Any]],
    focus_relationships: list[dict[str, Any]],
    missing_links: list[dict[str, Any]],
    findings: list[str],
    problem_recommendations: list[dict[str, Any]],
    table_profiles: list[TableProfile],
) -> tuple[Path, Path]:
    report_payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "data_dir": str(data_dir),
        "overview": overview,
        "key_findings": findings,
        "problem_recommendations": problem_recommendations,
        "relationships": relationships,
        "focus_relationships": focus_relationships,
        "missing_links": missing_links,
        "tables": [table.as_dict() for table in table_profiles],
    }

    json_path = data_dir / "discover_report.json"
    markdown_path = data_dir / "discover_report.md"

    json_path.write_text(json.dumps(report_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    markdown_path.write_text(
        render_markdown(
            data_dir=data_dir,
            overview=overview,
            relationships=relationships,
            focus_relationships=focus_relationships,
            missing_links=missing_links,
            findings=findings,
            problem_recommendations=problem_recommendations,
            table_profiles=table_profiles,
        ),
        encoding="utf-8",
    )

    return json_path, markdown_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Deep discovery for Weldcom exported CSV data.")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="Directory that contains the exported CSV files.",
    )
    parser.add_argument(
        "--only-files",
        nargs="*",
        default=None,
        help="Optional list of CSV file names to scan instead of scanning the whole folder.",
    )
    args = parser.parse_args()

    data_dir = args.data_dir.resolve()
    only_files = set(args.only_files) if args.only_files else None
    discovery = WeldcomDiscovery(data_dir, only_files=only_files)
    table_profiles = discovery.run()
    relationships, missing_links = infer_relationships(table_profiles)
    focus_relationships = build_focus_relationships(data_dir, table_profiles)
    overview = build_overview(table_profiles)
    findings = detect_key_findings(table_profiles, missing_links)
    problem_recommendations = build_problem_recommendations(table_profiles)
    json_path, markdown_path = write_outputs(
        data_dir=data_dir,
        overview=overview,
        relationships=relationships,
        focus_relationships=focus_relationships,
        missing_links=missing_links,
        findings=findings,
        problem_recommendations=problem_recommendations,
        table_profiles=table_profiles,
    )

    print("")
    print("[done] Discovery outputs generated:")
    print(f"  - JSON: {json_path}")
    print(f"  - Markdown: {markdown_path}")
    print("")
    print("[top recommendations]")
    for problem in problem_recommendations[:5]:
        print(f"  - {problem['problem']}: score={problem.get('score')} readiness={problem.get('readiness')}")


if __name__ == "__main__":
    main()
