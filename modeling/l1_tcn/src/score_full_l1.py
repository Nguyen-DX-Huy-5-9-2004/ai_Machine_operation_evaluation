from __future__ import annotations

import argparse
import gc
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader

from config import load_yaml, build_paths, get_profile_paths, ConfigError
from dataset import load_dataset_from_csv
from features import L1FeaturePreprocessor
from losses import batch_to_device, reconstruction_error_per_window
from model import WeldcomTCNAutoencoder
from threshold import apply_thresholds
from utils import setup_logger, seed_everything, load_json, save_json, choose_device


# ============================================================
# 1. Helpers
# ============================================================

def torch_load_checkpoint(path: Path, device: torch.device) -> Dict[str, Any]:
    """
    PyTorch 2.6 có thể thay đổi default weights_only.
    Hàm này giữ tương thích giữa nhiều phiên bản PyTorch/Colab.
    """
    try:
        return torch.load(path, map_location=device, weights_only=False)
    except TypeError:
        return torch.load(path, map_location=device)


def strip_orig_mod_prefix(state_dict: Dict[str, torch.Tensor]) -> Dict[str, torch.Tensor]:
    """
    Nếu model từng được torch.compile thì state_dict có thể có prefix _orig_mod.
    """
    if not any(k.startswith("_orig_mod.") for k in state_dict.keys()):
        return state_dict
    return {k.replace("_orig_mod.", "", 1): v for k, v in state_dict.items()}


def make_score_loader(dataset, batch_size: int, num_workers: int, pin_memory: bool) -> DataLoader:
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=False,
        drop_last=False,
    )


def read_base_event_ids(
    l1_full_path: Path,
    sep: str,
    encoding: str,
) -> pd.DataFrame:
    """
    Đọc toàn bộ khóa event để output cuối có đủ mọi event_id.
    Các event đầu segment không đủ window sẽ vẫn xuất hiện với reason=INSUFFICIENT_WINDOW.
    """
    usecols = ["event_id", "machine_id", "sequence_segment_id", "event_order_in_segment"]
    df = pd.read_csv(
        l1_full_path,
        sep=sep,
        encoding=encoding,
        usecols=usecols,
        low_memory=False,
    )
    df = df.sort_values(
        ["machine_id", "sequence_segment_id", "event_order_in_segment"],
        kind="mergesort",
    ).reset_index(drop=True)

    for c in usecols:
        df[c] = pd.to_numeric(df[c], errors="coerce").astype("Int64")

    return df


def load_profile_model(
    cfg: Dict[str, Any],
    profile: str,
    artifact_dir: Path,
    device: torch.device,
) -> Tuple[WeldcomTCNAutoencoder, L1FeaturePreprocessor, Dict[str, Any]]:
    """
    Load model_best.pt + preprocessor + thresholds cho profile strict/lenient.
    """
    preprocessor_path = artifact_dir / "preprocessor.json"
    checkpoint_path = artifact_dir / "model_best.pt"
    threshold_path = artifact_dir / "thresholds.json"

    missing = [p for p in [preprocessor_path, checkpoint_path, threshold_path] if not p.exists()]
    if missing:
        msg = "\n".join(str(p) for p in missing)
        raise FileNotFoundError(
            f"Profile '{profile}' chưa đủ artifact. Cần train profile này trước.\nMissing:\n{msg}"
        )

    preprocessor = L1FeaturePreprocessor.load(preprocessor_path)

    model = WeldcomTCNAutoencoder.from_preprocessor_and_config(preprocessor, cfg)
    ckpt = torch_load_checkpoint(checkpoint_path, device)
    state = strip_orig_mod_prefix(ckpt["model_state_dict"])
    model.load_state_dict(state)
    model.to(device)
    model.eval()

    threshold_payload = load_json(threshold_path)
    return model, preprocessor, threshold_payload


