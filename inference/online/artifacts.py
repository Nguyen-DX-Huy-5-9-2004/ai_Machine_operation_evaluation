from __future__ import annotations

import os
from pathlib import Path
from typing import Any


PROJECT_ROOT_ENVIRONMENT_VARIABLE = "OBAD_PROJECT_ROOT"
SQL_USER_ENVIRONMENT_VARIABLE = "OBAD_SQL_USER"
SQL_PASSWORD_ENVIRONMENT_VARIABLE = "OBAD_SQL_PASSWORD"


class RuntimePathResolutionError(FileNotFoundError):
    """A required runtime file could not be resolved under the OBAD root."""

    def __init__(self, *, error_code: str, requested_path: str | Path, resolved_path: Path, project_root: Path, artifact_role: str) -> None:
        self.details = {
            "error_code": error_code,
            "requested_path": str(requested_path),
            "resolved_path": str(resolved_path),
            "project_root": str(project_root),
            "artifact_role": artifact_role,
        }
        super().__init__(str(self.details))


def find_project_root(start: str | Path | None = None) -> Path:
    cur = Path(start or __file__).resolve()
    if cur.is_file():
        cur = cur.parent
    for parent in [cur, *cur.parents]:
        if (parent / "oBAD.ipynb").exists() or (parent / ".git").exists():
            return parent
    return Path(__file__).resolve().parents[2]


def _repository_root_from(start: Path) -> Path | None:
    for candidate in [start, *start.parents]:
        if (candidate / "data").is_dir() and (candidate / "modeling").is_dir():
            return candidate.resolve()
    return None


def resolve_runtime_project_root(cfg: dict[str, Any] | None = None) -> Path:
    """Resolve the repository root without using the process working directory.

    A configured absolute root wins. Relative configuration is interpreted as a
    repository hint and then normalized by walking upward from the config/source.
    """
    cfg = cfg or {}
    project = cfg.get("project", {}) if isinstance(cfg.get("project", {}), dict) else {}
    artifacts = cfg.get("artifacts", {}) if isinstance(cfg.get("artifacts", {}), dict) else cfg
    raw = project.get("root") or artifacts.get("project_root") or artifacts.get("obad_root")
    env_root = os.environ.get(PROJECT_ROOT_ENVIRONMENT_VARIABLE)
    candidates: list[Path] = []
    if raw and str(raw).strip() not in {".", "./"}:
        configured = Path(str(raw)).expanduser()
        if configured.is_absolute():
            return configured.resolve()
    if env_root:
        return Path(env_root).expanduser().resolve()
    config_path = cfg.get("_config_path")
    if config_path:
        candidates.append(Path(str(config_path)).resolve().parent)
    candidates.append(Path(__file__).resolve().parent)
    for candidate in candidates:
        found = _repository_root_from(candidate.resolve())
        if found is not None:
            return found
    # The source layout is part of the runtime contract; this fallback remains
    # independent of CWD even in a partially relocated project.
    return Path(__file__).resolve().parents[2]


def resolve_runtime_path(project_root: Path, raw_path: str | Path, *, artifact_role: str, require_exists: bool = False) -> Path:
    requested = Path(raw_path)
    resolved = requested.resolve() if requested.is_absolute() else (project_root / requested).resolve()
    if require_exists and not resolved.exists():
        raise RuntimePathResolutionError(
            error_code="RUNTIME_REQUIRED_PATH_MISSING",
            requested_path=raw_path,
            resolved_path=resolved,
            project_root=project_root,
            artifact_role=artifact_role,
        )
    return resolved


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
    _hydrate_blank_database_credentials(cfg)
    cfg["_config_path"] = str(config_path)
    return cfg


def _hydrate_blank_database_credentials(cfg: dict[str, Any]) -> None:
    """Fill blank local YAML credentials from process environment only.

    This keeps secrets out of tracked config while preserving an explicitly-set
    YAML value. Callers must not log the returned config or these values.
    """
    database = cfg.get("database")
    if not isinstance(database, dict):
        return
    for field, environment_variable in (
        ("username", SQL_USER_ENVIRONMENT_VARIABLE),
        ("password", SQL_PASSWORD_ENVIRONMENT_VARIABLE),
    ):
        if str(database.get(field) or "").strip():
            continue
        environment_value = os.environ.get(environment_variable)
        if environment_value:
            database[field] = environment_value


def resolve_obad_root(cfg: dict[str, Any]) -> Path:
    return resolve_runtime_project_root(cfg)
