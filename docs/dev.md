# Dev Docs

## Fix Plan: Vite Plugin Node Built-ins

Problem:

- `agent-snap@0.5.0` publishes `dist/vite.mjs` with Node built-ins bundled as Vite browser externals.
- The generated file contains an empty browser-external namespace instead of real `node:buffer`, `node:path`, and `node:fs/promises` imports.
- In client apps, copying a snapshot through `agent-snap/vite` crashes the dev server save endpoint with `TypeError: Cannot read properties of undefined (reading 'concat')` at `Buffer.concat`.
- The desired client integration remains `import agentSnap from 'agent-snap/vite'; plugins: [agentSnap()]`; do not require client-side wrappers or local plugin copies.

Likely root cause:

- The Vite library build is treating the `vite` entry like browser-targeted code.
- `src/vite.ts` is a Node dev-server plugin entry and must preserve Node built-in imports in the emitted package.

Implementation plan:

1. Reproduce against the package output.
   Verify by building and inspecting `dist/vite.mjs` for `__vite-browser-external` and by importing `dist/vite.mjs` in Node, then calling `saveAgentSnapPayload()` with a sample Markdown payload.

2. Fix the package build config.
   Update `vite.config.ts` so Rollup treats Node built-ins as external for the library build, at minimum `/^node:/`, and keeps `vite` external if it ever appears as a runtime import. The expected `dist/vite.mjs` should contain real ESM imports such as `import { Buffer } from 'node:buffer'`, `import path from 'node:path'`, and `import { mkdir, writeFile } from 'node:fs/promises'`.

3. Add a dist-level regression check.
   Add a small Node smoke test or script that runs after `npm run build`, imports `./dist/vite.mjs`, and verifies `saveAgentSnapPayload()` can write:
   - a Markdown snapshot file
   - a materialized base64 asset
   - a saved manifest with file paths instead of embedded payloads
     Also assert `dist/vite.mjs` does not contain `__vite-browser-external`.

4. Keep source-level tests focused.
   Add or extend `src/vite.spec.ts` for `saveAgentSnapPayload()` behavior if coverage is missing, but do not rely only on source tests because this bug is introduced by packaging.

5. Validate in the playground plugin mode.
   Run `npm run dev:plugin --prefix playground`, copy a snapshot, and confirm the dev server writes `agent-snapshots/*` without crashing.

6. Release a patch version.
   Publish the fixed package as a patch release, then client apps can use the normal Vite plugin import with no wrappers:
   `import agentSnap from 'agent-snap/vite';`
