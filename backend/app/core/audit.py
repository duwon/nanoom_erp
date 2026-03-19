from __future__ import annotations

from app.core.store import InMemoryAppStore


def append_audit_entry(
    store: InMemoryAppStore,
    *,
    action: str,
    target_type: str,
    target_id: str,
    actor_id: str,
    detail: str,
) -> None:
    store._audit(action, target_type, target_id, actor_id, detail)
