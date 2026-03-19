from __future__ import annotations

from pathlib import Path


def ensure_storage_path(base_path: str | Path) -> Path:
    path = Path(base_path)
    path.mkdir(parents=True, exist_ok=True)
    return path
