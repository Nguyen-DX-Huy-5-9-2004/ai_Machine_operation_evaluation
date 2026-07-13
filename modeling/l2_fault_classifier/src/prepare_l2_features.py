from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd
import yaml


# ============================================================
# 1. Utilities
# ============================================================


def load_yaml(path: str | Path) -> Dict[str, Any]:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(path)
    with path.open('r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f'Invalid YAML: {path}')
    return data


def save_json(obj: Dict[str, Any], path: str | Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, default=str), encoding='utf-8')


def resolve_path(raw: str | Path, config_path: str | Path) -> Path:
    raw = Path(raw)
    if raw.is_absolute():
        return raw
    return (Path(config_path).resolve().parent / raw).resolve()


def get_cfg(cfg: Dict[str, Any], dotted: str, default: Any = None) -> Any:
    cur: Any = cfg
    for part in dotted.split('.'):
        if not isinstance(cur, dict) or part not in cur:
            return default
        cur = cur[part]
    return cur


def read_header(path: Path, sep: str, encoding: str) -> List[str]:
    return list(pd.read_csv(path, sep=sep, encoding=encoding, nrows=0).columns)


def ensure_required(path: Path, required: Iterable[str], sep: str, encoding: str) -> None:
    header = set(read_header(path, sep, encoding))
    missing = [c for c in required if c not in header]
    if missing:
        raise ValueError(f'Missing required columns in {path}: {missing}')


def as_numeric(s: pd.Series, fill: Optional[float] = None) -> pd.Series:
    out = pd.to_numeric(s, errors='coerce')
    if fill is not None:
        out = out.fillna(fill)
    return out


# ============================================================
# 2. Fit train-only clipping stats
# ============================================================


def fit_l1_clip_stats(train_path: Path, cfg: Dict[str, Any], sep: str, encoding: str) -> Dict[str, Any]:
    source_cols = list(get_cfg(cfg, 'l1_stabilization.source_score_columns', []))
    header = set(read_header(train_path, sep, encoding))
    source_cols = [c for c in source_cols if c in header]

    if not source_cols:
        raise ValueError('No L1 score columns found for stabilization.')

    print(f'Fit train-only clipping stats from: {train_path}')
    train_scores = pd.read_csv(
        train_path,
        sep=sep,
        encoding=encoding,
        usecols=source_cols,
        low_memory=False,
    )

    q_low = float(get_cfg(cfg, 'l1_stabilization.clip_lower_quantile', 0.0))
    q_high = float(get_cfg(cfg, 'l1_stabilization.clip_upper_quantile', 0.999))
    min_upper = float(get_cfg(cfg, 'l1_stabilization.min_upper_clip', 1.0))

    stats: Dict[str, Any] = {
        'fit_source': str(train_path),
        'clip_lower_quantile': q_low,
        'clip_upper_quantile': q_high,
        'columns': {},
    }

    for c in source_cols:
        s = pd.to_numeric(train_scores[c], errors='coerce')
        non_null = s.dropna()
        if len(non_null) == 0:
            lower = 0.0
            upper = min_upper
        else:
            lower = float(non_null.quantile(q_low))
            upper = float(non_null.quantile(q_high))
            upper = max(upper, min_upper)
            lower = min(lower, upper)

        stats['columns'][c] = {
            'lower': lower,
            'upper': upper,
            'missing_count': int(s.isna().sum()),
            'mean': float(s.mean()) if len(non_null) else None,
            'p50': float(non_null.quantile(0.50)) if len(non_null) else None,
            'p95': float(non_null.quantile(0.95)) if len(non_null) else None,
            'p99': float(non_null.quantile(0.99)) if len(non_null) else None,
            'p999': float(non_null.quantile(0.999)) if len(non_null) else None,
            'max': float(non_null.max()) if len(non_null) else None,
        }

    return stats


# ============================================================
# 3. Transform features
# ============================================================


def clip_series(s: pd.Series, stats: Dict[str, Any], col: str) -> pd.Series:
    x = pd.to_numeric(s, errors='coerce').fillna(0.0)
    col_stats = stats['columns'].get(col)
    if col_stats is None:
        return x
    return x.clip(lower=float(col_stats['lower']), upper=float(col_stats['upper']))


