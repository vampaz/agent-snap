import { t } from '@/utils/i18n';

function getMeaningfulClassWords(
  className: string,
  options: {
    split: RegExp;
    trim?: RegExp;
    minLength?: number;
    maxWords?: number;
    excludeShort?: boolean;
  },
): string[] {
  const minLength = options.minLength ?? 3;
  const tokens = className
    .split(options.split)
    .map(function cleanToken(word) {
      return options.trim ? word.replace(options.trim, '') : word;
    })
    .filter(function filterToken(word) {
      if (word.length < minLength) return false;
      if (options.excludeShort && /^[a-z]{1,2}$/.test(word)) return false;
      return true;
    });
  if (options.maxWords) return tokens.slice(0, options.maxWords);
  return tokens;
}

function findMeaningfulClassToken(className: string): string | null {
  const tokens = getMeaningfulClassWords(className, {
    split: /\s+/,
    excludeShort: true,
  });
  const token = tokens.find(function findToken(word) {
    return !/[A-Z0-9]{5,}/.test(word);
  });
  return token ?? null;
}

export function getElementPath(target: HTMLElement, maxDepth = 4): string {
  const parts: string[] = [];
  let current: HTMLElement | null = target;
  let depth = 0;

  while (current && depth < maxDepth) {
    const tag = current.tagName.toLowerCase();

    if (tag === 'html' || tag === 'body') break;

    let identifier = tag;
    if (current.id) {
      identifier = `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const meaningfulClass = findMeaningfulClassToken(current.className);
      if (meaningfulClass) {
        identifier = `.${meaningfulClass.split('_')[0]}`;
      }
    }

    parts.unshift(identifier);
    current = current.parentElement;
    depth += 1;
  }

  return parts.join(' > ');
}

export function identifyElement(target: HTMLElement): { name: string; path: string } {
  const path = getElementPath(target);

  if (target.dataset.element) {
    return { name: target.dataset.element, path };
  }

  const tag = target.tagName.toLowerCase();

  if (['path', 'circle', 'rect', 'line', 'g'].includes(tag)) {
    const svg = target.closest('svg');
    if (svg) {
      const parent = svg.parentElement;
      if (parent) {
        const parentName = identifyElement(parent).name;
        return { name: t('element.graphicIn', { parentName }), path };
      }
    }
    return { name: t('element.graphicElement'), path };
  }
  if (tag === 'svg') {
    const parent = target.parentElement;
    if (parent && parent.tagName.toLowerCase() === 'button') {
      const btnText = parent.textContent ? parent.textContent.trim() : '';
      return {
        name: btnText ? t('element.iconInButton', { text: btnText }) : t('element.buttonIcon'),
        path,
      };
    }
    return { name: t('element.icon'), path };
  }

  if (tag === 'button') {
    const text = target.textContent ? target.textContent.trim() : '';
    const ariaLabel = target.getAttribute('aria-label');
    if (ariaLabel) {
      return { name: t('element.buttonAria', { ariaLabel }), path };
    }
    return {
      name: text ? t('element.buttonText', { text: text.slice(0, 25) }) : t('element.button'),
      path,
    };
  }
  if (tag === 'a') {
    const text = target.textContent ? target.textContent.trim() : '';
    const href = target.getAttribute('href');
    if (text) {
      return { name: t('element.linkText', { text: text.slice(0, 25) }), path };
    }
    if (href) {
      return { name: t('element.linkHref', { href: href.slice(0, 30) }), path };
    }
    return { name: t('element.link'), path };
  }
  if (tag === 'input') {
    const type = target.getAttribute('type') || 'text';
    const placeholder = target.getAttribute('placeholder');
    const name = target.getAttribute('name');
    if (placeholder) {
      return { name: t('element.inputPlaceholder', { placeholder }), path };
    }
    if (name) return { name: t('element.inputName', { name }), path };
    return { name: t('element.inputType', { type }), path };
  }

  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    const text = target.textContent ? target.textContent.trim() : '';
    return {
      name: text ? t('element.headingText', { tag, text: text.slice(0, 35) }) : tag,
      path,
    };
  }

  if (tag === 'p') {
    const text = target.textContent ? target.textContent.trim() : '';
    if (text) {
      const snippet = `${text.slice(0, 40)}${text.length > 40 ? '...' : ''}`;
      return {
        name: t('element.paragraphText', { text: snippet }),
        path,
      };
    }
    return { name: t('element.paragraph'), path };
  }
  if (tag === 'span' || tag === 'label') {
    const text = target.textContent ? target.textContent.trim() : '';
    if (text && text.length < 40) {
      return { name: t('element.quotedText', { text }), path };
    }
    return { name: tag, path };
  }
  if (tag === 'li') {
    const text = target.textContent ? target.textContent.trim() : '';
    if (text && text.length < 40) {
      return {
        name: t('element.listItemText', { text: text.slice(0, 35) }),
        path,
      };
    }
    return { name: t('element.listItem'), path };
  }
  if (tag === 'blockquote') return { name: t('element.blockquote'), path };
  if (tag === 'code') {
    const text = target.textContent ? target.textContent.trim() : '';
    if (text && text.length < 30) {
      return { name: t('element.codeText', { text }), path };
    }
    return { name: t('element.code'), path };
  }
  if (tag === 'pre') return { name: t('element.codeBlock'), path };

  if (tag === 'img') {
    const alt = target.getAttribute('alt');
    return {
      name: alt ? t('element.imageAlt', { alt: alt.slice(0, 30) }) : t('element.image'),
      path,
    };
  }
  if (tag === 'video') return { name: t('element.video'), path };

  if (['div', 'section', 'article', 'nav', 'header', 'footer', 'aside', 'main'].includes(tag)) {
    const className = target.className;
    const role = target.getAttribute('role');
    const ariaLabel = target.getAttribute('aria-label');

    if (ariaLabel) return { name: `${tag} [${ariaLabel}]`, path };
    if (role) return { name: role, path };

    if (typeof className === 'string' && className) {
      const words = getMeaningfulClassWords(className, {
        split: /[\s_-]+/,
        trim: /[A-Z0-9]{5,}.*$/,
        excludeShort: true,
        maxWords: 2,
      });
      if (words.length > 0) return { name: words.join(' '), path };
    }

    return { name: tag === 'div' ? t('element.container') : tag, path };
  }

  return { name: tag, path };
}

export function getNearbyText(element: HTMLElement): string {
  const texts: string[] = [];

  const ownText = element.textContent ? element.textContent.trim() : '';
  if (ownText && ownText.length < 100) {
    texts.push(ownText);
  }

  const prev = element.previousElementSibling;
  if (prev) {
    const prevText = prev.textContent ? prev.textContent.trim() : '';
    if (prevText && prevText.length < 50) {
      texts.unshift(t('element.nearby.before', { text: prevText.slice(0, 40) }));
    }
  }

  const next = element.nextElementSibling;
  if (next) {
    const nextText = next.textContent ? next.textContent.trim() : '';
    if (nextText && nextText.length < 50) {
      texts.push(t('element.nearby.after', { text: nextText.slice(0, 40) }));
    }
  }

  return texts.join(' ');
}

export function identifyAnimationElement(target: HTMLElement): string {
  if (target.dataset.element) return target.dataset.element;

  const tag = target.tagName.toLowerCase();

  if (tag === 'path') return t('element.shape.path');
  if (tag === 'circle') return t('element.shape.circle');
  if (tag === 'rect') return t('element.shape.rectangle');
  if (tag === 'line') return t('element.shape.line');
  if (tag === 'ellipse') return t('element.shape.ellipse');
  if (tag === 'polygon') return t('element.shape.polygon');
  if (tag === 'g') return t('element.shape.group');
  if (tag === 'svg') return t('element.shape.svg');

  if (tag === 'button') {
    const text = target.textContent ? target.textContent.trim() : '';
    return text ? t('element.buttonText', { text }) : t('element.button');
  }
  if (tag === 'input') {
    const type = target.getAttribute('type') || 'text';
    return t('element.animation.input', { type });
  }

  if (tag === 'span' || tag === 'p' || tag === 'label') {
    const text = target.textContent ? target.textContent.trim() : '';
    if (text && text.length < 30) return t('element.quotedText', { text });
    return t('element.animation.text');
  }

  if (tag === 'div') {
    const className = target.className;
    if (typeof className === 'string' && className) {
      const words = getMeaningfulClassWords(className, {
        split: /[\s_-]+/,
        trim: /[A-Z0-9]{5,}.*$/,
        excludeShort: true,
        maxWords: 2,
      });
      if (words.length > 0) {
        return words.join(' ');
      }
    }
    return t('element.animation.container');
  }

  return tag;
}

export function getNearbyElements(element: HTMLElement): string {
  const parent = element.parentElement;
  if (!parent) return '';

  const siblings = Array.from(parent.children).filter(function filterSibling(child) {
    return child !== element && child instanceof HTMLElement;
  }) as HTMLElement[];

  if (siblings.length === 0) return '';

  const siblingIds = siblings.slice(0, 4).map(function mapSibling(sib) {
    const tag = sib.tagName.toLowerCase();
    const className = sib.className;

    let cls = '';
    if (typeof className === 'string' && className) {
      const [meaningful] = getMeaningfulClassWords(className, {
        split: /\s+/,
        trim: /[_][a-zA-Z0-9]{5,}.*$/,
        excludeShort: true,
        maxWords: 1,
      });
      if (meaningful) cls = `.${meaningful}`;
    }

    if (tag === 'button' || tag === 'a') {
      const text = sib.textContent ? sib.textContent.trim().slice(0, 15) : '';
      if (text) {
        return t('element.nearby.tagWithText', {
          tag,
          className: cls,
          text,
        });
      }
    }

    return `${tag}${cls}`;
  });

  const parentTag = parent.tagName.toLowerCase();
  let parentId = parentTag;
  if (typeof parent.className === 'string' && parent.className) {
    const [parentCls] = getMeaningfulClassWords(parent.className, {
      split: /\s+/,
      trim: /[_][a-zA-Z0-9]{5,}.*$/,
      excludeShort: true,
      maxWords: 1,
    });
    if (parentCls) parentId = `.${parentCls}`;
  }

  const total = parent.children.length;
  const suffix =
    total > siblingIds.length + 1 ? t('element.nearby.suffix', { total, parent: parentId }) : '';

  return siblingIds.join(', ') + suffix;
}

export function getElementClasses(target: HTMLElement): string {
  const className = target.className;
  if (typeof className !== 'string' || !className) return '';

  const classes = className
    .split(/\s+/)
    .filter(function filterClassName(value) {
      return value.length > 0;
    })
    .map(function mapClassName(value) {
      const match = value.match(/^([a-zA-Z][a-zA-Z0-9_-]*?)(?:_[a-zA-Z0-9]{5,})?$/);
      return match ? match[1] : value;
    })
    .filter(function filterDuplicate(value, index, arr) {
      return arr.indexOf(value) === index;
    });

  return classes.join(', ');
}

export function getDataTestId(target: HTMLElement): string {
  const attr = target.getAttribute('data-test-id');
  if (!attr) return '';
  return attr.trim();
}

export function getComputedStylesSnapshot(target: HTMLElement): string {
  if (typeof window === 'undefined') return '';

  const styles = window.getComputedStyle(target);
  const parts: string[] = [];

  const color = styles.color;
  const bg = styles.backgroundColor;
  if (color && color !== 'rgb(0, 0, 0)') {
    parts.push(`${t('styles.color')}: ${color}`);
  }
  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
    parts.push(`${t('styles.background')}: ${bg}`);
  }

  const fontSize = styles.fontSize;
  const fontWeight = styles.fontWeight;
  if (fontSize) parts.push(`${t('styles.font')}: ${fontSize}`);
  if (fontWeight && fontWeight !== '400' && fontWeight !== 'normal') {
    parts.push(`${t('styles.weight')}: ${fontWeight}`);
  }

  const padding = styles.padding;
  const margin = styles.margin;
  if (padding && padding !== '0px') parts.push(`${t('styles.padding')}: ${padding}`);
  if (margin && margin !== '0px') parts.push(`${t('styles.margin')}: ${margin}`);

  const display = styles.display;
  const position = styles.position;
  if (display && display !== 'block' && display !== 'inline') {
    parts.push(`${t('styles.display')}: ${display}`);
  }
  if (position && position !== 'static') {
    parts.push(`${t('styles.position')}: ${position}`);
  }

  const borderRadius = styles.borderRadius;
  if (borderRadius && borderRadius !== '0px') {
    parts.push(`${t('styles.radius')}: ${borderRadius}`);
  }

  return parts.join(', ');
}

export function getDetailedComputedStyles(target: HTMLElement): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const styles = window.getComputedStyle(target);
  const result: Record<string, string> = {};

  const properties = [
    'color',
    'backgroundColor',
    'borderColor',
    'fontSize',
    'fontWeight',
    'fontFamily',
    'lineHeight',
    'letterSpacing',
    'textAlign',
    'width',
    'height',
    'padding',
    'margin',
    'border',
    'borderRadius',
    'display',
    'position',
    'top',
    'right',
    'bottom',
    'left',
    'zIndex',
    'flexDirection',
    'justifyContent',
    'alignItems',
    'gap',
    'opacity',
    'visibility',
    'overflow',
    'boxShadow',
    'transform',
  ];

  for (const prop of properties) {
    const value = styles.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
    if (
      value &&
      value !== 'none' &&
      value !== 'normal' &&
      value !== 'auto' &&
      value !== '0px' &&
      value !== 'rgba(0, 0, 0, 0)'
    ) {
      result[prop] = value;
    }
  }

  return result;
}

export function getAccessibilityInfo(target: HTMLElement): string {
  const parts: string[] = [];

  const role = target.getAttribute('role');
  const ariaLabel = target.getAttribute('aria-label');
  const ariaDescribedBy = target.getAttribute('aria-describedby');
  const tabIndex = target.getAttribute('tabindex');
  const ariaHidden = target.getAttribute('aria-hidden');

  if (role) parts.push(t('accessibility.role', { role }));
  if (ariaLabel) parts.push(t('accessibility.ariaLabel', { label: ariaLabel }));
  if (ariaDescribedBy) {
    parts.push(t('accessibility.ariaDescribedBy', { value: ariaDescribedBy }));
  }
  if (tabIndex) parts.push(t('accessibility.tabIndex', { value: tabIndex }));
  if (ariaHidden === 'true') parts.push(t('accessibility.ariaHidden'));

  const focusable = target.matches('a, button, input, select, textarea, [tabindex]');
  if (focusable) parts.push(t('accessibility.focusable'));

  return parts.join(', ');
}

export function getFullElementPath(target: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = target;

  while (current && current.tagName.toLowerCase() !== 'html') {
    const tag = current.tagName.toLowerCase();
    let identifier = tag;

    if (current.id) {
      identifier = `${tag}#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const [cls] = getMeaningfulClassWords(current.className, {
        split: /\s+/,
        trim: /[_][a-zA-Z0-9]{5,}.*$/,
        maxWords: 1,
      });
      if (cls) identifier = `${tag}.${cls}`;
    }

    parts.unshift(identifier);
    current = current.parentElement;
  }

  return parts.join(' > ');
}