@torch.no_grad()
def collect_profile_scores(
    model: torch.nn.Module,
    loader: DataLoader,
    cfg: Dict[str, Any],
    device: torch.device,
    mixed_precision: bool,
) -> pd.DataFrame:
    """
    Tính reconstruction error cho từng window; score gán cho event cuối window.
    """
    model.eval()

    data_cfg = cfg.get("data", {})
    categorical_columns = list(data_cfg.get("categorical_columns", []))
    continuous_columns = list(data_cfg.get("continuous_columns", []))
    binary_columns = list(data_cfg.get("binary_columns", []))

    loss_cfg = cfg.get("train", {}).get("loss", {})
    loss_weights = {
        "continuous_weight": float(loss_cfg.get("continuous_weight", 1.0)),
        "binary_weight": float(loss_cfg.get("binary_weight", 0.75)),
        "categorical_weight": float(loss_cfg.get("categorical_weight", 0.35)),
    }

    rows: List[pd.DataFrame] = []

    for batch in loader:
        batch = batch_to_device(batch, device)

        with torch.cuda.amp.autocast(enabled=bool(mixed_precision and device.type == "cuda")):
            outputs = model(batch["cat"], batch["cont"])

        err = reconstruction_error_per_window(
            outputs=outputs,
            cat_target=batch["cat"],
            cont_target=batch["cont"],
            categorical_columns=categorical_columns,
            real_continuous_dim=len(continuous_columns),
            binary_dim=len(binary_columns),
            **loss_weights,
        )

        part = pd.DataFrame({
            "event_id": batch["event_id"].detach().cpu().numpy(),
            "machine_id": batch["machine_id"].detach().cpu().numpy(),
            "total_error": err["total_error"].detach().float().cpu().numpy(),
            "continuous_error": err["continuous_error"].detach().float().cpu().numpy(),
            "binary_error": err["binary_error"].detach().float().cpu().numpy(),
            "categorical_error": err["categorical_error"].detach().float().cpu().numpy(),
        })
        rows.append(part)

    if not rows:
        return pd.DataFrame(columns=[
            "event_id", "machine_id", "total_error",
            "continuous_error", "binary_error", "categorical_error",
        ])

    return pd.concat(rows, ignore_index=True)


def rename_profile_columns(df: pd.DataFrame, profile: str) -> pd.DataFrame:
    rename_map = {
        "total_error": f"score_{profile}",
        "continuous_error": f"continuous_error_{profile}",
        "binary_error": f"binary_error_{profile}",
        "categorical_error": f"categorical_error_{profile}",
        "anomaly_threshold": f"threshold_{profile}",
        "anomaly_score_norm": f"score_{profile}_norm",
        "is_anomaly": f"is_anomaly_{profile}",
    }
    keep_cols = ["event_id", "machine_id"] + list(rename_map.keys())
    keep_cols = [c for c in keep_cols if c in df.columns]
    out = df[keep_cols].rename(columns=rename_map)
    return out


