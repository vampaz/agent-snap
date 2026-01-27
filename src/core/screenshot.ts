const MAX_SCREENSHOT_DIMENSION = 3000;
const MAX_SCREENSHOT_AREA = 9000000;

function getDocumentSize(): { width: number; height: number } {
  const body = document.body;
  const doc = document.documentElement;
  return {
    width: Math.max(
      body.scrollWidth,
      body.offsetWidth,
      doc.clientWidth,
      doc.scrollWidth,
      doc.offsetWidth,
    ),
    height: Math.max(
      body.scrollHeight,
      body.offsetHeight,
      doc.clientHeight,
      doc.scrollHeight,
      doc.offsetHeight,
    ),
  };
}

function getComputedStyleText(style: CSSStyleDeclaration): string {
  const properties = [
    'display',
    'position',
    'top',
    'right',
    'bottom',
    'left',
    'z-index',
    'width',
    'height',
    'min-width',
    'min-height',
    'max-width',
    'max-height',
    'margin',
    'padding',
    'box-sizing',
    'border',
    'border-radius',
    'box-shadow',
    'background',
    'background-color',
    'background-image',
    'background-size',
    'background-position',
    'color',
    'font',
    'font-size',
    'font-family',
    'font-weight',
    'line-height',
    'letter-spacing',
    'text-align',
    'text-transform',
    'text-decoration',
    'opacity',
    'visibility',
    'overflow',
    'transform',
    'transform-origin',
    'flex',
    'flex-direction',
    'justify-content',
    'align-items',
    'gap',
    'grid-template-columns',
    'grid-template-rows',
  ];
  return properties
    .map(function mapProperty(property) {
      const value = style.getPropertyValue(property);
      if (!value) return '';
      return `${property}:${value};`;
    })
    .join('');
}

function cloneWithInlineStyles(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  const sourceElements = [element].concat(Array.from(element.querySelectorAll('*')));
  const clonedElements = [clone].concat(Array.from(clone.querySelectorAll('*')));

  sourceElements.forEach(function inlineStyles(source, index) {
    const cloned = clonedElements[index];
    if (!(cloned instanceof HTMLElement)) return;
    const computed = window.getComputedStyle(source);
    cloned.setAttribute('style', getComputedStyleText(computed));
  });

  return clone;
}

function stripAnnotatorNodes(root: HTMLElement): void {
  if (root.matches('[data-agent-snap]')) {
    root.removeAttribute('data-agent-snap');
  }
  root.querySelectorAll('[data-agent-snap]').forEach(function removeAnnotator(node) {
    node.remove();
  });
}

function renderCloneToDataUrl(
  clone: HTMLElement,
  width: number,
  height: number,
  offset?: { x: number; y: number },
): Promise<string | null> {
  if (width <= 0 || height <= 0) return Promise.resolve(null);
  if (typeof Image === 'undefined') return Promise.resolve(null);
  stripAnnotatorNodes(clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  if (offset) {
    clone.style.transform = `translate(${-offset.x}px, ${-offset.y}px)`;
    clone.style.transformOrigin = 'top left';
  }
  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.overflow = 'hidden';
  wrapper.appendChild(clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return new Promise(function resolveScreenshot(resolve) {
    const image = new Image();
    image.decoding = 'async';
    image.onload = function handleLoad() {
      const canvas = document.createElement('canvas');
      const scale = window.devicePixelRatio || 1;
      canvas.width = width * scale;
      canvas.height = height * scale;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(null);
        return;
      }
      context.scale(scale, scale);
      context.drawImage(image, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    image.onerror = function handleError() {
      resolve(null);
    };
    image.src = svgUrl;
  });
}

function captureAnnotationScreenshot(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<string | null> {
  if (typeof window === 'undefined' || !document.body) {
    return Promise.resolve(null);
  }
  const roundedBounds = {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  };
  const area = roundedBounds.width * roundedBounds.height;
  if (
    roundedBounds.width <= 0 ||
    roundedBounds.height <= 0 ||
    roundedBounds.width > MAX_SCREENSHOT_DIMENSION ||
    roundedBounds.height > MAX_SCREENSHOT_DIMENSION ||
    area > MAX_SCREENSHOT_AREA
  ) {
    return Promise.resolve(null);
  }
  const docSize = getDocumentSize();
  const clone = cloneWithInlineStyles(document.body);
  clone.style.width = `${docSize.width}px`;
  clone.style.height = `${docSize.height}px`;
  return renderCloneToDataUrl(clone, roundedBounds.width, roundedBounds.height, {
    x: roundedBounds.x,
    y: roundedBounds.y,
  });
}

export function deferAnnotationScreenshot(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return new Promise(function resolveDeferred(resolve) {
    const runCapture = function runCapture() {
      captureAnnotationScreenshot(bounds).then(resolve);
    };
    const idle = (
      window as Window & {
        requestIdleCallback?: (callback: () => void) => number;
      }
    ).requestIdleCallback;
    if (typeof idle === 'function') {
      idle(runCapture);
    } else {
      setTimeout(runCapture, 0);
    }
  });
}
