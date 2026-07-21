from __future__ import annotations

import os
from pathlib import Path

import pytest

from inference.online.artifacts import RuntimePathResolutionError, resolve_runtime_path, resolve_runtime_project_root


ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize("working_directory", [
    ROOT,
    ROOT / "inference" / "online",
    ROOT / "backend",
])
def test_runtime_project_root_is_independent_of_working_directory(monkeypatch: pytest.MonkeyPatch, working_directory: Path) -> None:
    monkeypatch.chdir(working_directory)
    root = resolve_runtime_project_root({"artifacts": {"obad_root": "."}})
    assert root == ROOT.resolve()
    assert resolve_runtime_path(root, "modeling/l1_tcn/configs/base.yaml", artifact_role="l1_base_config") == (
        ROOT / "modeling/l1_tcn/configs/base.yaml"
    ).resolve()


def test_runtime_project_root_is_independent_of_external_working_directory(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    assert resolve_runtime_project_root({"artifacts": {"obad_root": "."}}) == ROOT.resolve()


def test_relative_and_absolute_runtime_paths_use_the_contract_root(tmp_path: Path) -> None:
    relative = resolve_runtime_path(ROOT, "modeling/l1_tcn/artifacts/lenient/model_best.pt", artifact_role="l1_lenient_model")
    assert relative == (ROOT / "modeling/l1_tcn/artifacts/lenient/model_best.pt").resolve()
    absolute = resolve_runtime_path(ROOT, tmp_path / "absolute.json", artifact_role="fixture")
    assert absolute == (tmp_path / "absolute.json").resolve()


def test_missing_runtime_path_has_structured_context() -> None:
    with pytest.raises(RuntimePathResolutionError) as exc:
        resolve_runtime_path(ROOT, "modeling/l1_tcn/artifacts/lenient/not-present", artifact_role="l1_lenient_model", require_exists=True)
    assert exc.value.details["error_code"] == "RUNTIME_REQUIRED_PATH_MISSING"
    assert exc.value.details["project_root"] == str(ROOT.resolve())
    assert exc.value.details["artifact_role"] == "l1_lenient_model"


def test_candidate_c_path_remains_rejected() -> None:
    from inference.online.l1_scorer import L1Scorer

    with pytest.raises(ValueError, match="Candidate C"):
        L1Scorer({"obad_root": str(ROOT), "l1_artifact_dir": "modeling/l1_tcn/artifacts_candidates/example"})
