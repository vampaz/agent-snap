Agentation Framework-Agnostic Clone Plan

Goal

- Build a framework-agnostic clone of Agentation's toolbar and annotation workflows with zero React dependencies.
- Keep behavior parity: click-to-annotate, text selection, multi-select drag, area selection, animation freeze, marker management, output copy, settings, theming, and local storage persistence.
- Ship as a small ESM/CJS package that can be mounted in any web app (React, Vue, Svelte, plain HTML).

Implementation Plan

1. Inventory features and map React pieces to vanilla modules
   - Page toolbar UI, settings panel, markers layers, popups, drag overlays, and hover tooltips from `page-toolbar-css`.
   - Annotation popup UI from `annotation-popup-css`.
   - Utilities from `utils/element-identification.ts` and `utils/storage.ts`.
   - Output generation logic from `generateOutput()`.

2. Create framework-agnostic architecture
   - `src/core/state.ts`: minimal store (plain object + subscriptions) for annotations, settings, and UI flags.
   - `src/core/agentation.ts`: orchestrator class handling mount/unmount, event wiring, and state updates.
   - `src/ui/` modules for toolbar, markers, popups, and drag overlays (each returns DOM nodes + update hooks).
   - `src/types.ts`: shared `Annotation`, settings, and public API types.

3. Replace React rendering with DOM builders
   - Build static DOM trees with `document.createElement` and `template` strings.
   - Use `data-*` attributes to preserve current behavior and exclude the tool from its own hit testing.
   - Implement explicit update functions to sync DOM based on state (e.g., `updateMarkers`, `updateToolbar`).
   - Use event delegation on the root container for button clicks and context menus.

4. Port animations and styling
   - Convert SCSS modules to plain CSS (or retain SCSS + build-time compile) with prefixed class names.
   - Provide a CSS injector that inserts a single `<style>` tag on mount and removes on destroy.
   - Preserve keyframe names and animation timings to keep the same look and feel.
   - Add theme tokens as CSS variables on the root container (accent color, light/dark mode).

5. Rebuild icons as framework-agnostic SVG helpers
   - Convert each icon component into a function returning `SVGElement` or SVG string.
   - Keep inline SVG `<style>` tags for animated icons.
   - Provide size/color parameters to match current usage.

6. Re-implement interaction logic without React
   - Hover detection, selection, and click-to-annotate using `document.addEventListener`.
   - Multi-select drag handling with direct DOM updates for highlights and throttled element detection.
   - Marker enter/exit animations via class toggles and `setTimeout` to mirror current sequencing.
   - Annotation editing, deletion, and renumber animations.
   - Animation freeze/unfreeze with injected style tag and video pause/resume tracking.
   - Settings persistence in `localStorage` using existing storage keys.

7. Public API design for framework agnostic use
   - Export `createAgentSnap(options)` returning `{ destroy, setSettings, getAnnotations, copyOutput }`.
   - Options: `mount`, `zIndex`, `initialTheme`, `annotationColor`, `outputDetail`, `storageAdapter`, `onCopy`.
   - Optional `registerAgentSnapElement()` to expose a custom element `<agent-snap>`.

8. Build tooling
   - Use `vite` to produce ESM/CJS bundles and types.
   - Bundle CSS injection with the JS build to keep install friction low.
   - Ensure no React or ReactDOM dependencies in `package.json`.

9. Usage + verification
   - Add a minimal HTML example and short README usage snippet for any framework.
   - Manual checklist: hover/selection, drag selection, markers, copy output, settings persistence, theme toggle, and cleanup on destroy.
