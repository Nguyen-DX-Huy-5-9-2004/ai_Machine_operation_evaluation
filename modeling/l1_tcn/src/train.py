from __future__ import annotations

import argparse
import gc
import json
import math
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader

from config import load_yaml, build_paths, validate_paths_for_training, get_profile_paths
from dataset import load_dataset_from_csv
from features import L1FeaturePreprocessor
from losses import (
    WeldcomReconstructionLoss,
    batch_to_device,
    reconstruction_error_per_window,
)
from model import WeldcomTCNAutoencoder
from threshold import (
    threshold_config_from_yaml,
    build_thresholds,
    apply_thresholds,
    summarize_anomaly_result,
)
from utils import setup_logger, seed_everything, save_json, choose_device


# ============================================================
# 1. Training helpers
# ============================================================

def make_dataloader(
    dataset,
    batch_size: int,
    shuffle: bool,
    num_workers: int,
    pin_memory: bool,
    persistent_workers: bool,
) -> DataLoader:
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=bool(persistent_workers and num_workers > 0),
        drop_last=False,
    )


class EarlyStopping:
    def __init__(self, patience: int = 6, min_delta: float = 1e-6) -> None:
        self.patience = int(patience)
        self.min_delta = float(min_delta)
        self.best = float("inf")
        self.bad_epochs = 0

    def step(self, value: float) -> bool:
        """
        Return True nếu nên stop.
        """
        if value < self.best - self.min_delta:
            self.best = float(value)
            self.bad_epochs = 0
            return False
        self.bad_epochs += 1
        return self.bad_epochs >= self.patience


class WarmupCosineScheduler:
    """
    Scheduler nhẹ, không phụ thuộc transformers.

    - warmup vài bước đầu để tránh gradient sốc.
    - cosine decay về min_lr_ratio * lr.
    """

    def __init__(
        self,
        optimizer: torch.optim.Optimizer,
        total_steps: int,
        warmup_ratio: float = 0.05,
        min_lr_ratio: float = 0.05,
    ) -> None:
        self.optimizer = optimizer
        self.total_steps = max(int(total_steps), 1)
        self.warmup_steps = max(int(self.total_steps * warmup_ratio), 1)
        self.min_lr_ratio = float(min_lr_ratio)
        self.base_lrs = [g["lr"] for g in optimizer.param_groups]
        self.step_num = 0

    def step(self) -> None:
        self.step_num += 1
        s = self.step_num

        if s <= self.warmup_steps:
            scale = s / self.warmup_steps
        else:
            progress = (s - self.warmup_steps) / max(1, self.total_steps - self.warmup_steps)
            cosine = 0.5 * (1.0 + math.cos(math.pi * min(progress, 1.0)))
            scale = self.min_lr_ratio + (1.0 - self.min_lr_ratio) * cosine

        for lr, group in zip(self.base_lrs, self.optimizer.param_groups):
            group["lr"] = lr * scale


def unpack_loss_weights(cfg: Dict[str, Any]) -> Dict[str, float]:
    loss_cfg = cfg.get("train", {}).get("loss", {})
    return {
        "continuous_weight": float(loss_cfg.get("continuous_weight", 1.0)),
        "binary_weight": float(loss_cfg.get("binary_weight", 0.75)),
        "categorical_weight": float(loss_cfg.get("categorical_weight", 0.35)),
    }


