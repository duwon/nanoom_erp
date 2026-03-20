# Worship Storage and API

## Summary
- Worship canonical content now lives in UDMS documents.
- `worship_services` is an index and operational cache only.
- Public endpoints stay the same:
  - `/api/v1/worship/*`
  - `/api/order-items*`
  - `/api/display-state`
  - `/ws/display`

## Canonical Data
- One `WorshipOrder` document is created per service.
- One section document is created per worship section.
- Section types map to UDMS targets as follows:
  - `song`, `special_song` -> `SubtitleContent`
  - `scripture`, `message`, `notice`, `media`, `prayer` -> `WorshipContent`
- `WorshipOrder.module_data` stores:
  - `service_meta`
  - `section_order`
  - `task_defs`
  - `section_refs`
- Section document `module_data` stores:
  - `service_id`
  - `section_id`
  - `section_type`
  - `title`
  - `detail`
  - `role`
  - `assignee`
  - `status`
  - `duration_minutes`
  - `template_key`
  - `notes`
  - `content`
  - `slides`
  - `updated_at`

## Worship Index Cache
- `worship_services` keeps:
  - `id`, `date`, `service_kind`, `template_id`, `service_name`, `start_at`, `summary`
  - `order_document_id`, `section_document_ids`, `task_guest_access`
  - `status`, `review_summary`, `export_snapshot`, `metadata`
- The cache still exposes the same worship API payloads.
- Versioning now follows the `WorshipOrder` document revision version.

## Cutover
- Startup resets worship service state and presentation state.
- Worship UDMS documents and policies are deleted and re-seeded on materialization.
- Existing worship operational data is not migrated.

## Visibility Rules
- Generic UDMS lists show only `WorshipOrder`.
- Section documents are hidden from generic UDMS read paths.
- Worship APIs still read and write section documents internally.

## Tests
- Materialization creates one order document plus one document per section.
- Worship service reads still return the previous API shape.
- Section edits and guest input update the linked UDMS documents.
- Reorder and service metadata edits bump the order document version once.
