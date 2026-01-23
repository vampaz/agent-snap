# ui-annotator

Framework-agnostic UI annotation toolbar.

## Usage

### JavaScript

```ts
import { createUiAnnotator, registerUiAnnotatorElement } from 'ui-annotator';

createUiAnnotator();

// Optional custom element registration
registerUiAnnotatorElement();
```

### Custom element

```html
<ui-annotator></ui-annotator>
```

Attributes
- `theme`: `dark` (default) or `light`
- `annotation-color`: hex color for markers (e.g. `#3c82f7`)
- `output-detail`: `compact`, `standard`, `detailed`, or `forensic`
- `auto-clear-after-copy`: presence enables auto-clear
- `block-interactions`: presence blocks native interactions while active
- `z-index`: overrides toolbar z-index

### Options (createUiAnnotator)

```ts
createUiAnnotator({
  mount: document.body,
  initialTheme: 'dark',
  settings: {
    annotationColor: '#3c82f7',
    outputDetail: 'standard',
    autoClearAfterCopy: false,
    blockInteractions: false,
  },
  zIndex: 100000,
  onCopy: (markdown) => {
    console.log(markdown);
  },
});
```