def train_one_epoch(
    model: torch.nn.Module,
    loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    scheduler: Optional[WarmupCosineScheduler],
    criterion: WeldcomReconstructionLoss,
    device: torch.device,
    scaler: Optional[torch.cuda.amp.GradScaler],
    mixed_precision: bool,
    gradient_clip_norm: float,
) -> Dict[str, float]:
    model.train()

    sums = {
        "loss": 0.0,
        "continuous_loss": 0.0,
        "binary_loss": 0.0,
        "categorical_loss": 0.0,
    }
    n_batches = 0

    for batch in loader:
        batch = batch_to_device(batch, device)
        optimizer.zero_grad(set_to_none=True)

        with torch.cuda.amp.autocast(enabled=bool(mixed_precision and device.type == "cuda")):
            outputs = model(batch["cat"], batch["cont"])
            lb = criterion(outputs, batch["cat"], batch["cont"])
            loss = lb.total_loss

        if not torch.isfinite(loss):
            raise RuntimeError(f"Non-finite loss detected: {loss.item()}")

        if scaler is not None and mixed_precision and device.type == "cuda":
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            if gradient_clip_norm and gradient_clip_norm > 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), gradient_clip_norm)
            scaler.step(optimizer)
            scaler.update()
        else:
            loss.backward()
            if gradient_clip_norm and gradient_clip_norm > 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), gradient_clip_norm)
            optimizer.step()

        if scheduler is not None:
            scheduler.step()

        sums["loss"] += float(loss.detach().cpu())
        sums["continuous_loss"] += float(lb.continuous_loss.cpu())
        sums["binary_loss"] += float(lb.binary_loss.cpu())
        sums["categorical_loss"] += float(lb.categorical_loss.cpu())
        n_batches += 1

    return {k: v / max(n_batches, 1) for k, v in sums.items()}


@torch.no_grad()
def evaluate_loss(
    model: torch.nn.Module,
    loader: DataLoader,
    criterion: WeldcomReconstructionLoss,
    device: torch.device,
    mixed_precision: bool,
) -> Dict[str, float]:
    model.eval()

    sums = {
        "loss": 0.0,
        "continuous_loss": 0.0,
        "binary_loss": 0.0,
        "categorical_loss": 0.0,
    }
    n_batches = 0

    for batch in loader:
        batch = batch_to_device(batch, device)

        with torch.cuda.amp.autocast(enabled=bool(mixed_precision and device.type == "cuda")):
            outputs = model(batch["cat"], batch["cont"])
            lb = criterion(outputs, batch["cat"], batch["cont"])

        sums["loss"] += float(lb.total_loss.detach().cpu())
        sums["continuous_loss"] += float(lb.continuous_loss.cpu())
        sums["binary_loss"] += float(lb.binary_loss.cpu())
        sums["categorical_loss"] += float(lb.categorical_loss.cpu())
        n_batches += 1

    return {k: v / max(n_batches, 1) for k, v in sums.items()}


@torch.no_grad()
def collect_reconstruction_scores(
    model: torch.nn.Module,
    loader: DataLoader,
    cfg: Dict[str, Any],
    device: torch.device,
    mixed_precision: bool,
) -> pd.DataFrame:
    """
    Score từng window.
    Score gán cho event cuối window.
    """
    model.eval()

    data_cfg = cfg.get("data", {})
    categorical_columns = list(data_cfg.get("categorical_columns", []))
    continuous_columns = list(data_cfg.get("continuous_columns", []))
    binary_columns = list(data_cfg.get("binary_columns", []))
    loss_weights = unpack_loss_weights(cfg)

    rows = []

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

        out = {
            "event_id": batch["event_id"].detach().cpu().numpy(),
            "machine_id": batch["machine_id"].detach().cpu().numpy(),
            "total_error": err["total_error"].detach().float().cpu().numpy(),
            "continuous_error": err["continuous_error"].detach().float().cpu().numpy(),
            "binary_error": err["binary_error"].detach().float().cpu().numpy(),
            "categorical_error": err["categorical_error"].detach().float().cpu().numpy(),
        }
        rows.append(pd.DataFrame(out))

    if not rows:
        return pd.DataFrame(columns=[
            "event_id", "machine_id", "total_error",
            "continuous_error", "binary_error", "categorical_error"
        ])

    return pd.concat(rows, ignore_index=True)


