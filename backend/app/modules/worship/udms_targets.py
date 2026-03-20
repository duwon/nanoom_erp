from __future__ import annotations

from app.modules.udms.targets import TargetDescriptor, TargetRegistry
from app.modules.worship.repository import WorshipRepository


def register_worship_targets(registry: TargetRegistry, repository: WorshipRepository) -> None:
    async def validate_worship_service(target_id: str) -> None:
        await repository.get_service(target_id)

    registry.register_target(
        "WorshipOrder",
        TargetDescriptor(
            target_type="WorshipOrder",
            label="Worship Order",
            namespace="worship-order",
            deep_link_template="/worship?serviceId={target_id}",
            requires_existing_parent=True,
            parent_validator=validate_worship_service,
            policy_resolver="worship.order.policy",
            document_title_hint="Worship order document",
            is_enabled=True,
        ),
    )
    registry.register_target(
        "WorshipContent",
        TargetDescriptor(
            target_type="WorshipContent",
            label="Worship Content",
            namespace="worship-content",
            deep_link_template="/worship/message?serviceId={target_id}",
            requires_existing_parent=True,
            parent_validator=validate_worship_service,
            policy_resolver="worship.content.policy",
            document_title_hint="Worship content document",
            is_enabled=False,
        ),
    )
    registry.register_target(
        "SubtitleContent",
        TargetDescriptor(
            target_type="SubtitleContent",
            label="Subtitle Content",
            namespace="subtitle-content",
            deep_link_template="/worship/songs?serviceId={target_id}",
            requires_existing_parent=True,
            parent_validator=validate_worship_service,
            policy_resolver="worship.subtitle.policy",
            document_title_hint="Subtitle document",
            is_enabled=False,
        ),
    )
