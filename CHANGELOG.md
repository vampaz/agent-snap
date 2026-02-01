## v 0.10

- Foundation

## v 0.2.0

- Performance improvments
- Annotation popup UX: copy button, keyboard handling, viewport clamping, and **auto-resizing textarea**
- **Multi-image attachments**: support for up to 5 images per annotation with drag-and-drop and thumbnails
- **Edit popup copy action** for quick output capture during edits
- Attachment handling hardening (read failures, max-cap enforcement) with new unit coverage
- **Enhanced marker hover actions**: added an edit button directly on the marker hover state
- Faster marker and drag interactions via batching, caching, and index maps
- Accessibility improvements: aria labels, focus-visible styling, live region announcements
- Screenshot capture and copy timing fixes, reduced style inlining
- Output metadata capture gated by detail level
- Extension host element for Shadow DOM isolation
