# agent-snap

[![npm version](https://img.shields.io/npm/v/agent-snap)](https://www.npmjs.com/package/agent-snap)

**Framework-agnostic DOM snapshot and annotation tool for coding agents.**

Agent Snap allows you to annotate your UI and export a structured Markdown representation of the DOM. This is designed to help AI coding agents understand the visual context of your application, including Shadow DOM boundaries.

![Agent Snap Demo](docs/images/demo.gif)

## Features

- ⚡ **Framework Agnostic**: Works with Vanilla JS, React, Vue, Svelte, Web Components, etc.
- 🌑 **Shadow DOM Support**: Penetrates and annotates elements inside Shadow Roots.
- 📝 **Markdown Export**: Generates structured Markdown output optimized for AI context.
- 🖌️ **Interactive Annotation**: Toggle annotation mode to click and comment on UI elements.
- 🔌 **Extension Ready**: Includes a build target for a Chrome/Browser extension.
- 🎨 **Themable**: Built-in dark and light themes.

## Installation

Package: https://www.npmjs.com/package/agent-snap

```bash
npm install agent-snap
```

## Usage

### JavaScript / TypeScript

Initialize the agent-snap toolbar in your application:

```ts
import { createAgentSnap } from 'agent-snap';

const snap = createAgentSnap({
  // Optional configuration
  mount: document.body,
  initialTheme: 'dark',
  copyToClipboard: true,
  onCopy: (markdown) => {
    console.log('Snapshot copied to clipboard!', markdown);
  },
});
```

### Web Component

You can also use it as a custom element:

```ts
import { registerAgentSnapElement } from 'agent-snap';

// Register the custom element
registerAgentSnapElement();
```

```html
<!-- In your HTML -->
<agent-snap theme="dark" annotation-color="#3c82f7"></agent-snap>
```

## Configuration

### `createAgentSnap(options)`

| Option                 | Type                | Default         | Description                                                         |
| ---------------------- | ------------------- | --------------- | ------------------------------------------------------------------- |
| `mount`                | `HTMLElement`       | `document.body` | The element to append the toolbar to.                               |
| `initialTheme`         | `'light' \| 'dark'` | `'dark'`        | The initial UI theme.                                               |
| `zIndex`               | `number`            | `100000`        | Z-index for the toolbar and overlays.                               |
| `copyToClipboard`      | `boolean`           | `true`          | Whether to automatically copy the markdown to clipboard on export.  |
| `storageRetentionDays` | `number`            | `7`             | Days to retain stored annotations; set to `0` to disable retention. |
| `settings`             | `object`            | `{...}`         | Default settings for the annotator (see below).                     |

### Settings Object

| Setting              | Type                                     | Default      | Description                                        |
| -------------------- | ---------------------------------------- | ------------ | -------------------------------------------------- |
| `annotationColor`    | `string`                                 | `'#3c82f7'`  | Hex color for annotation markers.                  |
| `outputDetail`       | `'standard' \| 'detailed' \| 'forensic'` | `'standard'` | Level of detail in the markdown output.            |
| `autoClearAfterCopy` | `boolean`                                | `false`      | Clear annotations automatically after copying.     |
| `blockInteractions`  | `boolean`                                | `false`      | Block native page interactions while annotating.   |
| `captureScreenshots` | `boolean`                                | `true`       | Include screenshots in the capture (if supported). |

### Custom Element Attributes

| Attribute               | Type                                     | Default           | Description                                                       |
| ----------------------- | ---------------------------------------- | ----------------- | ----------------------------------------------------------------- |
| `theme`                 | `'light' \| 'dark'`                      | system preference | Theme for the toolbar UI.                                         |
| `annotation-color`      | `string`                                 | `'#3c82f7'`       | Hex color for annotation markers.                                 |
| `output-detail`         | `'standard' \| 'detailed' \| 'forensic'` | `'standard'`      | Level of detail in the markdown output.                           |
| `auto-clear-after-copy` | `boolean`                                | `false`           | Set attribute to enable auto-clear after copying.                 |
| `block-interactions`    | `boolean`                                | `false`           | Set attribute to block native page interactions while annotating. |
| `capture-screenshots`   | `boolean`                                | `true`            | Set to `false` to disable screenshots.                            |
| `z-index`               | `number`                                 | `100000`          | Z-index for the toolbar and overlays.                             |

### Callbacks

- `onAnnotationAdd(annotation)`: Called when a new annotation is added.
- `onAnnotationDelete(annotation)`: Called when an annotation is removed.
- `onAnnotationUpdate(annotation)`: Called when an annotation is edited.
- `onAnnotationsClear(annotations)`: Called when all annotations are cleared.
- `onCopy(markdown)`: Called when the snapshot is generated and copied.

## Output Format

The copied markdown includes a machine-readable asset manifest for TUI agents. It is emitted as a fenced code block labeled `agent-snap-assets` and provides stable asset IDs, filenames, and base64 payloads. The manifest also includes an optional `actions` list that references asset IDs and supplies an `outputPath` for TUIs that materialize files directly (the assets remain the source of truth).

Recommended TUI ingestion flow:

1. Parse the `agent-snap-assets` block.
2. For each `actions` entry, look up the matching asset by `assetId`.
3. Decode the asset `data` (base64) to `outputPath`.
4. Attach the materialized file paths to the agent.

```agent-snap-assets
{
  "version": 1,
  "page": {
    "pathname": "/",
    "url": "https://example.com"
  },
  "imageOutputMode": "base64",
  "assetDirectory": "./agent-snap-downloads",
  "assets": [
    {
      "id": "agent-snap-annotation-1-screenshot",
      "annotationId": "1",
      "annotationIndex": 1,
      "kind": "screenshot",
      "data": "iVBORw0KGgo...",
      "mime": "image/png",
      "bytes": 12345,
      "filename": "agent-snap-annotation-1-screenshot.png"
    }
  ],
  "actions": [
    {
      "type": "materialize-asset",
      "assetId": "agent-snap-annotation-1-screenshot",
      "outputPath": "./agent-snap-downloads/agent-snap-annotation-1-screenshot.png",
      "strategy": "base64"
    }
  ]
}
```

Assets include `data` (base64 payload), `mime`, and `bytes`, and the report references them by `ref:` ID in each annotation.

## Development

This project uses [Vite](https://vitejs.dev/) for building and testing.

### Prerequisites

- Node.js (Latest LTS recommended)
- npm

### Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/vampaz/agent-snap.git
    cd agent-snap
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Running the Playground

The playground is a standalone test environment that imports the source directly for rapid development.

```bash
cd playground
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`) to test the tool.

### Building

To build the library for production (outputs to `dist/`):

```bash
npm run build
```

### Testing

Run unit tests with Vitest:

```bash
npm run test
```

### Generating Demo Assets

To generate the demo GIF:

```bash
npm run generate:demo
```

## Browser Extension

`agent-snap` can be built as a Chrome extension.

1.  **Build the extension:**

    ```bash
    npm run build:ext
    ```

    This generates an `extension/dist` folder.

2.  **Load in Chrome:**
    - Go to `chrome://extensions`.
    - Enable "Developer mode".
    - Click "Load unpacked".
    - Select the `extension` folder in this project.

## License

MIT
