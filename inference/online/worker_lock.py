from __future__ import annotations

import json
import os
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Iterator


@contextmanager
def single_worker_lock(path: str | Path) -> Iterator[Path]:
    lock_path = Path(path).resolve()
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({"pid": os.getpid(), "started_at": datetime.now().isoformat()}, sort_keys=True)
    try:
        with lock_path.open("x", encoding="utf-8") as handle:
            handle.write(payload)
    except FileExistsError as exc:
        owner = lock_path.read_text(encoding="utf-8", errors="replace")
        raise RuntimeError(f"INFERENCE_WORKER_ALREADY_RUNNING: {lock_path}; owner={owner}") from exc
    try:
        yield lock_path
    finally:
        lock_path.unlink(missing_ok=True)
