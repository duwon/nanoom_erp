from __future__ import annotations

from app.modules.udms.targets import TargetDescriptor, TargetRegistry


def register_worship_targets(registry: TargetRegistry) -> None:
    registry.register_target(
        "WorshipOrder",
        TargetDescriptor(
            target_type="WorshipOrder",
            label="Worship Order",
            namespace="worship-order",
            deep_link_template="/worship/orders?targetId={target_id}",
            policy_resolver="worship.order.policy",
            document_title_hint="Worship order document",
            is_enabled=False,
        ),
    )
    registry.register_target(
        "WorshipContent",
        TargetDescriptor(
            target_type="WorshipContent",
            label="Worship Content",
            namespace="worship-content",
            deep_link_template="/worship/contents?targetId={target_id}",
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
            deep_link_template="/worship/subtitles/input?targetId={target_id}",
            policy_resolver="worship.subtitle.policy",
            document_title_hint="Subtitle document",
            is_enabled=False,
        ),
    )
