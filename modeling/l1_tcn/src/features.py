from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Tuple, Any
import json

import numpy as np
import pandas as pd


@dataclass
class FeatureSpec:
    id_columns: List[str]
    categorical_columns: List[str]
    continuous_columns: List[str]
    binary_columns: List[str]
    leakage_or_trace_columns: List[str]

    @property
    def model_columns(self) -> List[str]:
        return self.categorical_columns + self.continuous_columns + self.binary_columns

    @property
    def read_columns(self) -> List[str]:
        seen = []
        for c in self.id_columns + self.model_columns:
            if c not in seen:
                seen.append(c)
        return seen


@dataclass
class ContinuousStats:
    median: float
    iqr: float
    mean: float
    std: float
    null_count: int
    count: int


def signed_log1p_array(x: np.ndarray) -> np.ndarray:
    return np.sign(x) * np.log1p(np.abs(x))


class L1FeaturePreprocessor:
    """Feature preprocessing cho L1 TCN Autoencoder.

    - Categorical: map train values -> integer id, unknown/missing -> 0.
    - Continuous: signed_log1p + robust median/IQR scaling + clipping.
    - Binary: ép về float32 0/1.
    - Không dùng machine_id làm feature để tránh học vẹt ID máy.
    """

    def __init__(
        self,
        spec: FeatureSpec,
        continuous_transform: str = 'signed_log1p',
        robust_scaler: bool = True,
        clip_z: float = 8.0,
        missing_category_value: int = 0,
        unknown_category_value: int = 0,
    ) -> None:
        self.spec = spec
        self.continuous_transform = continuous_transform
        self.robust_scaler = robust_scaler
        self.clip_z = float(clip_z)
        self.missing_category_value = int(missing_category_value)
        self.unknown_category_value = int(unknown_category_value)
        self.category_maps: Dict[str, Dict[str, int]] = {}
        self.category_cardinalities: Dict[str, int] = {}
        self.continuous_stats: Dict[str, ContinuousStats] = {}
        self.fitted = False

    @staticmethod
    def from_config(cfg: Dict[str, Any]) -> 'L1FeaturePreprocessor':
        data_cfg = cfg.get('data', {})
        pp_cfg = cfg.get('preprocess', {})
        spec = FeatureSpec(
            id_columns=list(data_cfg.get('id_columns', [])),
            categorical_columns=list(data_cfg.get('categorical_columns', [])),
            continuous_columns=list(data_cfg.get('continuous_columns', [])),
            binary_columns=list(data_cfg.get('binary_columns', [])),
            leakage_or_trace_columns=list(data_cfg.get('leakage_or_trace_columns', [])),
        )
        return L1FeaturePreprocessor(
            spec=spec,
            continuous_transform=pp_cfg.get('continuous_transform', 'signed_log1p'),
            robust_scaler=bool(pp_cfg.get('robust_scaler', True)),
            clip_z=float(pp_cfg.get('clip_z', 8.0)),
            missing_category_value=int(pp_cfg.get('missing_category_value', 0)),
            unknown_category_value=int(pp_cfg.get('unknown_category_value', 0)),
        )

    def validate_columns(self, columns: List[str], strict: bool = True) -> Tuple[List[str], List[str]]:
        available = set(columns)
        required = set(self.spec.read_columns)
        missing = sorted(required - available)
        extra = sorted(available - required)
        if strict and missing:
            raise ValueError(f'Missing required columns: {missing}')
        return missing, extra

    @staticmethod
    def _clean_numeric_series(s: pd.Series) -> pd.Series:
        if pd.api.types.is_numeric_dtype(s):
            return pd.to_numeric(s, errors='coerce')
        return pd.to_numeric(
            s.astype(str).str.strip().str.replace('\u00a0', '', regex=False).str.replace(',', '.', regex=False)
             .replace({'': None, 'NULL': None, 'None': None, 'nan': None}),
            errors='coerce',
        )

    def _transform_continuous_raw(self, arr: np.ndarray) -> np.ndarray:
        arr = arr.astype('float64', copy=False)
        if self.continuous_transform == 'signed_log1p':
            return signed_log1p_array(arr)
        if self.continuous_transform == 'log1p_nonnegative':
            return np.log1p(np.maximum(arr, 0.0))
        if self.continuous_transform in {'none', None}:
            return arr
        raise ValueError(f'Unsupported continuous_transform: {self.continuous_transform}')

    def fit(self, df: pd.DataFrame) -> 'L1FeaturePreprocessor':
        self.validate_columns(list(df.columns), strict=True)
        for col in self.spec.categorical_columns:
            s = df[col].where(~df[col].isna(), '__MISSING__').astype(str)
            values = sorted(s.unique().tolist())
            mapping: Dict[str, int] = {}
            next_id = 1
            for v in values:
                if v == '__MISSING__':
                    continue
                mapping[v] = next_id
                next_id += 1
            self.category_maps[col] = mapping
            self.category_cardinalities[col] = next_id

        for col in self.spec.continuous_columns:
            raw = self._clean_numeric_series(df[col])
            null_count = int(raw.isna().sum())
            x = self._transform_continuous_raw(raw.fillna(0.0).to_numpy(dtype='float64'))
            if x.size == 0:
                stats = ContinuousStats(0.0, 1.0, 0.0, 1.0, null_count, 0)
            else:
                q25, q50, q75 = np.nanpercentile(x, [25, 50, 75])
                iqr = float(q75 - q25)
                if not np.isfinite(iqr) or iqr < 1e-6:
                    iqr = 1.0
                std = float(np.nanstd(x))
                if not np.isfinite(std) or std < 1e-6:
                    std = 1.0
                stats = ContinuousStats(float(q50), iqr, float(np.nanmean(x)), std, null_count, int(x.size))
            self.continuous_stats[col] = stats
        self.fitted = True
        return self

    def transform_categorical(self, df: pd.DataFrame) -> np.ndarray:
        if not self.fitted:
            raise RuntimeError('Preprocessor is not fitted.')
        arrays = []
        for col in self.spec.categorical_columns:
            mapping = self.category_maps[col]
            s = df[col].where(~df[col].isna(), '__MISSING__').astype(str)
            mapped = s.map(mapping).fillna(self.unknown_category_value).astype('int64')
            arrays.append(mapped.to_numpy())
        if not arrays:
            return np.empty((len(df), 0), dtype=np.int64)
        return np.stack(arrays, axis=1).astype(np.int64, copy=False)

    def transform_continuous(self, df: pd.DataFrame) -> np.ndarray:
        if not self.fitted:
            raise RuntimeError('Preprocessor is not fitted.')
        arrays = []
        for col in self.spec.continuous_columns:
            raw = self._clean_numeric_series(df[col]).fillna(0.0).to_numpy(dtype='float64')
            x = self._transform_continuous_raw(raw)
            stats = self.continuous_stats[col]
            x = (x - stats.median) / stats.iqr if self.robust_scaler else (x - stats.mean) / stats.std
            if self.clip_z is not None and self.clip_z > 0:
                x = np.clip(x, -self.clip_z, self.clip_z)
            arrays.append(x.astype('float32'))
        for col in self.spec.binary_columns:
            if col not in df.columns:
                x = np.zeros(len(df), dtype='float32')
            else:
                x = self._clean_numeric_series(df[col]).fillna(0.0)
                x = (x > 0).astype('float32').to_numpy()
            arrays.append(x)
        if not arrays:
            return np.empty((len(df), 0), dtype=np.float32)
        return np.stack(arrays, axis=1).astype(np.float32, copy=False)

    def transform(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        return self.transform_categorical(df), self.transform_continuous(df)

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            'spec': asdict(self.spec),
            'continuous_transform': self.continuous_transform,
            'robust_scaler': self.robust_scaler,
            'clip_z': self.clip_z,
            'missing_category_value': self.missing_category_value,
            'unknown_category_value': self.unknown_category_value,
            'category_maps': self.category_maps,
            'category_cardinalities': self.category_cardinalities,
            'continuous_stats': {k: asdict(v) for k, v in self.continuous_stats.items()},
            'fitted': self.fitted,
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')

    @classmethod
    def load(cls, path: str | Path) -> 'L1FeaturePreprocessor':
        payload = json.loads(Path(path).read_text(encoding='utf-8'))
        spec = FeatureSpec(**payload['spec'])
        obj = cls(spec, payload['continuous_transform'], payload['robust_scaler'], payload['clip_z'], payload['missing_category_value'], payload['unknown_category_value'])
        obj.category_maps = payload['category_maps']
        obj.category_cardinalities = {k: int(v) for k, v in payload['category_cardinalities'].items()}
        obj.continuous_stats = {k: ContinuousStats(**v) for k, v in payload['continuous_stats'].items()}
        obj.fitted = bool(payload['fitted'])
        return obj

    @property
    def continuous_dim(self) -> int:
        return len(self.spec.continuous_columns) + len(self.spec.binary_columns)

    @property
    def categorical_dim(self) -> int:
        return len(self.spec.categorical_columns)

    def summary(self) -> Dict[str, Any]:
        return {
            'categorical_columns': self.spec.categorical_columns,
            'continuous_columns': self.spec.continuous_columns,
            'binary_columns': self.spec.binary_columns,
            'continuous_dim': self.continuous_dim,
            'categorical_dim': self.categorical_dim,
            'category_cardinalities': self.category_cardinalities,
        }
