const MAX_SCREENSHOT_DIMENSION = 3000;
const MAX_SCREENSHOT_AREA = 9000000;
const MAX_FOREIGNOBJECT_DIMENSION = 6000;
const MAX_FOREIGNOBJECT_AREA = 36000000;

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

function cloneWithInlineStyles(
  element: HTMLElement,
  bounds?: { left: number; top: number; right: number; bottom: number; isFixed?: boolean },
): HTMLElement {
  // Use a div instead of cloning the body tag directly to avoid browser-specific body rendering issues in SVG.
  const isBody = element.tagName.toLowerCase() === 'body';
  let clone: HTMLElement;
  if (isBody) {
    const bodyClone = element.cloneNode(true) as HTMLElement;
    clone = document.createElement('div');
    for (const attr of Array.from(element.attributes)) {
      clone.setAttribute(attr.name, attr.value);
    }
    while (bodyClone.firstChild) {
      clone.appendChild(bodyClone.firstChild);
    }
  } else {
    clone = element.cloneNode(true) as HTMLElement;
  }

  const sourceElements = [element].concat(Array.from(element.querySelectorAll('*')));
  const clonedElements = [clone].concat(Array.from(clone.querySelectorAll('*')));
  let includedElements: Set<HTMLElement> | null = null;

  if (bounds) {
    const elementsToStyle = new Set<HTMLElement>();
    includedElements = elementsToStyle;
    const offsetX = window.scrollX;
    const offsetY = window.scrollY;

    sourceElements.forEach(function markIncluded(source) {
      if (!(source instanceof HTMLElement)) return;
      const rect = source.getBoundingClientRect();
      const left = rect.left + offsetX;
      const right = rect.right + offsetX;
      const top = rect.top + offsetY;
      const bottom = rect.bottom + offsetY;
      const intersects =
        left < bounds.right && right > bounds.left && top < bounds.bottom && bottom > bounds.top;
      if (!intersects) return;
      elementsToStyle.add(source);
      let parent = source.parentElement;
      while (parent) {
        elementsToStyle.add(parent);
        parent = parent.parentElement;
      }
    });
  }

  sourceElements.forEach(function inlineStyles(source, index) {
    const cloned = clonedElements[index];
    if (!(cloned instanceof HTMLElement)) return;
    if (includedElements && !includedElements.has(source)) {
      if (
        source instanceof HTMLOptionElement &&
        source.parentElement &&
        includedElements.has(source.parentElement)
      ) {
        // Keep options for included selects so selected state serializes correctly.
      } else {
        return;
      }
    }
    const computed = window.getComputedStyle(source);
    cloned.setAttribute('style', getComputedStyleText(computed));

    // Force fixed elements to absolute in the clone so they stay in their page-relative position
    if (computed.position === 'fixed') {
      cloned.style.position = 'absolute';
      cloned.style.right = 'auto';
      cloned.style.bottom = 'auto';
      const rect = source.getBoundingClientRect();
      cloned.style.top = `${rect.top + window.scrollY}px`;
      cloned.style.left = `${rect.left + window.scrollX}px`;
    }

    if (source instanceof HTMLInputElement && cloned instanceof HTMLInputElement) {
      if (source.type !== 'file') {
        cloned.value = source.value;
        if (source.value) {
          cloned.setAttribute('value', source.value);
        } else {
          cloned.removeAttribute('value');
        }
      }
      cloned.checked = source.checked;
      cloned.indeterminate = source.indeterminate;
      if (source.checked) {
        cloned.setAttribute('checked', '');
      } else {
        cloned.removeAttribute('checked');
      }
    }

    if (source instanceof HTMLTextAreaElement && cloned instanceof HTMLTextAreaElement) {
      cloned.value = source.value;
      cloned.textContent = source.value;
    }

    if (source instanceof HTMLSelectElement && cloned instanceof HTMLSelectElement) {
      cloned.selectedIndex = source.selectedIndex;
    }

    if (source instanceof HTMLOptionElement && cloned instanceof HTMLOptionElement) {
      cloned.selected = source.selected;
      if (source.selected) {
        cloned.setAttribute('selected', '');
      } else {
        cloned.removeAttribute('selected');
      }
    }

    if (source instanceof HTMLCanvasElement && cloned instanceof HTMLCanvasElement) {
      cloned.width = source.width;
      cloned.height = source.height;
      const ctx = cloned.getContext('2d');
      if (ctx) {
        ctx.drawImage(source, 0, 0);
      }
    }
  });

  return clone;
}

