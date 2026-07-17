from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple, Any, Dict

import numpy as np
import pandas as pd

try:
    import torch
    from torch.utils.data import Dataset
except Exception:
    torch = None
    Dataset = object

from features import L1FeaturePreprocessor


@dataclass
class WindowBuildResult:
    window_end_indices: np.ndarray
    window_size: int
    row_count: int
    window_count: int
    segment_count: int


def read_l1_csv(path: str | Path, columns: List[str], sep: str = ',', encoding: str = 'utf-8-sig') -> pd.DataFrame:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(path)
    if path.is_dir():
        files = sorted(path.glob('machine_id=*/events.parquet'))
        if not files:
            raise FileNotFoundError(f'No machine Parquet partitions under {path}')
        try:
            import duckdb
            selected = ', '.join('"' + c.replace('"', '""') + '"' for c in columns)
            glob = str(path / 'machine_id=*' / 'events.parquet').replace("'", "''")
            return duckdb.sql(f"SELECT {selected} FROM read_parquet('{glob}')").df()
        except Exception:
            return pd.concat([pd.read_parquet(file, columns=columns) for file in files], ignore_index=True)
    if path.suffix.lower() in {'.parquet', '.pq'}:
        try:
            df = pd.read_parquet(path, columns=columns)
        except Exception:
            import duckdb
            selected = ', '.join('"' + c.replace('"', '""') + '"' for c in columns)
            escaped = str(path).replace("'", "''")
            df = duckdb.sql(f"SELECT {selected} FROM read_parquet('{escaped}')").df()
        missing = [c for c in columns if c not in df.columns]
        if missing:
            raise ValueError(f'Missing columns in {path.name}: {missing}')
        return df
    header = list(pd.read_csv(path, sep=sep, encoding=encoding, nrows=0).columns)
    missing = [c for c in columns if c not in header]
    if missing:
        raise ValueError(f'Missing columns in {path.name}: {missing}')
    return pd.read_csv(path, sep=sep, encoding=encoding, usecols=columns, low_memory=False)


def sort_l1_frame(df: pd.DataFrame) -> pd.DataFrame:
    sort_cols = ['machine_id', 'sequence_segment_id', 'event_order_in_segment']
    missing = [c for c in sort_cols if c not in df.columns]
    if missing:
        raise ValueError(f'Missing sort columns: {missing}')
    return df.sort_values(sort_cols, kind='mergesort').reset_index(drop=True)


def build_window_end_indices(
    df: pd.DataFrame,
    window_size: int,
    stride: int = 1,
    max_windows: Optional[int] = None,
    random_seed: int = 42,
) -> WindowBuildResult:
    if window_size <= 0:
        raise ValueError('window_size must be positive')
    if stride <= 0:
        raise ValueError('stride must be positive')
    required = ['machine_id', 'sequence_segment_id']
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f'Missing columns for windowing: {missing}')

    ends = []
    segment_count = 0
    for _, g in df.groupby(['machine_id', 'sequence_segment_id'], sort=False):
        n = len(g)
        segment_count += 1
        if n < window_size:
            continue
        idx = g.index.to_numpy()
        end_positions = np.arange(window_size - 1, n, stride, dtype=np.int64)
        ends.append(idx[end_positions])
    window_end_indices = np.concatenate(ends).astype(np.int64, copy=False) if ends else np.empty((0,), dtype=np.int64)

    if max_windows is not None and max_windows > 0 and len(window_end_indices) > max_windows:
        rng = np.random.default_rng(random_seed)
        sampled = rng.choice(window_end_indices, size=max_windows, replace=False)
        window_end_indices = np.sort(sampled).astype(np.int64, copy=False)

    return WindowBuildResult(window_end_indices, window_size, len(df), len(window_end_indices), segment_count)


class L1WindowDataset(Dataset):
    def __init__(self, cat_array: np.ndarray, cont_array: np.ndarray, event_ids: np.ndarray, machine_ids: np.ndarray, window_end_indices: np.ndarray, window_size: int) -> None:
        if torch is None:
            raise RuntimeError('torch is required for L1WindowDataset')
        self.cat_array = cat_array.astype(np.int64, copy=False)
        self.cont_array = cont_array.astype(np.float32, copy=False)
        self.event_ids = event_ids.astype(np.int64, copy=False)
        self.machine_ids = machine_ids.astype(np.int64, copy=False)
        self.window_end_indices = window_end_indices.astype(np.int64, copy=False)
        self.window_size = int(window_size)
        if len(self.cat_array) != len(self.cont_array):
            raise ValueError('cat_array and cont_array length mismatch')
        if len(self.event_ids) != len(self.cont_array):
            raise ValueError('event_ids length mismatch')

    def __len__(self) -> int:
        return len(self.window_end_indices)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        end = int(self.window_end_indices[idx])
        start = end - self.window_size + 1
        cat = self.cat_array[start:end + 1]
        cont = self.cont_array[start:end + 1]
        return {
            'cat': torch.from_numpy(cat),
            'cont': torch.from_numpy(cont),
            'event_id': torch.tensor(int(self.event_ids[end]), dtype=torch.long),
            'machine_id': torch.tensor(int(self.machine_ids[end]), dtype=torch.long),
            'end_index': torch.tensor(end, dtype=torch.long),
        }


def load_dataset_from_csv(
    csv_path: str | Path,
    preprocessor: L1FeaturePreprocessor,
    window_size: int,
    stride: int,
    sep: str = ',',
    encoding: str = 'utf-8-sig',
    fit_preprocessor: bool = False,
    max_windows: Optional[int] = None,
    random_seed: int = 42,
) -> Tuple[L1WindowDataset, pd.DataFrame, WindowBuildResult]:
    df = read_l1_csv(csv_path, preprocessor.spec.read_columns, sep=sep, encoding=encoding)
    df = sort_l1_frame(df)
    if fit_preprocessor:
        preprocessor.fit(df)
    cat, cont = preprocessor.transform(df)
    event_ids = pd.to_numeric(df['event_id'], errors='coerce').fillna(-1).astype('int64').to_numpy()
    machine_ids = pd.to_numeric(df['machine_id'], errors='coerce').fillna(-1).astype('int64').to_numpy()
    wb = build_window_end_indices(df, window_size, stride, max_windows=max_windows, random_seed=random_seed)
    dataset = L1WindowDataset(cat, cont, event_ids, machine_ids, wb.window_end_indices, window_size)
    return dataset, df, wb