def score_one_profile(
    cfg: Dict[str, Any],
    config_path: str,
    profile: str,
    device: torch.device,
    batch_size: int,
    num_workers: int,
    pin_memory: bool,
    limit_windows: Optional[int] = None,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Load một profile artifact, score full L1, apply threshold, return profile score.
    """
    logger = setup_logger()
    paths = build_paths(cfg, config_path)
    profile_paths = get_profile_paths(paths, profile)
    artifact_dir: Path = profile_paths["artifact_dir"]

    logger.info(f"[{profile}] Load model/preprocessor/threshold from {artifact_dir}")
    model, preprocessor, threshold_payload = load_profile_model(
        cfg=cfg,
        profile=profile,
        artifact_dir=artifact_dir,
        device=device,
    )

    data_cfg = cfg.get("data", {})
    sep = str(data_cfg.get("sep", ";"))
    encoding = str(data_cfg.get("encoding", "utf-8-sig"))
    window_size = int(cfg.get("window", {}).get("size", 20))
    stride_eval = int(cfg.get("window", {}).get("stride_eval", 1))
    mixed_precision = bool(cfg.get("train", {}).get("mixed_precision", True))

    logger.info(f"[{profile}] Load full L1 dataset and build windows...")
    dataset, df_meta, wb = load_dataset_from_csv(
        csv_path=paths.l1_full,
        preprocessor=preprocessor,
        window_size=window_size,
        stride=stride_eval,
        sep=sep,
        encoding=encoding,
        fit_preprocessor=False,
        max_windows=limit_windows,
        random_seed=int(cfg.get("project", {}).get("seed", 42)),
    )

    logger.info(
        f"[{profile}] Full rows={wb.row_count:,}, segments={wb.segment_count:,}, "
        f"windows={wb.window_count:,}"
    )

    loader = make_score_loader(
        dataset=dataset,
        batch_size=batch_size,
        num_workers=num_workers,
        pin_memory=pin_memory,
    )

    logger.info(f"[{profile}] Scoring windows...")
    raw_scores = collect_profile_scores(
        model=model,
        loader=loader,
        cfg=cfg,
        device=device,
        mixed_precision=mixed_precision,
    )

    logger.info(f"[{profile}] Apply thresholds...")
    scored = apply_thresholds(raw_scores, threshold_payload, score_col="total_error")
    scored = rename_profile_columns(scored, profile)

    profile_summary = {
        "profile": profile,
        "row_count_full": int(wb.row_count),
        "window_count_scored": int(wb.window_count),
        "artifact_dir": str(artifact_dir),
        "global_threshold": float(threshold_payload.get("global_threshold", np.nan)),
        "anomaly_count": int(scored[f"is_anomaly_{profile}"].sum()) if f"is_anomaly_{profile}" in scored.columns else 0,
        "anomaly_rate_on_scored_windows": float(scored[f"is_anomaly_{profile}"].mean()) if len(scored) else 0.0,
    }

    # Free RAM/GPU references.
    del model, preprocessor, dataset, df_meta, loader, raw_scores
    gc.collect()
    if device.type == "cuda":
        torch.cuda.empty_cache()

    return scored, profile_summary


def combine_strict_lenient(
    base_events: pd.DataFrame,
    lenient_scores: Optional[pd.DataFrame],
    strict_scores: Optional[pd.DataFrame],
    model_version: str,
) -> pd.DataFrame:
    """
    Gộp score lenient + strict thành output L1 event-level.
    """
    out = base_events.copy()

    if lenient_scores is not None:
        out = out.merge(
            lenient_scores.drop(columns=["machine_id"], errors="ignore"),
            on="event_id",
            how="left",
        )

    if strict_scores is not None:
        out = out.merge(
            strict_scores.drop(columns=["machine_id"], errors="ignore"),
            on="event_id",
            how="left",
        )

    # Ensure expected columns exist.
    expected_float_cols = [
        "score_lenient", "continuous_error_lenient", "binary_error_lenient",
        "categorical_error_lenient", "threshold_lenient", "score_lenient_norm",
        "score_strict", "continuous_error_strict", "binary_error_strict",
        "categorical_error_strict", "threshold_strict", "score_strict_norm",
    ]
    for c in expected_float_cols:
        if c not in out.columns:
            out[c] = np.nan

    expected_int_cols = ["is_anomaly_lenient", "is_anomaly_strict"]
    for c in expected_int_cols:
        if c not in out.columns:
            out[c] = 0
        out[c] = pd.to_numeric(out[c], errors="coerce").fillna(0).astype("int8")

    score_cols = ["score_lenient_norm", "score_strict_norm"]
    out["behavior_anomaly_score"] = out[score_cols].max(axis=1, skipna=True).fillna(0.0)

    out["is_behavior_anomaly"] = (
        (out["is_anomaly_lenient"] > 0) | (out["is_anomaly_strict"] > 0)
    ).astype("int8")

    lenient_available = out["score_lenient_norm"].notna()
    strict_available = out["score_strict_norm"].notna()

    both_unavailable = (~lenient_available) & (~strict_available)
    both_anom = (out["is_anomaly_lenient"] > 0) & (out["is_anomaly_strict"] > 0)
    lenient_only = (out["is_anomaly_lenient"] > 0) & ~(out["is_anomaly_strict"] > 0)
    strict_only = ~(out["is_anomaly_lenient"] > 0) & (out["is_anomaly_strict"] > 0)

    reason = np.full(len(out), "NORMAL_LIKE", dtype=object)
    reason[both_unavailable.to_numpy()] = "INSUFFICIENT_WINDOW"
    reason[both_anom.to_numpy()] = "STRONG_DEVIATION_BOTH_MODELS"
    reason[lenient_only.to_numpy()] = "PRODUCTION_MODEL_DEVIATION"
    reason[strict_only.to_numpy()] = "SENSITIVE_MODEL_DEVIATION"

    out["behavior_reason"] = reason
    out["model_version"] = model_version
    out["created_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Reorder columns.
    ordered_cols = [
        "event_id",
        "machine_id",
        "sequence_segment_id",
        "event_order_in_segment",
        "model_version",
        "score_lenient",
        "score_strict",
        "score_lenient_norm",
        "score_strict_norm",
        "threshold_lenient",
        "threshold_strict",
        "is_anomaly_lenient",
        "is_anomaly_strict",
        "behavior_anomaly_score",
        "is_behavior_anomaly",
        "behavior_reason",
        "continuous_error_lenient",
        "binary_error_lenient",
        "categorical_error_lenient",
        "continuous_error_strict",
        "binary_error_strict",
        "categorical_error_strict",
        "created_time",
    ]
    ordered_cols = [c for c in ordered_cols if c in out.columns]
    return out[ordered_cols]


def summarize_final_output(df: pd.DataFrame) -> Dict[str, Any]:
    total = int(len(df))
    anom = int(pd.to_numeric(df["is_behavior_anomaly"], errors="coerce").fillna(0).sum())

    summary: Dict[str, Any] = {
        "total_events": total,
        "behavior_anomaly_events": anom,
        "behavior_anomaly_rate": float(anom / total) if total else 0.0,
        "reason_distribution": df["behavior_reason"].value_counts(dropna=False).to_dict(),
    }

    by_machine = []
    for machine_id, g in df.groupby("machine_id", sort=True):
        n = int(len(g))
        p = int(pd.to_numeric(g["is_behavior_anomaly"], errors="coerce").fillna(0).sum())
        by_machine.append({
            "machine_id": int(machine_id) if pd.notna(machine_id) else machine_id,
            "total_events": n,
            "behavior_anomaly_events": p,
            "behavior_anomaly_rate": float(p / n) if n else 0.0,
            "score_mean": float(pd.to_numeric(g["behavior_anomaly_score"], errors="coerce").mean()),
            "score_p99": float(pd.to_numeric(g["behavior_anomaly_score"], errors="coerce").quantile(0.99)),
        })

    summary["by_machine"] = by_machine
    return summary


# ============================================================
# 2. Main
# ============================================================

def run_score_full_l1(
    config_path: str,
    profiles: str,
    output: Optional[str],
    batch_size: Optional[int],
    limit_windows: Optional[int],
) -> int:
    logger = setup_logger()
    cfg = load_yaml(config_path)
    paths = build_paths(cfg, config_path)

    seed_everything(int(cfg.get("project", {}).get("seed", 42)))

    if not paths.l1_full.exists():
        raise FileNotFoundError(f"Full L1 dataset not found: {paths.l1_full}")

    profile_list = [p.strip() for p in profiles.split(",") if p.strip()]
    for p in profile_list:
        if p not in {"lenient", "strict"}:
            raise ValueError("--profiles chỉ hỗ trợ: lenient, strict, hoặc lenient,strict")

    device = torch.device(choose_device(str(cfg.get("train", {}).get("device", "auto"))))
    logger.info(f"Device: {device}")
    if device.type == "cuda":
        logger.info(f"CUDA  : {torch.cuda.get_device_name(0)}")

    train_cfg = cfg.get("train", {})
    score_batch_size = int(batch_size or train_cfg.get("batch_size", 1024))
    num_workers = int(train_cfg.get("num_workers", 2))
    pin_memory = bool(train_cfg.get("pin_memory", True))

    data_cfg = cfg.get("data", {})
    sep = str(data_cfg.get("sep", ";"))
    encoding = str(data_cfg.get("encoding", "utf-8-sig"))

    paths.scored_dir.mkdir(parents=True, exist_ok=True)
    output_path = Path(output) if output else paths.scored_output
    if not output_path.is_absolute():
        output_path = (paths.scored_dir / output_path).resolve()

    logger.info("Read base event ids...")
    base_events = read_base_event_ids(paths.l1_full, sep=sep, encoding=encoding)
    logger.info(f"Base events: {len(base_events):,}")

    lenient_scores = None
    strict_scores = None
    profile_summaries = []

    if "lenient" in profile_list:
        lenient_scores, s = score_one_profile(
            cfg=cfg,
            config_path=config_path,
            profile="lenient",
            device=device,
            batch_size=score_batch_size,
            num_workers=num_workers,
            pin_memory=pin_memory,
            limit_windows=limit_windows,
        )
        profile_summaries.append(s)

    if "strict" in profile_list:
        strict_scores, s = score_one_profile(
            cfg=cfg,
            config_path=config_path,
            profile="strict",
            device=device,
            batch_size=score_batch_size,
            num_workers=num_workers,
            pin_memory=pin_memory,
            limit_windows=limit_windows,
        )
        profile_summaries.append(s)

    version_prefix = str(cfg.get("project", {}).get("model_version_prefix", "l1_tcn_ae"))
    version_stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_version = f"{version_prefix}_{profiles.replace(',', '_')}_{version_stamp}"

    logger.info("Combine strict/lenient event-level scores...")
    final_df = combine_strict_lenient(
        base_events=base_events,
        lenient_scores=lenient_scores,
        strict_scores=strict_scores,
        model_version=model_version,
    )

    logger.info(f"Write output: {output_path}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    final_df.to_csv(output_path, index=False, encoding="utf-8-sig")

    summary = summarize_final_output(final_df)
    summary["model_version"] = model_version
    summary["profiles"] = profile_list
    summary["profile_summaries"] = profile_summaries
    summary["output_path"] = str(output_path)
    summary["limit_windows"] = limit_windows

    summary_path = output_path.parent / "ai_l1_operation_anomaly_result_summary.json"
    save_json(summary, summary_path)

    # Also export small machine summary CSV for quick check.
    machine_summary_path = output_path.parent / "ai_l1_operation_anomaly_result_by_machine.csv"
    pd.DataFrame(summary["by_machine"]).to_csv(machine_summary_path, index=False, encoding="utf-8-sig")

    logger.info("Score full L1 completed.")
    logger.info(f"Output        : {output_path}")
    logger.info(f"Summary       : {summary_path}")
    logger.info(f"Machine report: {machine_summary_path}")
    logger.info(f"Anomaly rate  : {summary['behavior_anomaly_rate']:.6f}")

    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Score full L1 dataset using strict/lenient TCN Autoencoders")
    parser.add_argument("--config", required=True, help="Path to configs/base.yaml")
    parser.add_argument(
        "--profiles",
        default="lenient,strict",
        help="Profiles to score: lenient, strict, or lenient,strict",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional output CSV path. Default uses paths.scored_output from config.",
    )
    parser.add_argument("--batch-size", type=int, default=None, help="Override scoring batch size.")
    parser.add_argument(
        "--limit-windows",
        type=int,
        default=None,
        help="Debug only: score limited random windows per profile. Do not use for final result.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    return run_score_full_l1(
        config_path=args.config,
        profiles=args.profiles,
        output=args.output,
        batch_size=args.batch_size,
        limit_windows=args.limit_windows,
    )


if __name__ == "__main__":
    raise SystemExit(main())
