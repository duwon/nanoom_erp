from __future__ import annotations

from fastapi import HTTPException, status


def ensure_roles(user_roles: list[str] | str | None, required_roles: set[str]) -> None:
    if isinstance(user_roles, str):
        actual_roles = {user_roles}
    else:
        actual_roles = set(user_roles or [])

    if required_roles.intersection(actual_roles):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions",
    )