def add_l1_stabilized_features(df: pd.DataFrame, clip_stats: Dict[str, Any]) -> pd.DataFrame:
    out = df.copy()
    eps = 1e-6

    # Base clipped/log features.
    mapping = {
        'score_lenient_norm': 'l1_lenient_norm',
        'score_strict_norm': 'l1_strict_norm',
        'behavior_anomaly_score': 'l1_behavior_anomaly_score',
        'behavior_sensitive_score': 'l1_behavior_sensitive_score',
        'behavior_combined_score': 'l1_behavior_combined_score',
        'score_lenient': 'l1_score_lenient',
        'score_strict': 'l1_score_strict',
    }

    for src, prefix in mapping.items():
        if src not in out.columns:
            out[f'{prefix}_clip'] = 0.0
            out[f'{prefix}_log'] = 0.0
            continue
        clipped = clip_series(out[src], clip_stats, src)
        clipped = clipped.clip(lower=0.0)
        out[f'{prefix}_clip'] = clipped.astype('float32')
        out[f'{prefix}_log'] = np.log1p(clipped).astype('float32')

    # Gap and ratio: strict signal after stabilization, not raw boolean.
    strict_log = out.get('l1_strict_norm_log', pd.Series(0.0, index=out.index)).astype(float)
    lenient_log = out.get('l1_lenient_norm_log', pd.Series(0.0, index=out.index)).astype(float)
    strict_clip = out.get('l1_strict_norm_clip', pd.Series(0.0, index=out.index)).astype(float)
    lenient_clip = out.get('l1_lenient_norm_clip', pd.Series(0.0, index=out.index)).astype(float)

    out['l1_strict_lenient_gap_log'] = (strict_log - lenient_log).astype('float32')
    out['l1_strict_lenient_ratio_log'] = np.log1p(strict_clip / (lenient_clip + eps)).astype('float32')
    out['l1_score_balance_index'] = ((strict_log - lenient_log) / (strict_log + lenient_log + eps)).astype('float32')

    # Stable lenient flags from production model.
    if 'is_behavior_anomaly' in out.columns:
        out['l1_behavior_anomaly_flag'] = pd.to_numeric(out['is_behavior_anomaly'], errors='coerce').fillna(0).astype('int8')
    else:
        out['l1_behavior_anomaly_flag'] = 0

    if 'l1_score_available_flag' in out.columns:
        out['l1_score_available_flag'] = pd.to_numeric(out['l1_score_available_flag'], errors='coerce').fillna(0).astype('int8')
    else:
        out['l1_score_available_flag'] = 0

    if 'l1_join_missing_flag' in out.columns:
        out['l1_join_missing_flag'] = pd.to_numeric(out['l1_join_missing_flag'], errors='coerce').fillna(0).astype('int8')
    else:
        out['l1_join_missing_flag'] = 0

    # Raw strict booleans are kept in dataset for ablation, but not in safe/default feature profile.
    for c in ['is_sensitive_warning', 'is_anomaly_strict', 'behavior_reason_code', 'action_level_l1_code']:
        if c in out.columns:
            out[c] = pd.to_numeric(out[c], errors='coerce').fillna(0).astype('int16')

    return out


# ============================================================
# 4. Streaming split preparation and reports
# ============================================================