def save_checkpoint(
    path: Path,
    model: torch.nn.Module,
    optimizer: torch.optim.Optimizer,
    epoch: int,
    valid_loss: float,
    cfg: Dict[str, Any],
    profile: str,
    model_params: Dict[str, int],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "epoch": int(epoch),
        "valid_loss": float(valid_loss),
        "profile": profile,
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "cfg": cfg,
        "model_params": model_params,
    }
    torch.save(payload, path)


def write_history(history: List[Dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(history).to_csv(path, index=False, encoding="utf-8-sig")


# ============================================================
# 2. Main train pipeline
# ============================================================

def run_train(config_path: str, profile: str, limit_train_windows: Optional[int] = None, resume: bool = False) -> int:
    logger = setup_logger()
    cfg = load_yaml(config_path)
    paths = build_paths(cfg, config_path)
    validate_paths_for_training(paths, profile)

    profile_paths = get_profile_paths(paths, profile)
    artifact_dir: Path = profile_paths["artifact_dir"]
    artifact_dir.mkdir(parents=True, exist_ok=True)

    seed = int(cfg.get("project", {}).get("seed", 42))
    seed_everything(seed)

    device_str = choose_device(str(cfg.get("train", {}).get("device", "auto")))
    device = torch.device(device_str)

    logger.info(f"Profile: {profile}")
    logger.info(f"Device : {device}")
    if device.type == "cuda":
        logger.info(f"CUDA   : {torch.cuda.get_device_name(0)}")

    data_cfg = cfg.get("data", {})
    sep = str(data_cfg.get("sep", ","))
    encoding = str(data_cfg.get("encoding", "utf-8-sig"))

    window_cfg = cfg.get("window", {})
    window_size = int(window_cfg.get("size", 20))
    stride_train = int(window_cfg.get("stride_train", 1))
    stride_eval = int(window_cfg.get("stride_eval", 1))

    max_train_windows = window_cfg.get("max_train_windows", None)
    if limit_train_windows is not None:
        max_train_windows = int(limit_train_windows)
    elif max_train_windows is not None:
        max_train_windows = int(max_train_windows)

    # ------------------------------------------------------------
    # Load datasets
    # ------------------------------------------------------------
    logger.info("Load train dataset and fit preprocessor...")
    preprocessor = L1FeaturePreprocessor.from_config(cfg)

    train_ds, train_df, train_wb = load_dataset_from_csv(
        csv_path=profile_paths["train"],
        preprocessor=preprocessor,
        window_size=window_size,
        stride=stride_train,
        sep=sep,
        encoding=encoding,
        fit_preprocessor=True,
        max_windows=max_train_windows,
        random_seed=seed,
    )

    logger.info(
        f"Train rows={train_wb.row_count:,}, segments={train_wb.segment_count:,}, "
        f"windows={train_wb.window_count:,}"
    )

    preprocessor_path = artifact_dir / "preprocessor.json"
    preprocessor.save(preprocessor_path)
    save_json(preprocessor.summary(), artifact_dir / "preprocessor_summary.json")

    logger.info("Load valid dataset...")
    valid_ds, valid_df, valid_wb = load_dataset_from_csv(
        csv_path=profile_paths["valid"],
        preprocessor=preprocessor,
        window_size=window_size,
        stride=stride_eval,
        sep=sep,
        encoding=encoding,
        fit_preprocessor=False,
        max_windows=None,
        random_seed=seed,
    )
    logger.info(
        f"Valid rows={valid_wb.row_count:,}, segments={valid_wb.segment_count:,}, "
        f"windows={valid_wb.window_count:,}"
    )

    logger.info("Load test dataset...")
    test_ds, test_df, test_wb = load_dataset_from_csv(
        csv_path=profile_paths["test"],
        preprocessor=preprocessor,
        window_size=window_size,
        stride=stride_eval,
        sep=sep,
        encoding=encoding,
        fit_preprocessor=False,
        max_windows=None,
        random_seed=seed,
    )
    logger.info(
        f"Test rows={test_wb.row_count:,}, segments={test_wb.segment_count:,}, "
        f"windows={test_wb.window_count:,}"
    )

    # Candidate C keeps threshold calibration separate from the validation
    # loss used by early stopping. Older configs fall back to valid.
    calibration_path = profile_paths.get("calibration", profile_paths["valid"])
    logger.info("Load calibration dataset for threshold fitting...")
    calibration_ds, calibration_df, calibration_wb = load_dataset_from_csv(
        csv_path=calibration_path,
        preprocessor=preprocessor,
        window_size=window_size,
        stride=stride_eval,
        sep=sep,
        encoding=encoding,
        fit_preprocessor=False,
        max_windows=None,
        random_seed=seed,
    )

    # ------------------------------------------------------------
    # DataLoaders
    # ------------------------------------------------------------
    train_cfg = cfg.get("train", {})
    batch_size = int(train_cfg.get("batch_size", 1024))
    num_workers = int(train_cfg.get("num_workers", 2))
    pin_memory = bool(train_cfg.get("pin_memory", True))
    persistent_workers = bool(train_cfg.get("persistent_workers", False))

    train_loader = make_dataloader(
        train_ds,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=persistent_workers,
    )

    valid_loader = make_dataloader(
        valid_ds,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=persistent_workers,
    )

    test_loader = make_dataloader(
        test_ds,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=persistent_workers,
    )
    calibration_loader = make_dataloader(
        calibration_ds,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=persistent_workers,
    )

    # ------------------------------------------------------------
    # Model
    # ------------------------------------------------------------
    model = WeldcomTCNAutoencoder.from_preprocessor_and_config(preprocessor, cfg)
    model.to(device)

    model_params = model.count_parameters()
    logger.info(f"Model params: total={model_params['total']:,}, trainable={model_params['trainable']:,}")

    if bool(train_cfg.get("torch_compile", False)) and hasattr(torch, "compile"):
        logger.info("Apply torch.compile...")
        model = torch.compile(model)

    criterion = WeldcomReconstructionLoss.from_config(cfg, preprocessor)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=float(train_cfg.get("learning_rate", 0.001)),
        weight_decay=float(train_cfg.get("weight_decay", 0.0001)),
    )

    max_epochs = int(train_cfg.get("max_epochs", 35))
    total_steps = max_epochs * max(len(train_loader), 1)
    scheduler = WarmupCosineScheduler(
        optimizer=optimizer,
        total_steps=total_steps,
        warmup_ratio=0.05,
        min_lr_ratio=0.05,
    )

    mixed_precision = bool(train_cfg.get("mixed_precision", True))
    scaler = torch.cuda.amp.GradScaler(enabled=bool(mixed_precision and device.type == "cuda"))
    gradient_clip_norm = float(train_cfg.get("gradient_clip_norm", 1.0))

    early_stopping = EarlyStopping(
        patience=int(train_cfg.get("early_stopping_patience", 6)),
        min_delta=1e-6,
    )

    history: List[Dict[str, Any]] = []
    best_ckpt = artifact_dir / "model_best.pt"
    last_ckpt = artifact_dir / "model_last.pt"

    # ------------------------------------------------------------
    # Training loop
    # ------------------------------------------------------------
    logger.info("Start training...")
    t0 = time.time()
    best_valid = float("inf")
    best_epoch = -1
    start_epoch = 1
    if resume and last_ckpt.exists():
        checkpoint = torch.load(last_ckpt, map_location=device)
        model.load_state_dict(checkpoint["model_state_dict"])
        optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        best_valid = float(checkpoint.get("valid_loss", float("inf")))
        best_epoch = int(checkpoint.get("epoch", 0))
        start_epoch = best_epoch + 1
        logger.info(f"Resuming from {last_ckpt} at epoch {start_epoch}.")

    for epoch in range(start_epoch, max_epochs + 1):
        ep_start = time.time()

        train_metrics = train_one_epoch(
            model=model,
            loader=train_loader,
            optimizer=optimizer,
            scheduler=scheduler,
            criterion=criterion,
            device=device,
            scaler=scaler,
            mixed_precision=mixed_precision,
            gradient_clip_norm=gradient_clip_norm,
        )

        valid_metrics = evaluate_loss(
            model=model,
            loader=valid_loader,
            criterion=criterion,
            device=device,
            mixed_precision=mixed_precision,
        )

        row = {
            "epoch": epoch,
            "train_loss": train_metrics["loss"],
            "train_continuous_loss": train_metrics["continuous_loss"],
            "train_binary_loss": train_metrics["binary_loss"],
            "train_categorical_loss": train_metrics["categorical_loss"],
            "valid_loss": valid_metrics["loss"],
            "valid_continuous_loss": valid_metrics["continuous_loss"],
            "valid_binary_loss": valid_metrics["binary_loss"],
            "valid_categorical_loss": valid_metrics["categorical_loss"],
            "lr": float(optimizer.param_groups[0]["lr"]),
            "epoch_seconds": float(time.time() - ep_start),
        }
        history.append(row)
        write_history(history, artifact_dir / "training_history.csv")

        logger.info(
            f"Epoch {epoch:03d}/{max_epochs} | "
            f"train={row['train_loss']:.6f} | valid={row['valid_loss']:.6f} | "
            f"cont={row['valid_continuous_loss']:.6f} | "
            f"bin={row['valid_binary_loss']:.6f} | "
            f"cat={row['valid_categorical_loss']:.6f} | "
            f"lr={row['lr']:.2e} | {row['epoch_seconds']:.1f}s"
        )

        # Save last checkpoint.
        save_checkpoint(
            path=last_ckpt,
            model=model,
            optimizer=optimizer,
            epoch=epoch,
            valid_loss=valid_metrics["loss"],
            cfg=cfg,
            profile=profile,
            model_params=model_params,
        )

        # Save best checkpoint.
        if valid_metrics["loss"] < best_valid:
            best_valid = float(valid_metrics["loss"])
            best_epoch = int(epoch)
            save_checkpoint(
                path=best_ckpt,
                model=model,
                optimizer=optimizer,
                epoch=epoch,
                valid_loss=valid_metrics["loss"],
                cfg=cfg,
                profile=profile,
                model_params=model_params,
            )
            logger.info(f"Saved best checkpoint: {best_ckpt}")

        if early_stopping.step(valid_metrics["loss"]):
            logger.info(f"Early stopping at epoch {epoch}. Best epoch={best_epoch}, best_valid={best_valid:.6f}")
            break

    total_seconds = time.time() - t0

    # ------------------------------------------------------------
    # Load best checkpoint for scoring valid/test
    # ------------------------------------------------------------
    logger.info("Load best checkpoint for valid/test scoring...")
    ckpt = torch.load(best_ckpt, map_location=device)
    if hasattr(model, "_orig_mod"):
        model._orig_mod.load_state_dict(ckpt["model_state_dict"])
    else:
        model.load_state_dict(ckpt["model_state_dict"])
    model.to(device)
    model.eval()

    # ------------------------------------------------------------
    # Early stopping uses valid normal reconstruction loss. Thresholds use
    # calibration normal data, never valid/test labels.
    # ------------------------------------------------------------
    logger.info("Collect calibration reconstruction scores for thresholds...")
    calibration_scores = collect_reconstruction_scores(
        model=model,
        loader=calibration_loader,
        cfg=cfg,
        device=device,
        mixed_precision=mixed_precision,
    )

    calibration_scores_path = artifact_dir / "calibration_window_scores.csv.gz"
    calibration_scores.to_csv(calibration_scores_path, index=False, encoding="utf-8-sig", compression="gzip")

    th_cfg = threshold_config_from_yaml(cfg, profile)
    threshold_payload = build_thresholds(calibration_scores, th_cfg, score_col="total_error")
    save_json(threshold_payload, artifact_dir / "thresholds.json")

    logger.info("Collect valid reconstruction scores for evaluation...")
    valid_scores = collect_reconstruction_scores(model=model, loader=valid_loader, cfg=cfg, device=device, mixed_precision=mixed_precision)
    valid_scores_path = artifact_dir / "valid_window_scores.csv.gz"
    valid_scores.to_csv(valid_scores_path, index=False, encoding="utf-8-sig", compression="gzip")
    valid_scored = apply_thresholds(valid_scores, threshold_payload, score_col="total_error")
    valid_scored_path = artifact_dir / "valid_window_scores_with_threshold.csv.gz"
    valid_scored.to_csv(valid_scored_path, index=False, encoding="utf-8-sig", compression="gzip")

    valid_anomaly_summary = summarize_anomaly_result(valid_scored, score_col="total_error")
    save_json(valid_anomaly_summary, artifact_dir / "valid_anomaly_summary.json")

    # ------------------------------------------------------------
    # Test scoring
    # ------------------------------------------------------------
    logger.info("Collect test reconstruction scores...")
    test_scores = collect_reconstruction_scores(
        model=model,
        loader=test_loader,
        cfg=cfg,
        device=device,
        mixed_precision=mixed_precision,
    )

    test_scored = apply_thresholds(test_scores, threshold_payload, score_col="total_error")
    test_scores_path = artifact_dir / "test_window_scores_with_threshold.csv.gz"
    test_scored.to_csv(test_scores_path, index=False, encoding="utf-8-sig", compression="gzip")

    test_anomaly_summary = summarize_anomaly_result(test_scored, score_col="total_error")
    save_json(test_anomaly_summary, artifact_dir / "test_anomaly_summary.json")

    # ------------------------------------------------------------
    # Run summary
    # ------------------------------------------------------------
    run_summary = {
        "profile": profile,
        "device": str(device),
        "best_epoch": best_epoch,
        "best_valid_loss": best_valid,
        "total_training_seconds": float(total_seconds),
        "window_size": window_size,
        "train_windows": int(train_wb.window_count),
        "calibration_windows": int(calibration_wb.window_count),
        "valid_windows": int(valid_wb.window_count),
        "test_windows": int(test_wb.window_count),
        "model_params": model_params,
        "artifact_dir": str(artifact_dir),
        "files": {
            "best_checkpoint": str(best_ckpt),
            "last_checkpoint": str(last_ckpt),
            "preprocessor": str(preprocessor_path),
            "training_history": str(artifact_dir / "training_history.csv"),
            "thresholds": str(artifact_dir / "thresholds.json"),
            "calibration_scores": str(calibration_scores_path),
            "valid_scores": str(valid_scores_path),
            "valid_scores_with_threshold": str(valid_scored_path),
            "test_scores_with_threshold": str(test_scores_path),
            "valid_anomaly_summary": str(artifact_dir / "valid_anomaly_summary.json"),
            "test_anomaly_summary": str(artifact_dir / "test_anomaly_summary.json"),
        },
    }
    save_json(run_summary, artifact_dir / "run_summary.json")

    logger.info("Training completed.")
    logger.info(f"Best epoch       : {best_epoch}")
    logger.info(f"Best valid loss  : {best_valid:.6f}")
    logger.info(f"Artifact dir     : {artifact_dir}")

    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train Weldcom L1 TCN Autoencoder")
    parser.add_argument("--config", required=True, help="Path to configs/base.yaml")
    parser.add_argument("--profile", required=True, choices=["strict", "lenient"], help="Train profile")
    parser.add_argument(
        "--limit-train-windows",
        type=int,
        default=None,
        help="Optional limit for quick Colab smoke-test. Leave empty for full training.",
    )
    parser.add_argument("--resume", action="store_true", help="Resume from candidate-only model_last.pt when present.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    return run_train(
        config_path=args.config,
        profile=args.profile,
        limit_train_windows=args.limit_train_windows,
        resume=args.resume,
    )


if __name__ == "__main__":
    raise SystemExit(main())
