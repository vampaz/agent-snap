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
- `capture-screenshots`: `false` disables screenshot capture (default on)
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
    captureScreenshots: true,
  },
  zIndex: 100000,
  copyToClipboard: true,
  onAnnotationAdd: (annotation) => {
    console.log('Added', annotation);
  },
  onAnnotationDelete: (annotation) => {
    console.log('Deleted', annotation);
  },
  onAnnotationUpdate: (annotation) => {
    console.log('Updated', annotation);
  },
  onAnnotationsClear: (annotations) => {
    console.log('Cleared', annotations);
  },
  onCopy: (markdown) => {
    console.log(markdown);
  },
});
```

Callbacks
- `onAnnotationAdd(annotation)`: called when an annotation is created
- `onAnnotationDelete(annotation)`: called when an annotation is deleted
- `onAnnotationUpdate(annotation)`: called when an annotation comment is edited
- `onAnnotationsClear(annotations)`: called when all annotations are cleared
- `onCopy(markdown)`: called when copy is clicked

Copy control
- `copyToClipboard`: default `true`; set `false` to skip writing to the clipboard (use `onCopy` instead)