def prepare_one_split(split: str, input_path: Path, output_path: Path, cfg: Dict[str, Any], clip_stats: Dict[str, Any]) -> Dict[str, Any]:
    sep = str(get_cfg(cfg, 'data.sep', ','))
    encoding = str(get_cfg(cfg, 'data.encoding', 'utf-8-sig'))
    out_sep = str(get_cfg(cfg, 'data.output_sep', ','))
    out_encoding = str(get_cfg(cfg, 'data.output_encoding', 'utf-8-sig'))
    chunksize = int(get_cfg(cfg, 'data.chunksize', 250000))

    if not input_path.exists():
        raise FileNotFoundError(input_path)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    print(f'\n[{split}] Prepare: {input_path}')
    print(f'[{split}] Output : {output_path}')

    rows = 0
    chunk_count = 0
    first = True

    # Summary accumulators.
    sum_cols = [
        'is_behavior_anomaly', 'is_sensitive_warning',
        'l1_behavior_anomaly_score_log', 'l1_behavior_sensitive_score_log',
        'l1_behavior_combined_score_log', 'l1_strict_lenient_gap_log',
        'l1_score_balance_index', 'l1_score_available_flag', 'l1_join_missing_flag',
    ]
    sums = {c: 0.0 for c in sum_cols}
    non_nulls = {c: 0 for c in sum_cols}

    for chunk in pd.read_csv(input_path, sep=sep, encoding=encoding, low_memory=False, chunksize=chunksize):
        chunk_count += 1
        transformed = add_l1_stabilized_features(chunk, clip_stats)
        rows += len(transformed)

        for c in sum_cols:
            if c in transformed.columns:
                s = pd.to_numeric(transformed[c], errors='coerce')
                sums[c] += float(s.sum(skipna=True))
                non_nulls[c] += int(s.notna().sum())

        transformed.to_csv(
            output_path,
            sep=out_sep,
            encoding=out_encoding,
            index=False,
            mode='w' if first else 'a',
            header=first,
        )
        first = False

        print(f'[{split}] chunk={chunk_count}, rows_written={rows:,}')

    means = {f'{c}_mean': (sums[c] / non_nulls[c] if non_nulls[c] else None) for c in sum_cols}
    summary = {
        'split': split,
        'input_path': str(input_path),
        'output_path': str(output_path),
        'rows': int(rows),
        'chunks': int(chunk_count),
        **means,
    }
    return summary


def read_sample_for_dtypes(path: Path, sep: str, encoding: str, nrows: int = 200000) -> pd.DataFrame:
    return pd.read_csv(path, sep=sep, encoding=encoding, low_memory=False, nrows=nrows)


def build_feature_policy(prepared_train_path: Path, cfg: Dict[str, Any], sep: str, encoding: str) -> Dict[str, Any]:
    sample = read_sample_for_dtypes(prepared_train_path, sep, encoding, nrows=200000)

    id_cols = [c for c in list(get_cfg(cfg, 'columns.id_columns', [])) if c in sample.columns]
    targets = [c for c in list(get_cfg(cfg, 'columns.target_columns', [])) if c in sample.columns]
    leakage = [c for c in list(get_cfg(cfg, 'columns.leakage_columns', [])) if c in sample.columns]
    text_audit = [c for c in list(get_cfg(cfg, 'columns.text_or_audit_columns', [])) if c in sample.columns]

    unstable_raw = [c for c in list(get_cfg(cfg, 'l1_stabilization.unstable_strict_raw_columns', [])) if c in sample.columns]

    # Raw L1 columns that are kept for audit but excluded from native auto feature pool.
    raw_l1_exclude_from_native = set([
        'score_lenient', 'score_strict', 'score_lenient_norm', 'score_strict_norm',
        'threshold_lenient', 'threshold_strict',
        'behavior_anomaly_score', 'behavior_sensitive_score', 'behavior_combined_score',
        'is_anomaly_lenient', 'is_anomaly_strict', 'is_behavior_anomaly', 'is_sensitive_warning',
        'behavior_reason_code', 'action_level_l1_code',
    ])

    forbidden_base = set(id_cols + targets + leakage + text_audit)

    native_numeric = []
    for c in sample.columns:
        if c in forbidden_base or c in raw_l1_exclude_from_native:
            continue
        if c.startswith('l1_'):
            continue
        if pd.api.types.is_numeric_dtype(sample[c]):
            native_numeric.append(c)

    l1_safe = [c for c in [
        'l1_lenient_norm_clip', 'l1_lenient_norm_log',
        'l1_behavior_anomaly_score_clip', 'l1_behavior_anomaly_score_log',
        'l1_score_lenient_clip', 'l1_score_lenient_log',
        'l1_behavior_anomaly_flag', 'l1_score_available_flag', 'l1_join_missing_flag',
        # keep original stable production values too, useful for tree models
        'score_lenient_norm', 'behavior_anomaly_score', 'is_behavior_anomaly',
    ] if c in sample.columns]

    strict_cont = [c for c in [
        'l1_strict_norm_clip', 'l1_strict_norm_log',
        'l1_behavior_sensitive_score_clip', 'l1_behavior_sensitive_score_log',
        'l1_behavior_combined_score_clip', 'l1_behavior_combined_score_log',
        'l1_score_strict_clip', 'l1_score_strict_log',
        'l1_strict_lenient_gap_log', 'l1_strict_lenient_ratio_log', 'l1_score_balance_index',
    ] if c in sample.columns]

    strict_raw_experimental = [c for c in unstable_raw if c in sample.columns]

    safe_profile = sorted(dict.fromkeys(native_numeric + l1_safe))
    strict_continuous_profile = sorted(dict.fromkeys(safe_profile + strict_cont))
    full_experimental_profile = sorted(dict.fromkeys(strict_continuous_profile + strict_raw_experimental))

    all_numeric = [c for c in sample.columns if pd.api.types.is_numeric_dtype(sample[c])]

    policy = {
        'dataset_version': get_cfg(cfg, 'project.prepared_dataset_version', 'l2_ready_v1'),
        'id_columns': id_cols,
        'target_columns': targets,
        'leakage_columns': leakage,
        'text_or_audit_columns': text_audit,
        'unstable_strict_raw_columns': unstable_raw,
        'native_numeric_features': native_numeric,
        'l1_safe_features': l1_safe,
        'l1_strict_continuous_stabilized_features': strict_cont,
        'l1_strict_raw_experimental_features': strict_raw_experimental,
        'feature_profiles': {
            'safe': safe_profile,
            'strict_continuous': strict_continuous_profile,
            'full_experimental': full_experimental_profile,
        },
        'profile_sizes': {
            'safe': len(safe_profile),
            'strict_continuous': len(strict_continuous_profile),
            'full_experimental': len(full_experimental_profile),
        },
        'all_numeric_columns_observed_in_sample': all_numeric,
        'forbidden_as_feature': sorted(forbidden_base),
        'notes': [
            'safe profile is recommended first production baseline.',
            'strict_continuous keeps strict score only after train-fitted clipping and log transform.',
            'full_experimental includes raw strict boolean/coded features only for ablation, not default production.',
            'All clipping thresholds are fitted on train split only and applied unchanged to valid/test.',
        ],
    }
    return policy


