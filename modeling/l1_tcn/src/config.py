from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict
import yaml


class ConfigError(RuntimeError):
    pass


def _deep_get(d: Dict[str, Any], path: str, default: Any = None) -> Any:
    cur: Any = d
    for part in path.split('.'):
        if not isinstance(cur, dict) or part not in cur:
            return default
        cur = cur[part]
    return cur


def load_yaml(path: str | Path) -> Dict[str, Any]:
    path = Path(path)
    if not path.exists():
        raise ConfigError(f'Config file not found: {path}')
    with path.open('r', encoding='utf-8') as f:
        cfg = yaml.safe_load(f)
    if not isinstance(cfg, dict):
        raise ConfigError(f'Invalid YAML config: {path}')
    return cfg


@dataclass(frozen=True)
class ProjectPaths:
    config_path: Path
    project_root: Path
    l1_full: Path
    strict_train: Path
    strict_calibration: Path
    strict_valid: Path
    strict_test: Path
    strict_artifact_dir: Path
    lenient_train: Path
    lenient_calibration: Path
    lenient_valid: Path
    lenient_test: Path
    lenient_artifact_dir: Path
    scored_dir: Path
    scored_output: Path


def resolve_path(raw: str | Path, base_dir: Path) -> Path:
    p = Path(raw)
    if not p.is_absolute():
        p = (base_dir / p).resolve()
    return p


def build_paths(cfg: Dict[str, Any], config_path: str | Path) -> ProjectPaths:
    config_path = Path(config_path).resolve()
    config_dir = config_path.parent
    raw_root = _deep_get(cfg, 'paths.project_root', '../..')
    project_root = resolve_path(raw_root, config_dir)

    def rp(key: str) -> Path:
        raw = _deep_get(cfg, key)
        if raw is None:
            raise ConfigError(f'Missing config key: {key}')
        return resolve_path(raw, config_dir)

    return ProjectPaths(
        config_path=config_path,
        project_root=project_root,
        l1_full=rp('paths.l1_full'),
        strict_train=rp('paths.strict.train'),
        strict_calibration=resolve_path(_deep_get(cfg, 'paths.strict.calibration', _deep_get(cfg, 'paths.strict.valid')), config_dir),
        strict_valid=rp('paths.strict.valid'),
        strict_test=rp('paths.strict.test'),
        strict_artifact_dir=rp('paths.strict.artifact_dir'),
        lenient_train=rp('paths.lenient.train'),
        lenient_calibration=resolve_path(_deep_get(cfg, 'paths.lenient.calibration', _deep_get(cfg, 'paths.lenient.valid')), config_dir),
        lenient_valid=rp('paths.lenient.valid'),
        lenient_test=rp('paths.lenient.test'),
        lenient_artifact_dir=rp('paths.lenient.artifact_dir'),
        scored_dir=rp('paths.scored_dir'),
        scored_output=rp('paths.scored_output'),
    )


def validate_paths_for_training(paths: ProjectPaths, profile: str) -> None:
    if profile not in {'strict', 'lenient'}:
        raise ConfigError("profile must be either 'strict' or 'lenient'")
    required = {
        'strict': [paths.strict_train, paths.strict_valid, paths.strict_test],
        'lenient': [paths.lenient_train, paths.lenient_valid, paths.lenient_test],
    }[profile]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise ConfigError('Missing dataset files for profile=' + profile + ':\n' + '\n'.join(missing))
    artifact_dir = paths.strict_artifact_dir if profile == 'strict' else paths.lenient_artifact_dir
    artifact_dir.mkdir(parents=True, exist_ok=True)


def get_profile_paths(paths: ProjectPaths, profile: str) -> Dict[str, Path]:
    if profile == 'strict':
        return {'train': paths.strict_train, 'calibration': paths.strict_calibration, 'valid': paths.strict_valid, 'test': paths.strict_test, 'artifact_dir': paths.strict_artifact_dir}
    if profile == 'lenient':
        return {'train': paths.lenient_train, 'calibration': paths.lenient_calibration, 'valid': paths.lenient_valid, 'test': paths.lenient_test, 'artifact_dir': paths.lenient_artifact_dir}
    raise ConfigError("profile must be either 'strict' or 'lenient'")
