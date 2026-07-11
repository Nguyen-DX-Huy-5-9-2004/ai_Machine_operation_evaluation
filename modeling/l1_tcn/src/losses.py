from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class LossBreakdown:
    total_loss: torch.Tensor
    continuous_loss: torch.Tensor
    binary_loss: torch.Tensor
    categorical_loss: torch.Tensor


class WeldcomReconstructionLoss(nn.Module):
    """
    Loss cho TCN Autoencoder.

    Input target:
        cat_target:  LongTensor  [B, T, n_cat]
        cont_target: FloatTensor [B, T, real_continuous_dim + binary_dim]

    Output model:
        continuous_recon: [B,T,real_continuous_dim]
        binary_logits:    [B,T,binary_dim]
        categorical_logits[col]: [B,T,cardinality]

    Loss:
        total = w_cont * SmoothL1/MSE continuous
              + w_bin  * BCEWithLogits binary
              + w_cat  * CE categorical

    Vì dữ liệu có nhiều flag và status token, tách loss như vậy giúp model không bị continuous feature lấn át.
    """

    def __init__(
        self,
        categorical_columns: List[str],
        real_continuous_dim: int,
        binary_dim: int,
        continuous_weight: float = 1.0,
        binary_weight: float = 0.75,
        categorical_weight: float = 0.35,
        continuous_loss: str = "smooth_l1",
    ) -> None:
        super().__init__()
        self.categorical_columns = list(categorical_columns)
        self.real_continuous_dim = int(real_continuous_dim)
        self.binary_dim = int(binary_dim)

        self.continuous_weight = float(continuous_weight)
        self.binary_weight = float(binary_weight)
        self.categorical_weight = float(categorical_weight)
        self.continuous_loss = continuous_loss

    @classmethod
    def from_config(cls, cfg_dict: Dict[str, Any], preprocessor: Any) -> "WeldcomReconstructionLoss":
        data_cfg = cfg_dict.get("data", {})
        train_cfg = cfg_dict.get("train", {})
        loss_cfg = train_cfg.get("loss", {})

        categorical_columns = list(data_cfg.get("categorical_columns", []))
        continuous_columns = list(data_cfg.get("continuous_columns", []))
        binary_columns = list(data_cfg.get("binary_columns", []))

        return cls(
            categorical_columns=categorical_columns,
            real_continuous_dim=len(continuous_columns),
            binary_dim=len(binary_columns),
            continuous_weight=float(loss_cfg.get("continuous_weight", 1.0)),
            binary_weight=float(loss_cfg.get("binary_weight", 0.75)),
            categorical_weight=float(loss_cfg.get("categorical_weight", 0.35)),
            continuous_loss=str(loss_cfg.get("continuous_loss", "smooth_l1")),
        )

    def _continuous_loss(self, pred: Optional[torch.Tensor], target: torch.Tensor) -> torch.Tensor:
        if self.real_continuous_dim <= 0 or pred is None:
            return target.new_tensor(0.0)

        y = target[:, :, :self.real_continuous_dim].float()

        if self.continuous_loss == "mse":
            return F.mse_loss(pred.float(), y, reduction="mean")

        if self.continuous_loss == "smooth_l1":
            return F.smooth_l1_loss(pred.float(), y, reduction="mean", beta=0.5)

        raise ValueError(f"Unsupported continuous_loss: {self.continuous_loss}")

    def _binary_loss(self, pred_logits: Optional[torch.Tensor], target: torch.Tensor) -> torch.Tensor:
        if self.binary_dim <= 0 or pred_logits is None:
            return target.new_tensor(0.0)

        start = self.real_continuous_dim
        end = self.real_continuous_dim + self.binary_dim
        y = target[:, :, start:end].float()
        y = torch.clamp(y, 0.0, 1.0)

        return F.binary_cross_entropy_with_logits(pred_logits.float(), y, reduction="mean")

    def _categorical_loss(self, categorical_logits: Dict[str, torch.Tensor], cat_target: torch.Tensor) -> torch.Tensor:
        if not self.categorical_columns:
            return cat_target.new_tensor(0.0, dtype=torch.float32)

        losses = []
        for i, col in enumerate(self.categorical_columns):
            logits = categorical_logits[col]  # [B,T,C]
            target = cat_target[:, :, i].long()
            target = torch.clamp(target, min=0, max=logits.shape[-1] - 1)

            loss = F.cross_entropy(
                logits.reshape(-1, logits.shape[-1]).float(),
                target.reshape(-1),
                reduction="mean",
            )
            losses.append(loss)

        return torch.stack(losses).mean()

    def forward(
        self,
        outputs: Dict[str, Any],
        cat_target: torch.Tensor,
        cont_target: torch.Tensor,
    ) -> LossBreakdown:
        cont_loss = self._continuous_loss(outputs.get("continuous_recon"), cont_target)
        bin_loss = self._binary_loss(outputs.get("binary_logits"), cont_target)
        cat_loss = self._categorical_loss(outputs.get("categorical_logits", {}), cat_target)

        total = (
            self.continuous_weight * cont_loss
            + self.binary_weight * bin_loss
            + self.categorical_weight * cat_loss
        )

        return LossBreakdown(
            total_loss=total,
            continuous_loss=cont_loss.detach(),
            binary_loss=bin_loss.detach(),
            categorical_loss=cat_loss.detach(),
        )