function getPageBackgroundColor(): string {
  const bodyBackground = window.getComputedStyle(document.body).backgroundColor;
  if (bodyBackground && bodyBackground !== 'transparent' && bodyBackground !== 'rgba(0, 0, 0, 0)') {
    return bodyBackground;
  }
  const htmlBackground = window.getComputedStyle(document.documentElement).backgroundColor;
  if (htmlBackground && htmlBackground !== 'transparent' && htmlBackground !== 'rgba(0, 0, 0, 0)') {
    return htmlBackground;
  }
  return '#ffffff';
}

function stripAnnotatorNodes(root: HTMLElement): void {
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

  const docSize = getDocumentSize();
  const canUseFullDocument =
    docSize.width <= MAX_FOREIGNOBJECT_DIMENSION &&
    docSize.height <= MAX_FOREIGNOBJECT_DIMENSION &&
    docSize.width * docSize.height <= MAX_FOREIGNOBJECT_AREA;

  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.position = 'relative';
  wrapper.style.backgroundColor = getPageBackgroundColor();
  if (canUseFullDocument) {
    // Create a wrapper that matches the full document size
    wrapper.style.width = `${docSize.width}px`;
    wrapper.style.height = `${docSize.height}px`;
  } else {
    // Use a cropped wrapper to avoid rendering massive documents in SVG foreignObject
    wrapper.style.width = `${width}px`;
    wrapper.style.height = `${height}px`;
    wrapper.style.overflow = 'hidden';
    if (offset) {
      clone.style.transform = `translate(${-offset.x}px, ${-offset.y}px)`;
      clone.style.transformOrigin = 'top left';
    }
  }
  wrapper.appendChild(clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);

  let svg: string;
  if (canUseFullDocument) {
    // Use viewBox to precisely crop the requested area from the full document render
    // This is much more reliable than using CSS transforms inside foreignObject
    svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${offset?.x || 0} ${offset?.y || 0} ${width} ${height}">
        <foreignObject width="${docSize.width}" height="${docSize.height}">
          ${serialized}
        </foreignObject>
      </svg>
    `.trim();
  } else {
    svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          ${serialized}
        </foreignObject>
      </svg>
    `.trim();
  }

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
        resolve(canvas.toDataURL('image/jpeg', 0.9));
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

function captureAnnotationScreenshot(
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  isFixed?: boolean,
): Promise<string | null> {
  if (typeof window === 'undefined' || !document.body) {
    return Promise.resolve(null);
  }

  // Increase buffer even further to be absolutely safe
  const buffer = 20;
  const roundedBounds = {
    x: Math.max(0, Math.floor(bounds.x - buffer)),
    y: Math.max(0, Math.floor(bounds.y - buffer)),
    width: Math.ceil(bounds.width + buffer * 2),
    height: Math.ceil(bounds.height + buffer * 2),
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
  const boundsRect = {
    left: roundedBounds.x,
    top: roundedBounds.y,
    right: roundedBounds.x + roundedBounds.width,
    bottom: roundedBounds.y + roundedBounds.height,
    isFixed: isFixed,
  };
  const clone = cloneWithInlineStyles(document.body, boundsRect);
  clone.style.width = `${docSize.width}px`;
  clone.style.height = `${docSize.height}px`;
  return renderCloneToDataUrl(clone, roundedBounds.width, roundedBounds.height, {
    x: roundedBounds.x,
    y: roundedBounds.y,
  });
}

export function deferAnnotationScreenshot(
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  isFixed?: boolean,
): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return new Promise(function resolveDeferred(resolve) {
    const runCapture = function runCapture() {
      captureAnnotationScreenshot(bounds, isFixed).then(resolve);
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
