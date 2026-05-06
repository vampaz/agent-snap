## v 0.6.0

- Extension screenshots: use Chrome debugger/CDP capture for rendered tab pixels, with the existing visible-tab capture as a fallback.
- Extension permissions: add the `debugger` permission so Agent Snap can request a native page screenshot from Chrome when exporting annotations.
- Screenshot capture: keep the existing serializer as the primary module/Vite path and use SnapDOM only as a fallback.
- Vite plugin: save one Markdown file per copied annotation when exporting multiple annotations, matching the existing per-screenshot asset output.

## v 0.5.3

- Vite plugin and module screenshots: capture the annotated page rectangle in the portable DOM renderer instead of cloning only the selected element, fixing blank screenshots when the selected node is a decorative background layer.
- Vite plugin and module screenshots: preserve full page layout before cropping so selected sections render like the browser area instead of shifting after offscreen siblings are pruned.
- Tests: add regression coverage for multiple selected DOM areas, including background layers, full sections, and controls compared against the browser-rendered area.

## v 0.5.2

- Extension screenshots: capture native rendered tab pixels and crop to the annotated area so styles and elements match the browser output.
- Core API: add an optional screenshot capture provider hook while keeping the existing portable DOM/SVG fallback for module and Vite plugin usage.

## v 0.5.1

- Vite plugin: preserve Node built-in imports in `agent-snap/vite` package output so local snapshot saving works in client Vite dev servers.

## v 0.5.0

- Vite plugin: add `agent-snap/vite` dev-server plugin that injects Agent Snap automatically in Vite serve mode.
- Local snapshot saving: copied snapshots are written under `agent-snapshots/` with the same basename as the primary screenshot and project-root-relative asset paths.
- Local asset materialization: screenshots and attachments are saved next to their Markdown snapshot, including both base64 and URL-backed assets; plugin-saved Markdown strips embedded payloads and points agents at file-system paths.
- Playground: add `npm run dev:plugin` mode to exercise plugin injection without the manual playground mount.
- Tests: add Vite plugin unit coverage and an end-to-end browser test that verifies Markdown and screenshot files are written to disk.

## v 0.10

- Foundation
- Annotation popup: add include-screenshot checkbox defaulting to settings

## v 0.4.0

- Upload mode: default on with toggle; waits for uploads, falls back to base64 on failure
- Upload quota UI: 50/day service messaging, unlimited with key, infinity counter when no limit
- Popup copy UX: spinner + inline error message on upload failure
- Help tooltips: upload help icon + tooltips above icons
- Output assets: no base64 when upload succeeds, copy waits for uploads
- E2E: add upload-failure inline error test

## v 0.3.0

- Performance improvments
- Settings panel: render screenshot daily availability as `remaining/total` (or `∞` when unused)
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