@torch.no_grad()
def reconstruction_error_per_window(
    outputs: Dict[str, Any],
    cat_target: torch.Tensor,
    cont_target: torch.Tensor,
    categorical_columns: List[str],
    real_continuous_dim: int,
    binary_dim: int,
    continuous_weight: float = 1.0,
    binary_weight: float = 0.75,
    categorical_weight: float = 0.35,
) -> Dict[str, torch.Tensor]:
    """
    Tính reconstruction error theo từng window/sample.
    Return tensors shape [B].

    Dùng cho:
    - threshold.py
    - score_full_l1.py

    Error càng cao => càng lệch khỏi nền normal.
    """
    batch_size = cont_target.shape[0]
    device = cont_target.device

    # Continuous error
    if real_continuous_dim > 0 and outputs.get("continuous_recon") is not None:
        pred_cont = outputs["continuous_recon"].float()
        tgt_cont = cont_target[:, :, :real_continuous_dim].float()
        cont_err = F.smooth_l1_loss(pred_cont, tgt_cont, reduction="none", beta=0.5)
        cont_err = cont_err.mean(dim=(1, 2))
    else:
        cont_err = torch.zeros(batch_size, device=device)

    # Binary error
    if binary_dim > 0 and outputs.get("binary_logits") is not None:
        start = real_continuous_dim
        end = real_continuous_dim + binary_dim
        logits = outputs["binary_logits"].float()
        tgt_bin = torch.clamp(cont_target[:, :, start:end].float(), 0.0, 1.0)
        bin_err = F.binary_cross_entropy_with_logits(logits, tgt_bin, reduction="none")
        bin_err = bin_err.mean(dim=(1, 2))
    else:
        bin_err = torch.zeros(batch_size, device=device)

    # Categorical error
    if categorical_columns:
        cat_errs = []
        categorical_logits = outputs.get("categorical_logits", {})
        for i, col in enumerate(categorical_columns):
            logits = categorical_logits[col].float()  # [B,T,C]
            target = cat_target[:, :, i].long()
            target = torch.clamp(target, min=0, max=logits.shape[-1] - 1)

            ce = F.cross_entropy(
                logits.reshape(-1, logits.shape[-1]),
                target.reshape(-1),
                reduction="none",
            )
            ce = ce.reshape(batch_size, -1).mean(dim=1)
            cat_errs.append(ce)

        cat_err = torch.stack(cat_errs, dim=1).mean(dim=1)
    else:
        cat_err = torch.zeros(batch_size, device=device)

    total = (
        continuous_weight * cont_err
        + binary_weight * bin_err
        + categorical_weight * cat_err
    )

    return {
        "total_error": total,
        "continuous_error": cont_err,
        "binary_error": bin_err,
        "categorical_error": cat_err,
    }


def batch_to_device(batch: Dict[str, torch.Tensor], device: torch.device | str) -> Dict[str, torch.Tensor]:
    return {
        k: v.to(device, non_blocking=True) if torch.is_tensor(v) else v
        for k, v in batch.items()
    }
