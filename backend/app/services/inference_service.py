from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from backend.app.config import get_settings


def run_stage_only(max_events: int = 100) -> dict[str, object]:
    config_path = get_settings().realtime_config_path
    cmd = [
        sys.executable,
        "-m",
        "inference.online.score_new_events",
        "--config",
        str(config_path),
        "--stage-only",
        "--max-events",
        str(max_events),
    ]
    proc = subprocess.run(cmd, cwd=Path.cwd(), text=True, capture_output=True, check=False)
    return {
        "returncode": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }
