from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Awaitable, Callable

ParentValidator = Callable[[str], Awaitable[None]]


@dataclass(frozen=True)
class TargetDescriptor:
    target_type: str
    label: str
    namespace: str
    deep_link_template: str
    requires_existing_parent: bool = False
    parent_validator: ParentValidator | None = None
    policy_resolver: str | None = None
    document_title_hint: str | None = None
    is_enabled: bool = True


class TargetRegistry:
    def __init__(self) -> None:
        self._targets: dict[str, TargetDescriptor] = {}

    def register_target(self, target_type: str, descriptor: TargetDescriptor) -> None:
        normalized_type = target_type.strip()
        if not normalized_type:
            raise ValueError("target_type must not be blank")
        if not descriptor.label.strip():
            raise ValueError("descriptor.label must not be blank")
        if not descriptor.namespace.strip():
            raise ValueError("descriptor.namespace must not be blank")
        if not descriptor.deep_link_template.strip():
            raise ValueError("descriptor.deep_link_template must not be blank")
        normalized_descriptor = replace(
            descriptor,
            target_type=normalized_type,
            label=descriptor.label.strip(),
            namespace=descriptor.namespace.strip(),
            deep_link_template=descriptor.deep_link_template.strip(),
            policy_resolver=descriptor.policy_resolver.strip() if descriptor.policy_resolver else None,
            document_title_hint=descriptor.document_title_hint.strip() if descriptor.document_title_hint else None,
        )
        self._targets[normalized_type] = normalized_descriptor

    def unregister_target(self, target_type: str) -> None:
        self._targets.pop(target_type.strip(), None)

    def get_target_descriptor(self, target_type: str) -> TargetDescriptor:
        normalized_type = target_type.strip()
        if normalized_type not in self._targets:
            raise KeyError(normalized_type)
        return self._targets[normalized_type]

    def list_registered_targets(self) -> list[TargetDescriptor]:
        return list(self._targets.values())

    def build_deep_link(self, target_type: str, target_id: str) -> str:
        descriptor = self.get_target_descriptor(target_type)
        return descriptor.deep_link_template.format(target_id=target_id)


def register_udms_targets(registry: TargetRegistry, repository: Any) -> None:
    async def validate_board_parent(target_id: str) -> None:
        await repository.get_board(target_id)

    registry.register_target(
        "Board",
        TargetDescriptor(
            target_type="Board",
            label="Board",
            namespace="board",
            deep_link_template="/udms/boards?targetId={target_id}",
            requires_existing_parent=True,
            parent_validator=validate_board_parent,
            policy_resolver="udms.board.policy",
            document_title_hint="Board document",
            is_enabled=True,
        ),
    )
    registry.register_target(
        "Approval",
        TargetDescriptor(
            target_type="Approval",
            label="Approval",
            namespace="approval",
            deep_link_template="/udms/approvals?targetId={target_id}",
            policy_resolver="udms.approval.policy",
            document_title_hint="Approval document",
            is_enabled=False,
        ),
    )
    registry.register_target(
        "Inventory",
        TargetDescriptor(
            target_type="Inventory",
            label="Inventory",
            namespace="inventory",
            deep_link_template="/dashboard?targetType=Inventory&targetId={target_id}",
            policy_resolver="udms.inventory.policy",
            document_title_hint="Inventory document",
            is_enabled=False,
        ),
    )
    registry.register_target(
        "Broadcast",
        TargetDescriptor(
            target_type="Broadcast",
            label="Broadcast",
            namespace="broadcast",
            deep_link_template="/dashboard?targetType=Broadcast&targetId={target_id}",
            policy_resolver="udms.broadcast.policy",
            document_title_hint="Broadcast document",
            is_enabled=False,
        ),
    )
    registry.register_target(
        "Project",
        TargetDescriptor(
            target_type="Project",
            label="Project",
            namespace="project",
            deep_link_template="/dashboard?targetType=Project&targetId={target_id}",
            policy_resolver="udms.project.policy",
            document_title_hint="Project document",
            is_enabled=False,
        ),
    )
    registry.register_target(
        "User",
        TargetDescriptor(
            target_type="User",
            label="User",
            namespace="user",
            deep_link_template="/dashboard?targetType=User&targetId={target_id}",
            policy_resolver="udms.user.policy",
            document_title_hint="User document",
            is_enabled=False,
        ),
    )
