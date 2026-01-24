export function applyInlineStyles(
  element: HTMLElement,
  styles?: Partial<CSSStyleDeclaration>,
): void {
  if (!styles) return;
  Object.entries(styles).forEach(function applyStyle([key, value]) {
    if (typeof value === 'string') {
      element.style.setProperty(key, value);
    }
  });
}
