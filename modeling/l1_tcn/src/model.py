from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Any, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F


# ============================================================
# 1. Activation / small helpers
# ============================================================

def get_activation(name: str = "gelu") -> nn.Module:
    name = (name or "gelu").lower().strip()
    if name == "gelu":
        return nn.GELU()
    if name == "relu":
        return nn.ReLU(inplace=True)
    if name in {"silu", "swish"}:
        return nn.SiLU(inplace=True)
    if name == "leaky_relu":
        return nn.LeakyReLU(0.1, inplace=True)
    raise ValueError(f"Unsupported activation: {name}")


def same_padding_1d(kernel_size: int, dilation: int) -> int:
    """
    Padding để giữ nguyên chiều dài sequence với Conv1d stride=1.
    Với kernel odd, padding = dilation * (kernel_size - 1) // 2.
    """
    if kernel_size % 2 == 0:
        raise ValueError("kernel_size should be odd for exact same padding.")
    return dilation * (kernel_size - 1) // 2


# ============================================================
# 2. TCN building blocks
# ============================================================

class SpatialDropout1d(nn.Module):
    """
    Dropout theo channel cho tensor [B, C, T].
    Mạnh hơn dropout thường với sequence feature vì ép model không phụ thuộc
    quá mức vào một channel ẩn.
    """

    def __init__(self, p: float = 0.1) -> None:
        super().__init__()
        self.dropout = nn.Dropout2d(p)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # [B, C, T] -> [B, C, T, 1]
        x = x.unsqueeze(-1)
        x = self.dropout(x)
        return x.squeeze(-1)


