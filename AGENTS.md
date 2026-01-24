# Project Context for Agents

## Overview
This repository (`agent-snap`) is a **framework-agnostic** library that implements a UI annotation toolbar. It is designed to be a drop-in clone of existing annotation tools but with zero dependencies on frameworks like React or Vue. It uses vanilla TypeScript and native DOM APIs.

## Tech Stack
- **Language**: TypeScript
- **Build Tool**: Vite (Library mode)
- **Testing**: Vitest, JSDOM
- **Styling**: SCSS/CSS (Injected at runtime, no external CSS file requirement for consumers)
- **Frameworks**: NONE. Do not use React, Vue, Svelte, etc. in `src` or `playground`.

## Project Structure
- `src/`
  - `core/`: State management (`state.ts`), orchestrator (`agentation.ts`).
  - `ui/`: DOM component builders. Returns pure DOM nodes.
  - `utils/`: Helper functions (element ID, storage, output generation).
  - `icons/`: SVG icon helpers.
- `extension/`: Chrome/Browser extension wrapper around the core library.
  - `content-script.js`: Injects the library and handles toggling.
  - `manifest.json`: Manifest V3 configuration.
- `playground/`: Manual testing environment.
  - `index.html`: Entry point for the playground.
  - `src/main.ts`: Initializes the annotator.
  - `src/main.css`: Styles for the playground page.
  - `vite.config.ts`: Configured to alias `@` to `../src` for live reloading.
- `dist/`: Compiled output (ESM/CJS).
- `PLAN.md`: Implementation roadmap and status.

## Development Workflow
- **Build**: `npm run build` (Generates `dist/`)
- **Watch**: `npm run watch` (Rebuilds on change)
- **Test**: `npm run test` (Runs unit tests via Vitest)
- **Extension Build**: `npm run build:ext` (Builds core and copies to extension folder)

## Coding Conventions
1.  **Vanilla DOM**: Use `document.createElement`, `appendChild`, etc.
2.  **No External UI Deps**: All UI must be built from scratch or using internal helpers.
3.  **State Management**: Simple observer pattern or rigid state objects in `src/core/state.ts`.
4.  **Styles**: Styles should be self-contained and injected to avoid conflicts with host pages. Use specific prefixes or Shadow DOM (if applicable, currently Plan mentions `data-*` attributes and specific classes).
5.  **Testing**: Write unit tests for logic in `core` and `utils`. Component testing via JSDOM.

## Ecosystem
### Playground
The `playground/` directory contains a Vanilla TS application used for manual testing and development.
- **Tech Stack**: Vanilla TypeScript, Vite, HTML/CSS.
- **Integration**: Imports directly from `src` (aliased as `@`) to allow immediate feedback during development.
- **CSS Handling**: Uses a custom Vite plugin to handle CSS injection during development.

### Extension
The `extension/` directory contains a Chrome Extension wrapper.
- **Architecture**: Content script (`content-script.js`) dynamically imports the bundled library from `dist/index.mjs`.
- **Toggling**: Listens for `TOGGLE_UI_ANNOTATOR` messages to mount/unmount the annotator.
- **Global Instance**: Stores the annotator instance on `window.__uiAnnotatorInstance` to manage its lifecycle.

## Key Goals (from PLAN.md)
- Parity with original Agentation workflows (click-to-annotate, drag selection).
- Zero React dependencies.
- Single file bundle output option.
