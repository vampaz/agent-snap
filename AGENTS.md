# Project Context for Agents

## Overview

This repository (`agent-snap`) is a framework-agnostic DOM snapshot and annotation toolbar. It runs in any web page using vanilla TypeScript and native DOM APIs. The library overlays a toolbar, lets users annotate elements, and exports a structured Markdown snapshot.

## Tech Stack

- Language: TypeScript
- Build: Vite (library mode)
- Testing: Vitest + JSDOM
- Lint/format: oxlint + oxfmt
- Styling: CSS injected at runtime (no external CSS for consumers)
- Frameworks: none (do not add React/Vue/Svelte in `src` or `playground`)

## Public API

- `createAgentSnap(options)` creates the UI and returns an instance with `destroy`, `setSettings`, `getAnnotations`, and `copyOutput`.
- `registerAgentSnapElement()` registers the `<agent-snap>` custom element.

### `createAgentSnap` options

- `mount`: `HTMLElement | ShadowRoot | string` (selector); defaults to `document.body`.
- `initialTheme`: `'dark' | 'light'`.
- `zIndex`: number.
- `settings`: partial settings object.
- `storageAdapter`: custom persistence adapter.
- `copyToClipboard`: boolean (defaults to true).
- Callbacks: `onAnnotationAdd`, `onAnnotationDelete`, `onAnnotationUpdate`, `onAnnotationsClear`, `onCopy`.

### Settings (`AgentSnapSettings`)

- `outputDetail`: `'standard' | 'detailed' | 'forensic'`.
- `autoClearAfterCopy`: boolean.
- `annotationColor`: hex string.
- `blockInteractions`: boolean.
- `captureScreenshots`: boolean.

### Custom element attributes

- `theme`, `annotation-color`, `output-detail`, `auto-clear-after-copy`, `block-interactions`,
  `capture-screenshots`, `z-index`.

## Data Model and Output

- `Annotation` lives in `src/types.ts` and includes geometry, element path, context text, and optional screenshot data.
- Output generation is in `src/utils/output.ts`.
  - `standard` includes location and comment.
  - `detailed` adds class names, bounding box, and nearby text.
  - `forensic` adds environment info, full paths, styles, accessibility, and nearby elements.
- Storage is in `src/utils/storage.ts` and defaults to `localStorage` with a 7-day retention per pathname.

## Project Structure

- `src/`
  - `core/`: Runtime orchestration (`agent-snap.ts`) and UI logic (`toolbar.ts`, `markers.ts`, `overlay.ts`, `selection.ts`).
  - `ui/`: DOM component builders (`popup.ts`).
  - `utils/`: Element identification, output generation, storage, styles, i18n.
  - `icons/`: Inline SVG builders (DOM-based, no external assets).
  - `styles/`: `agent-snap.css` injected at runtime.
  - `i18n/`: `en-GB.json` strings; use `t()` from `src/utils/i18n.ts`.
  - `types.ts`: Shared types.
  - `index.ts`: Public exports.
- `extension/`: Manifest V3 extension wrapper.
  - `background.js` injects `content-script.js` and sends `TOGGLE_AGENT_SNAP`.
  - `content-script.js` imports `dist/index.mjs` and stores instance on `globalThis.__agentSnapInstance`.
- `playground/`: Manual test harness (Vite, alias `@` to `src`, custom CSS loader).
- `scripts/`: Asset/demo generation helpers (via `npm run generate:*`).
- `dist/`: Build output (generated, do not edit by hand).

## Coding Conventions

- Use vanilla DOM APIs (`document.createElement`, `appendChild`, etc.).
- Keep UI strings in `src/i18n/en-GB.json` and access via `t()`.
- Avoid global CSS collisions; prefer `applyInlineStyles` for dynamic styling.
- Use ESM imports; do not use `require()`.
- Use single quotes for strings to match the codebase.

## Maintenance

- Update this file when significant changes alter architecture, public APIs, or project structure.

## Where to Change What

- Toolbar UI/behavior: `src/core/toolbar.ts`, `src/styles/agent-snap.css`.
- Marker rendering and actions: `src/core/markers.ts`.
- Hover/overlay visuals: `src/core/overlay.ts`.
- Drag selection behavior: `src/core/selection.ts`.
- Output format: `src/utils/output.ts`.
- Element naming/path rules: `src/utils/element-identification.ts`.
- Persistence and retention: `src/utils/storage.ts`.
- Popup UI: `src/ui/popup.ts`.

## Styling and DOM Conventions

- Styles are in `src/styles/agent-snap.css` and injected by `core/agent-snap.ts` via `?inline`.
- Internal nodes must carry `data-agent-snap` to avoid capturing the tool itself.
- Markers use `data-annotation-marker` and tests use `data-testid` attributes.
- Prefer `applyInlineStyles` for dynamic style objects.

## Behavior Notes

- Shadow DOM is supported via deep `elementsFromPoint` and `querySelectorAll` traversal.
- Drag selection logic lives in `src/core/selection.ts`.
- Screenshot capture clones the DOM and renders to a data URL (see `createAgentSnap` in `src/core/agent-snap.ts`).

## Development Workflow

- Build: `npm run build`
- Watch: `npm run watch`
- Test: `npm run test`
- Lint/format: `npm run lint`, `npm run fmt`
- Extension build: `npm run build:ext`

## Playground

- `playground/vite.config.ts` aliases `@` to `src` and loads `agent-snap.css` as a raw string for dev.
- The playground imports directly from `src` for rapid iteration.

## Extension

- `extension/background.js` injects `content-script.js` on click and sends `TOGGLE_AGENT_SNAP`.
- `extension/content-script.js` dynamically imports `dist/index.mjs` and stores the instance on `globalThis.__agentSnapInstance`.

## Testing

- Unit tests live next to source files as `*.spec.ts`.
- Test environment is Vitest + JSDOM.
