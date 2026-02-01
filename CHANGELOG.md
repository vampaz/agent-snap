## v 0.10

- Foundation
- Annotation popup: add include-screenshot checkbox defaulting to settings

## v 0.3.0

- Performance improvments
- Annotation popup UX: copy button, keyboard handling, viewport clamping, and **auto-resizing textarea**
- **Multi-image attachments**: support for up to 5 images per annotation with drag-and-drop and thumbnails
- **Edit popup copy action** for quick output capture during edits
- Attachment handling hardening (read failures, max-cap enforcement) with new unit coverage
- **Enhanced marker hover actions**: added an edit button directly on the marker hover state
- Faster marker and drag interactions via batching, caching, and index maps
- Accessibility improvements: aria labels, focus-visible styling, live region announcements
- Screenshot capture and copy timing fixes, reduced style inlining
- Screenshot accuracy improvements: form values/canvas state preserved, fixed-position handling, and background fallback
- Screenshot rendering cap with fallback cropping for oversized documents
- Screenshot output switched to JPEG at 0.9 quality for smaller payloads
- Screenshot unit coverage added for clone serialization
- Output metadata capture gated by detail level
- Extension host element for Shadow DOM isolation
