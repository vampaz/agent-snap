# Agent Snap Codebase Improvement Plan

## Goals

- Prevent runtime crashes in restricted storage environments.
- Improve correctness of tooltip placement and sticky element handling.
- Reduce risk of annotation ID collisions.
- Harden storage adapter usage.
- Improve maintainability and test coverage around interactive behavior.

## Scope

- `src/core/agent-snap.ts`
- `src/utils/storage.ts`
- `src/utils/element-identification.ts`
- Tests in `src/**.spec.ts`

## Phase 1 — Safety and Correctness (High Priority)

1. Guard all `localStorage` writes with `try/catch`.
   - Add a small helper for safe storage writes.
   - Update settings persistence and theme toggles.

2. Use collision-resistant IDs for annotations.
   - Prefer `crypto.randomUUID()` with fallback to timestamp + counter.

3. Harden adapter storage calls.
   - Wrap `adapter.load/save/clear` in `try/catch` and fail gracefully.

4. Fix tooltip positioning for non-fixed annotations.
   - Compute tooltip placement using viewport-relative `y` for non-fixed markers.

5. Review sticky element handling.
   - Distinguish `position: sticky` from `fixed` and decide how markers should follow.

## Phase 2 — UX Consistency (Medium Priority)

1. Align marker tooltip offsets with scroll position.
2. Improve multi-select feedback when selection is small or thin.
3. Consider a hover/selection debounce to reduce flicker on fast mousemove.

## Phase 3 — Maintainability (Medium Priority)

1. Refactor `agent-snap.ts` into focused modules:
   - `toolbar.ts` (controls, settings, theme)
   - `markers.ts` (marker render/hover logic)
   - `selection.ts` (click/drag selection)
   - `overlay.ts` (hover highlight + outlines)
2. Introduce a small internal event bus or shared state module to reduce cross-coupling.

## Tests

- Unit tests for safe storage and adapter error handling.
- Tooltip placement tests with scroll offsets.
- ID collision test (rapid successive adds).
- Sticky vs fixed behavior test in JSDOM (mocked styles).

## Rollout

1. Implement Phase 1 and add tests.
2. Validate in `playground/`.
3. Add Phase 2 enhancements.
4. Refactor Phase 3 with incremental commits.

## Out of Scope

- Changing external API shape.
- Adding framework dependencies.