def target_and_signal_report(path: Path, split: str, cfg: Dict[str, Any], sep: str, encoding: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
    targets = list(get_cfg(cfg, 'columns.target_columns', []))
    feature_cols = [
        'l1_behavior_anomaly_score_log',
        'l1_behavior_sensitive_score_log',
        'l1_behavior_combined_score_log',
        'l1_strict_lenient_gap_log',
        'l1_score_balance_index',
        'is_behavior_anomaly',
        'is_sensitive_warning',
    ]

    header = set(read_header(path, sep, encoding))
    usecols = [c for c in targets + feature_cols if c in header]
    df = pd.read_csv(path, sep=sep, encoding=encoding, usecols=usecols, low_memory=False)

    target_rows = []
    signal_rows = []
    n = len(df)

    for t in targets:
        if t not in df.columns:
            continue
        y = pd.to_numeric(df[t], errors='coerce').fillna(0) > 0
        pos = int(y.sum())
        target_rows.append({
            'split': split,
            'target': t,
            'rows': int(n),
            'positive_count': pos,
            'positive_pct': float(pos / n) if n else 0.0,
            'negative_or_null_count': int(n - pos),
        })

        for group_name, mask in [('target_negative', ~y), ('target_positive', y)]:
            g = df.loc[mask]
            row: Dict[str, Any] = {'split': split, 'target': t, 'group': group_name, 'rows': int(len(g))}
            for c in feature_cols:
                if c in g.columns:
                    s = pd.to_numeric(g[c], errors='coerce')
                    row[f'{c}_mean'] = float(s.mean()) if len(s) else None
                    row[f'{c}_p95'] = float(s.quantile(0.95)) if len(s) else None
                    row[f'{c}_p99'] = float(s.quantile(0.99)) if len(s) else None
            signal_rows.append(row)

    return pd.DataFrame(target_rows), pd.DataFrame(signal_rows)


# ============================================================
# 5. Main
# ============================================================


def run_prepare(config_path: str) -> int:
    cfg = load_yaml(config_path)
    sep = str(get_cfg(cfg, 'data.sep', ','))
    encoding = str(get_cfg(cfg, 'data.encoding', 'utf-8-sig'))
    out_sep = str(get_cfg(cfg, 'data.output_sep', ','))
    out_encoding = str(get_cfg(cfg, 'data.output_encoding', 'utf-8-sig'))

    train_in = resolve_path(get_cfg(cfg, 'paths.input.train'), config_path)
    valid_in = resolve_path(get_cfg(cfg, 'paths.input.valid'), config_path)
    test_in = resolve_path(get_cfg(cfg, 'paths.input.test'), config_path)

    train_out = resolve_path(get_cfg(cfg, 'paths.output.train'), config_path)
    valid_out = resolve_path(get_cfg(cfg, 'paths.output.valid'), config_path)
    test_out = resolve_path(get_cfg(cfg, 'paths.output.test'), config_path)
    report_dir = resolve_path(get_cfg(cfg, 'paths.output.report_dir'), config_path)
    report_dir.mkdir(parents=True, exist_ok=True)

    required = ['event_id', 'machine_id', 'score_lenient_norm', 'score_strict_norm', 'behavior_anomaly_score', 'behavior_sensitive_score']
    for p in [train_in, valid_in, test_in]:
        ensure_required(p, required, sep, encoding)

    clip_stats = fit_l1_clip_stats(train_in, cfg, sep, encoding)
    save_json(clip_stats, report_dir / 'l1_score_clip_stats_train_only.json')

    summaries = []
    for split, in_path, out_path in [
        ('train', train_in, train_out),
        ('valid', valid_in, valid_out),
        ('test', test_in, test_out),
    ]:
        summaries.append(prepare_one_split(split, in_path, out_path, cfg, clip_stats))

    summary_df = pd.DataFrame(summaries)
    summary_df.to_csv(report_dir / 'prepare_l2_features_summary.csv', index=False, encoding='utf-8-sig')

    policy = build_feature_policy(train_out, cfg, out_sep, out_encoding)
    save_json(policy, report_dir / 'l2_feature_policy.json')

    target_parts = []
    signal_parts = []
    for split, out_path in [('train', train_out), ('valid', valid_out), ('test', test_out)]:
        target_df, signal_df = target_and_signal_report(out_path, split, cfg, out_sep, out_encoding)
        target_parts.append(target_df)
        signal_parts.append(signal_df)

    pd.concat(target_parts, ignore_index=True).to_csv(report_dir / 'prepared_target_distribution.csv', index=False, encoding='utf-8-sig')
    pd.concat(signal_parts, ignore_index=True).to_csv(report_dir / 'prepared_l1_signal_by_target.csv', index=False, encoding='utf-8-sig')

    run_summary = {
        'prepared_dataset_version': get_cfg(cfg, 'project.prepared_dataset_version', 'l2_ready_v1'),
        'outputs': {
            'train': str(train_out),
            'valid': str(valid_out),
            'test': str(test_out),
            'report_dir': str(report_dir),
        },
        'feature_policy': str(report_dir / 'l2_feature_policy.json'),
        'clip_stats': str(report_dir / 'l1_score_clip_stats_train_only.json'),
        'split_summaries': summaries,
        'recommended_next_step': 'Batch 06: train L2 multi-label models using feature profiles safe and strict_continuous first.',
    }
    save_json(run_summary, report_dir / 'prepare_l2_features_run_summary.json')

    print('\n=== Batch 05.1 completed ===')
    print(summary_df)
    print('\nFeature profile sizes:')
    print(policy['profile_sizes'])
    print(f'\nReport dir: {report_dir}')
    print('Recommended for Batch 06: train safe and strict_continuous profiles, compare valid/test metrics.')
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Prepare L2 ready datasets with stabilized L1 strict/sensitive features.')
    parser.add_argument('--config', required=True, help='Path to feature_policy.yaml')
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    return run_prepare(args.config)


if __name__ == '__main__':
    raise SystemExit(main())