class TCNResidualBlock(nn.Module):
    """
    Residual TCN block cho reconstruction sequence.

    Thiết kế:
    - Conv1d dilation để học pattern ở nhiều receptive field.
    - Norm để train ổn định trên dataset lớn.
    - GELU/SILU để mượt hơn ReLU.
    - Residual connection để tránh mất gradient.

    Input/Output: [B, C, T]
    """

    def __init__(
        self,
        channels: int,
        kernel_size: int = 3,
        dilation: int = 1,
        dropout: float = 0.1,
        use_batch_norm: bool = True,
        activation: str = "gelu",
    ) -> None:
        super().__init__()

        padding = same_padding_1d(kernel_size, dilation)

        self.conv1 = nn.Conv1d(
            channels,
            channels,
            kernel_size=kernel_size,
            padding=padding,
            dilation=dilation,
        )

        self.conv2 = nn.Conv1d(
            channels,
            channels,
            kernel_size=kernel_size,
            padding=padding,
            dilation=dilation,
        )

        if use_batch_norm:
            self.norm1 = nn.BatchNorm1d(channels)
            self.norm2 = nn.BatchNorm1d(channels)
        else:
            self.norm1 = nn.GroupNorm(num_groups=1, num_channels=channels)
            self.norm2 = nn.GroupNorm(num_groups=1, num_channels=channels)

        self.act1 = get_activation(activation)
        self.act2 = get_activation(activation)
        self.dropout1 = SpatialDropout1d(dropout)
        self.dropout2 = SpatialDropout1d(dropout)

        self._init_weights()

    def _init_weights(self) -> None:
        for m in [self.conv1, self.conv2]:
            nn.init.kaiming_normal_(m.weight, nonlinearity="relu")
            if m.bias is not None:
                nn.init.zeros_(m.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x

        y = self.conv1(x)
        y = self.norm1(y)
        y = self.act1(y)
        y = self.dropout1(y)

        y = self.conv2(y)
        y = self.norm2(y)
        y = self.dropout2(y)

        y = y + residual
        y = self.act2(y)
        return y


class TCNStack(nn.Module):
    """
    Stack nhiều residual TCN block với dilation tăng lũy thừa 2.
    Với window_size=20 và num_blocks=5, dilation 1,2,4,8,16 đủ rộng
    để model nhìn gần như toàn bộ cửa sổ.
    """

    def __init__(
        self,
        channels: int,
        num_blocks: int = 5,
        kernel_size: int = 3,
        dropout: float = 0.1,
        use_batch_norm: bool = True,
        activation: str = "gelu",
    ) -> None:
        super().__init__()
        blocks = []
        for i in range(num_blocks):
            dilation = 2 ** i
            blocks.append(
                TCNResidualBlock(
                    channels=channels,
                    kernel_size=kernel_size,
                    dilation=dilation,
                    dropout=dropout,
                    use_batch_norm=use_batch_norm,
                    activation=activation,
                )
            )
        self.blocks = nn.Sequential(*blocks)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.blocks(x)


# ============================================================
# 3. Model config
# ============================================================

@dataclass
class TCNModelConfig:
    categorical_columns: List[str]
    category_cardinalities: Dict[str, int]
    embedding_dims: Dict[str, int]

    continuous_input_dim: int
    real_continuous_dim: int
    binary_dim: int

    hidden_channels: int = 96
    latent_channels: int = 96
    num_tcn_blocks: int = 5
    kernel_size: int = 3
    dropout: float = 0.1
    use_batch_norm: bool = True
    activation: str = "gelu"


# ============================================================
# 4. TCN Autoencoder
# ============================================================

class WeldcomTCNAutoencoder(nn.Module):
    """
    TCN Autoencoder cho L1 Normal Behavior Deviation Detection.

    Input:
        cat:  LongTensor  [B, T, n_cat]
        cont: FloatTensor [B, T, n_cont_input]
              n_cont_input = real continuous + binary flags

    Output:
        {
            "continuous_recon": FloatTensor [B, T, real_continuous_dim],
            "binary_logits":    FloatTensor [B, T, binary_dim],
            "categorical_logits": Dict[col, FloatTensor [B, T, cardinality]]
        }

    Ý tưởng:
    - status_id, hour_of_day, day_of_week, location_id... dùng embedding.
    - numerical/flags đi qua linear projection.
    - TCN encoder học pattern chuỗi bình thường.
    - bottleneck latent ép model học cấu trúc nén.
    - TCN decoder tái tạo lại input bình thường.
    - Reconstruction error cao = lệch khỏi nền vận hành bình thường.
    """

    def __init__(self, cfg: TCNModelConfig) -> None:
        super().__init__()
        self.cfg = cfg

        self.categorical_columns = list(cfg.categorical_columns)
        self.category_cardinalities = dict(cfg.category_cardinalities)
        self.embedding_dims = dict(cfg.embedding_dims)

        # Embeddings
        self.embeddings = nn.ModuleDict()
        total_embedding_dim = 0

        for col in self.categorical_columns:
            cardinality = int(self.category_cardinalities[col])
            emb_dim = int(self.embedding_dims.get(col, 8))
            if cardinality <= 1:
                cardinality = 2

            self.embeddings[col] = nn.Embedding(
                num_embeddings=cardinality,
                embedding_dim=emb_dim,
                padding_idx=0,
            )
            total_embedding_dim += emb_dim

        input_dim = total_embedding_dim + int(cfg.continuous_input_dim)
        if input_dim <= 0:
            raise ValueError("Model input_dim must be positive.")

        self.input_projection = nn.Sequential(
            nn.Linear(input_dim, cfg.hidden_channels),
            nn.LayerNorm(cfg.hidden_channels),
            get_activation(cfg.activation),
            nn.Dropout(cfg.dropout),
        )

        # Encoder TCN
        self.encoder_tcn = TCNStack(
            channels=cfg.hidden_channels,
            num_blocks=cfg.num_tcn_blocks,
            kernel_size=cfg.kernel_size,
            dropout=cfg.dropout,
            use_batch_norm=cfg.use_batch_norm,
            activation=cfg.activation,
        )

        self.to_latent = nn.Sequential(
            nn.Conv1d(cfg.hidden_channels, cfg.latent_channels, kernel_size=1),
            nn.BatchNorm1d(cfg.latent_channels) if cfg.use_batch_norm else nn.GroupNorm(1, cfg.latent_channels),
            get_activation(cfg.activation),
        )

        # Decoder TCN
        self.from_latent = nn.Sequential(
            nn.Conv1d(cfg.latent_channels, cfg.hidden_channels, kernel_size=1),
            nn.BatchNorm1d(cfg.hidden_channels) if cfg.use_batch_norm else nn.GroupNorm(1, cfg.hidden_channels),
            get_activation(cfg.activation),
        )

        self.decoder_tcn = TCNStack(
            channels=cfg.hidden_channels,
            num_blocks=cfg.num_tcn_blocks,
            kernel_size=cfg.kernel_size,
            dropout=cfg.dropout,
            use_batch_norm=cfg.use_batch_norm,
            activation=cfg.activation,
        )

        # Reconstruction heads
        self.continuous_head = nn.Linear(cfg.hidden_channels, cfg.real_continuous_dim) \
            if cfg.real_continuous_dim > 0 else None

        self.binary_head = nn.Linear(cfg.hidden_channels, cfg.binary_dim) \
            if cfg.binary_dim > 0 else None

        self.categorical_heads = nn.ModuleDict()
        for col in self.categorical_columns:
            cardinality = int(self.category_cardinalities[col])
            if cardinality <= 1:
                cardinality = 2
            self.categorical_heads[col] = nn.Linear(cfg.hidden_channels, cardinality)

        self._init_head_weights()

    def _init_head_weights(self) -> None:
        for head in [self.continuous_head, self.binary_head]:
            if head is not None:
                nn.init.xavier_uniform_(head.weight)
                nn.init.zeros_(head.bias)

        for head in self.categorical_heads.values():
            nn.init.xavier_uniform_(head.weight)
            nn.init.zeros_(head.bias)

    @classmethod
    def from_preprocessor_and_config(cls, preprocessor: Any, cfg_dict: Dict[str, Any]) -> "WeldcomTCNAutoencoder":
        """
        Build model từ L1FeaturePreprocessor đã fit + YAML config.
        Hàm này sẽ được dùng trong train.py batch tiếp theo.
        """
        model_cfg = cfg_dict.get("model", {})
        data_cfg = cfg_dict.get("data", {})

        categorical_columns = list(data_cfg.get("categorical_columns", []))
        continuous_columns = list(data_cfg.get("continuous_columns", []))
        binary_columns = list(data_cfg.get("binary_columns", []))

        embedding_default = int(model_cfg.get("embedding_dim_default", 8))
        overrides = dict(model_cfg.get("embedding_dim_overrides", {}))

        embedding_dims = {
            col: int(overrides.get(col, embedding_default))
            for col in categorical_columns
        }

        category_cardinalities = dict(preprocessor.category_cardinalities)

        cfg = TCNModelConfig(
            categorical_columns=categorical_columns,
            category_cardinalities=category_cardinalities,
            embedding_dims=embedding_dims,
            continuous_input_dim=len(continuous_columns) + len(binary_columns),
            real_continuous_dim=len(continuous_columns),
            binary_dim=len(binary_columns),
            hidden_channels=int(model_cfg.get("hidden_channels", 96)),
            latent_channels=int(model_cfg.get("latent_channels", 96)),
            num_tcn_blocks=int(model_cfg.get("num_tcn_blocks", 5)),
            kernel_size=int(model_cfg.get("kernel_size", 3)),
            dropout=float(model_cfg.get("dropout", 0.1)),
            use_batch_norm=bool(model_cfg.get("use_batch_norm", True)),
            activation=str(model_cfg.get("activation", "gelu")),
        )
        return cls(cfg)

    def encode_input(self, cat: torch.Tensor, cont: torch.Tensor) -> torch.Tensor:
        """
        Return tensor [B, T, input_dim].
        """
        pieces = []

        if len(self.categorical_columns) > 0:
            if cat.ndim != 3:
                raise ValueError(f"cat must be [B,T,n_cat], got {cat.shape}")

            for i, col in enumerate(self.categorical_columns):
                x = cat[:, :, i]
                cardinality = self.embeddings[col].num_embeddings
                # Safety clamp để tránh crash nếu gặp category id ngoài vocab.
                x = torch.clamp(x, min=0, max=cardinality - 1)
                emb = self.embeddings[col](x)
                pieces.append(emb)

        if cont is not None and cont.shape[-1] > 0:
            pieces.append(cont.float())

        if not pieces:
            raise ValueError("No input features provided.")

        return torch.cat(pieces, dim=-1)

    def forward(self, cat: torch.Tensor, cont: torch.Tensor) -> Dict[str, Any]:
        # [B, T, input_dim]
        x = self.encode_input(cat, cont)

        # Project per timestep.
        h = self.input_projection(x)  # [B, T, C]

        # TCN expects [B, C, T]
        h = h.transpose(1, 2).contiguous()

        z = self.encoder_tcn(h)
        z = self.to_latent(z)

        y = self.from_latent(z)
        y = self.decoder_tcn(y)

        # Back to [B, T, C]
        y = y.transpose(1, 2).contiguous()

        out: Dict[str, Any] = {}

        if self.continuous_head is not None:
            out["continuous_recon"] = self.continuous_head(y)
        else:
            out["continuous_recon"] = None

        if self.binary_head is not None:
            out["binary_logits"] = self.binary_head(y)
        else:
            out["binary_logits"] = None

        categorical_logits: Dict[str, torch.Tensor] = {}
        for col, head in self.categorical_heads.items():
            categorical_logits[col] = head(y)

        out["categorical_logits"] = categorical_logits
        out["latent"] = z.transpose(1, 2).contiguous()
        return out

    def count_parameters(self) -> Dict[str, int]:
        total = sum(p.numel() for p in self.parameters())
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return {"total": total, "trainable": trainable}
