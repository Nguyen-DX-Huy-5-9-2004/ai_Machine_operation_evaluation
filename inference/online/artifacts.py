from __future__ import annotations

from pathlib import Path
from typing import Any


def find_project_root(start: str | Path | None = None) -> Path:
    cur = Path(start or __file__).resolve()
    if cur.is_file():
        cur = cur.parent
    for parent in [cur, *cur.parents]:
        if (parent / "oBAD.ipynb").exists() or (parent / ".git").exists():
            return parent
    return Path.cwd().resolve()


def load_config(path: str | Path) -> dict[str, Any]:
    try:
        import yaml
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Missing dependency PyYAML. Install realtime dependencies with: "
            "python -m pip install -r requirements2.txt"
        ) from exc

    config_path = Path(path)
    if not config_path.is_absolute():
        config_path = (Path.cwd() / config_path).resolve()
    with config_path.open("r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    if not isinstance(cfg, dict):
        raise ValueError(f"Invalid YAML config: {config_path}")
    cfg["_config_path"] = str(config_path)
    return cfg


def resolve_obad_root(cfg: dict[str, Any]) -> Path:
    raw_root = cfg.get("artifacts", {}).get("obad_root", ".")
    root = Path(str(raw_root))
    if not root.is_absolute():
        config_dir = Path(str(cfg.get("_config_path", "."))).resolve().parent
        root = (config_dir / root).resolve()
    return root
