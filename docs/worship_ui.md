# Worship UI Flow

## Purpose
- The UI is still the same worship workspace.
- The storage layer underneath is now section-level UDMS documents.

## Main Screens
- Calendar: choose a date and a service.
- Service detail: edit service metadata and reorder sections.
- Section editors: edit song, scripture, message, notice, prayer, and media content.
- Guest input: submit structured content through a token link.
- Review and presentation: preview the current section documents and activate display output.

## Behavior
- `WorshipOrder` is the service-level canonical document.
- Each visible section is backed by its own UDMS document.
- Section edits, guest input, and review all update the linked section document first.
- After section updates, the order document is touched so the service version advances once.
- Generic UDMS pages should not be used for section documents.

## UI Notes
- Keep the current route structure and API calls.
- Treat the order document as the service summary and the section documents as the editable source of truth.
- The display and presentation views should continue to read from the worship service API, not directly from generic UDMS pages.
