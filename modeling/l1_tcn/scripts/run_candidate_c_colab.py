"""Single, fail-fast Colab entrypoint for an immutable L1 Candidate C package."""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


def project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _relative_or_absolute(path: Path, root: Path) -> str:
    try:
        return str(path.resolve().relative_to(root.resolve()))
    except ValueError:
        return str(path.resolve())


def run(command: list[str], root: Path, *, action: str, source_snapshot: Path | None = None,
        candidate_package: Path | None = None, resume: bool = False) -> None:
    """Run a child command with an actionable failure report for Colab users."""
    details = {
        "action": action,
        "command": command,
        "cwd": str(root),
        "source_snapshot": str(source_snapshot) if source_snapshot else None,
        "candidate_package": str(candidate_package) if candidate_package else None,
        "resume": resume,
    }
    print("candidate_c_runner:", json.dumps(details, ensure_ascii=True), flush=True)
    try:
        completed = subprocess.run(
            command,
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        print("candidate_c_runner_failure:", json.dumps({
            "action": action,
            "return_code": exc.returncode,
            "command": exc.cmd,
            "stdout": exc.stdout,
            "stderr": exc.stderr,
        }, ensure_ascii=True), file=sys.stderr, flush=True)
        raise
    if completed.stdout:
        print(completed.stdout, end="", flush=True)
    if completed.stderr:
        print(completed.stderr, end="", file=sys.stderr, flush=True)


def _require(parser: argparse.ArgumentParser, action: str, value: str | None, argument: str) -> str:
    if not value:
        parser.error(f"action {action} requires {argument}")
    return value


def _package_path(root: Path, value: str) -> Path:
    path = Path(value)
    return path.resolve() if path.is_absolute() else (root / path).resolve()


def score_command(*arguments: str) -> list[str]:
    return [
        sys.executable,
        "-m",
        "inference.online.score_new_events",
        "--config",
        "inference/online/config.example.yaml",
        *arguments,
    ]


def validate_package(root: Path, package: Path) -> None:
    run(
        score_command("--validate-l1-retrain-package", "--candidate-package-dir", _relative_or_absolute(package, root)),
        root,
        action="validate-package",
        candidate_package=package,
    )


def assert_cuda(required: bool) -> None:
    if not required:
        return
    import torch

    available = bool(torch.cuda.is_available())
    print(json.dumps({"cuda_available": available, "device": torch.cuda.get_device_name(0) if available else None}))
    if not available:
        raise RuntimeError("Candidate C full training requires a Colab CUDA runtime.")


def train_profile(root: Path, package: Path, profile: str, device: str, resume: bool) -> None:
    config = package / "configs" / f"{profile}.yaml"
    if not config.exists():
        raise RuntimeError(f"Missing Candidate C config: {config}")
    # train.py takes its device setting from the immutable candidate config.
    # The runner still requires --device so the Colab invocation makes intent explicit.
    command = [sys.executable, "modeling/l1_tcn/src/train.py", "--config", _relative_or_absolute(config, root), "--profile", profile]
    if resume:
        command.append("--resume")
    run(command, root, action="train", candidate_package=package, resume=resume)


def validate_artifacts(root: Path, package: Path, profile: str | None = None) -> None:
    manifest = json.loads((package / "manifests" / "candidate_configs_manifest.json").read_text(encoding="utf-8"))
    run_id = manifest["run_id"]
    artifact = root / "modeling" / "l1_tcn" / "artifacts_candidates" / run_id / "current_only"
    profiles = [profile] if profile else ["lenient", "strict"]
    required = [artifact / item / name for item in profiles for name in ("model_best.pt", "preprocessor.json", "thresholds.json", "run_summary.json")]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise RuntimeError("Candidate artifact contract missing: " + ", ".join(missing))
    shutil.make_archive(str(package / f"{run_id}_artifacts"), "zip", artifact)
    print("artifact_zip=", package / f"{run_id}_artifacts.zip")


def main() -> int:
    parser = argparse.ArgumentParser(description="Candidate C Colab runner: snapshot preparation, validation, training and artifact audit.")
    parser.add_argument("action", choices=["prepare", "validate-source", "validate-package", "train", "validate-artifact", "evaluate", "all"])
    parser.add_argument("--package-dir", dest="candidate_package_dir", default=None)
    parser.add_argument("--candidate-package-dir", dest="candidate_package_dir", default=None)
    parser.add_argument("--source-snapshot-dir", default=None)
    parser.add_argument("--source-mode", choices=["snapshot"], default="snapshot")
    parser.add_argument("--candidate-run-id", default=None)
    parser.add_argument("--adaptation-audit-dir", default=None)
    parser.add_argument("--candidate-artifact-dir", default=None)
    parser.add_argument("--profile", choices=["lenient", "strict"], default=None)
    parser.add_argument("--device", choices=["cuda", "cpu"], default=None)
    parser.add_argument("--require-cuda", action="store_true")
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume Candidate C package preparation or training from valid checkpoints.",
    )
    args = parser.parse_args()
    root = project_root()

    if args.action == "validate-source":
        snapshot = _package_path(root, _require(parser, args.action, args.source_snapshot_dir, "--source-snapshot-dir"))
        run(
            score_command("--validate-l1-candidate-source-snapshot", "--snapshot-dir", _relative_or_absolute(snapshot, root)),
            root,
            action=args.action,
            source_snapshot=snapshot,
            resume=args.resume,
        )
        return 0

    if args.action == "prepare":
        if args.source_mode != "snapshot":
            parser.error("action prepare requires --source-mode snapshot")
        snapshot = _package_path(root, _require(parser, args.action, args.source_snapshot_dir, "--source-snapshot-dir"))
        adaptation = _package_path(root, _require(parser, args.action, args.adaptation_audit_dir, "--adaptation-audit-dir"))
        run_id = _require(parser, args.action, args.candidate_run_id, "--candidate-run-id")
        package = _package_path(root, _require(parser, args.action, args.candidate_package_dir, "--candidate-package-dir"))
        command = score_command(
            "--prepare-l1-retrain-candidate-from-snapshot",
            "--source-snapshot-dir", _relative_or_absolute(snapshot, root),
            "--adaptation-audit-dir", _relative_or_absolute(adaptation, root),
            "--candidate-run-id", run_id,
            "--candidate-package-dir", _relative_or_absolute(package, root),
        )
        if args.resume:
            command.append("--resume")
        run(command, root, action=args.action, source_snapshot=snapshot, candidate_package=package, resume=args.resume)
        return 0

    package = _package_path(root, _require(parser, args.action, args.candidate_package_dir, "--candidate-package-dir"))
    if args.action == "validate-package":
        validate_package(root, package)
    elif args.action == "train":
        profile = _require(parser, args.action, args.profile, "--profile")
        device = _require(parser, args.action, args.device, "--device")
        assert_cuda(args.require_cuda or device == "cuda")
        validate_package(root, package)
        train_profile(root, package, profile, device, args.resume)
    elif args.action == "validate-artifact":
        validate_artifacts(root, package, args.profile)
    elif args.action == "evaluate":
        adaptation = _package_path(root, _require(parser, args.action, args.adaptation_audit_dir, "--adaptation-audit-dir"))
        artifact = _package_path(root, _require(parser, args.action, args.candidate_artifact_dir, "--candidate-artifact-dir"))
        run(
            score_command(
                "--evaluate-l1-retrain-candidate",
                "--candidate-package-dir", _relative_or_absolute(package, root),
                "--candidate-artifact-dir", _relative_or_absolute(artifact, root),
                "--adaptation-audit-dir", _relative_or_absolute(adaptation, root),
            ),
            root,
            action=args.action,
            candidate_package=package,
            resume=args.resume,
        )
    else:
        source = _package_path(root, _require(parser, args.action, args.source_snapshot_dir, "--source-snapshot-dir"))
        adaptation = _package_path(root, _require(parser, args.action, args.adaptation_audit_dir, "--adaptation-audit-dir"))
        run_id = _require(parser, args.action, args.candidate_run_id, "--candidate-run-id")
        prepare = score_command(
            "--prepare-l1-retrain-candidate-from-snapshot",
            "--source-snapshot-dir", _relative_or_absolute(source, root),
            "--adaptation-audit-dir", _relative_or_absolute(adaptation, root),
            "--candidate-run-id", run_id,
            "--candidate-package-dir", _relative_or_absolute(package, root),
        )
        if args.resume:
            prepare.append("--resume")
        run(prepare, root, action="prepare", source_snapshot=source, candidate_package=package, resume=args.resume)
        validate_package(root, package)
        assert_cuda(args.require_cuda)
        for profile in ("lenient", "strict"):
            train_profile(root, package, profile, args.device or "cuda", args.resume)
        validate_artifacts(root, package)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
