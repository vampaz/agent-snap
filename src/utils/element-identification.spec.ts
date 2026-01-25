import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getAccessibilityInfo,
  getComputedStylesSnapshot,
  getDetailedComputedStyles,
  getElementClasses,
  getElementPath,
  getFullElementPath,
  getNearbyElements,
  getNearbyText,
  identifyAnimationElement,
  identifyElement,
} from '@/utils/element-identification';

describe('element identification', function () {
  afterEach(function () {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('builds a readable element path', function () {
    const container = document.createElement('div');
    container.className = 'hero-section';
    const button = document.createElement('button');
    button.id = 'save-button';
    container.appendChild(button);
    document.body.appendChild(container);

    const path = getElementPath(button);
    expect(path).toContain('#save-button');
  });

  it('prefers meaningful class names in paths', function () {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';
    const inner = document.createElement('div');
    inner.className = 'a1';
    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);

    const path = getElementPath(inner);
    expect(path).toContain('.card');
  });

  it('identifies elements across tag types', function () {
    const button = document.createElement('button');
    button.textContent = 'Save';
    const labeledButton = document.createElement('button');
    labeledButton.setAttribute('aria-label', 'Submit');
    const link = document.createElement('a');
    link.href = '/docs';
    link.textContent = 'Docs';
    const linkNoText = document.createElement('a');
    linkNoText.href = '/plain';
    const input = document.createElement('input');
    input.setAttribute('placeholder', 'Email');
    const inputNamed = document.createElement('input');
    inputNamed.setAttribute('name', 'query');
    const heading = document.createElement('h2');
    heading.textContent = 'Title';
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Intro text';
    const listItem = document.createElement('li');
    listItem.textContent = 'Item';
    const span = document.createElement('span');
    span.textContent = 'Badge';
    const label = document.createElement('label');
    label.textContent = 'Label';
    const code = document.createElement('code');
    code.textContent = 'const a = 1';
    const pre = document.createElement('pre');
    pre.textContent = 'block';
    const img = document.createElement('img');
    img.setAttribute('alt', 'Preview');
    const video = document.createElement('video');
    const container = document.createElement('div');
    container.className = 'hero-section';

    document.body.appendChild(button);
    document.body.appendChild(labeledButton);
    document.body.appendChild(link);
    document.body.appendChild(linkNoText);
    document.body.appendChild(input);
    document.body.appendChild(inputNamed);
    document.body.appendChild(heading);
    document.body.appendChild(paragraph);
    document.body.appendChild(listItem);
    document.body.appendChild(span);
    document.body.appendChild(label);
    document.body.appendChild(code);
    document.body.appendChild(pre);
    document.body.appendChild(img);
    document.body.appendChild(video);
    document.body.appendChild(container);

    expect(identifyElement(button).name).toContain('btn "Save"');
    expect(identifyElement(labeledButton).name).toContain('btn [Submit]');
    expect(identifyElement(link).name).toContain('anchor "Docs"');
    expect(identifyElement(linkNoText).name).toContain('anchor /plain');
    expect(identifyElement(input).name).toContain('field "Email"');
    expect(identifyElement(inputNamed).name).toContain('field [query]');
    expect(identifyElement(heading).name).toContain('header h2 "Title"');
    expect(identifyElement(paragraph).name).toContain('¶');
    expect(identifyElement(listItem).name).toContain('item: "Item"');
    expect(identifyElement(span).name).toContain('quote "Badge"');
    expect(identifyElement(label).name).toContain('quote "Label"');
    expect(identifyElement(code).name).toContain('snippet');
    expect(identifyElement(pre).name).toContain('block snippet');
    expect(identifyElement(img).name).toContain('pic "Preview"');
    expect(identifyElement(video).name).toContain('vid');
    expect(identifyElement(container).name).toContain('hero section');
  });

  it('identifies svg context and data labels', function () {
    const button = document.createElement('button');
    button.textContent = 'Icon';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(path);
    button.appendChild(svg);
    document.body.appendChild(button);

    const lonePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    document.body.appendChild(lonePath as unknown as Element);

    const labelled = document.createElement('div');
    labelled.dataset.element = 'Custom card';
    document.body.appendChild(labelled);

    expect(identifyElement(path as unknown as HTMLElement).name).toContain('pic in');
    expect(identifyElement(lonePath as unknown as HTMLElement).name).toContain('visual');
    expect(identifyElement(svg as unknown as HTMLElement).name).toContain('icon in "Icon"');
    expect(identifyElement(labelled).name).toBe('Custom card');
  });

  it('handles labeled containers', function () {
    const section = document.createElement('section');
    section.setAttribute('aria-label', 'Main area');
    document.body.appendChild(section);

    const region = document.createElement('div');
    region.setAttribute('role', 'region');
    document.body.appendChild(region);

    expect(identifyElement(section).name).toContain('[Main area]');
    expect(identifyElement(region).name).toBe('region');
  });

  it('falls back to generic identifiers', function () {
    const anchor = document.createElement('a');
    const input = document.createElement('input');
    input.setAttribute('type', 'search');
    const span = document.createElement('span');
    span.textContent = 'Long text that exceeds forty characters in length.';
    const div = document.createElement('div');
    const img = document.createElement('img');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const paragraph = document.createElement('p');
    const emptyItem = document.createElement('li');
    const blockquote = document.createElement('blockquote');
    const code = document.createElement('code');
    code.textContent = 'const abcdefghijklmnopqrstuvwxyz = 1;';
    const table = document.createElement('table');
    document.body.appendChild(anchor);
    document.body.appendChild(input);
    document.body.appendChild(span);
    document.body.appendChild(div);
    document.body.appendChild(img);
    document.body.appendChild(svg as unknown as Element);
    document.body.appendChild(paragraph);
    document.body.appendChild(emptyItem);
    document.body.appendChild(blockquote);
    document.body.appendChild(code);
    document.body.appendChild(table);

    expect(identifyElement(anchor).name).toBe('anchor');
    expect(identifyElement(input).name).toContain('search field');
    expect(identifyElement(span).name).toBe('span');
    expect(identifyElement(div).name).toBe('box');
    expect(identifyElement(img).name).toBe('pic');
    expect(identifyElement(svg as unknown as HTMLElement).name).toBe('ico');
    expect(identifyElement(paragraph).name).toBe('¶');
    expect(identifyElement(emptyItem).name).toBe('item');
    expect(identifyElement(blockquote).name).toBe('quote block');
    expect(identifyElement(code).name).toBe('snippet');
    expect(identifyElement(table).name).toBe('table');
  });

  it('collects nearby text and elements', function () {
    const wrapper = document.createElement('div');
    wrapper.className = 'stacked';
    const prev = document.createElement('span');
    prev.textContent = 'Before';
    const target = document.createElement('span');
    target.textContent = 'Target';
    const next = document.createElement('button');
    next.textContent = 'Next';
    const extra = document.createElement('a');
    extra.textContent = 'More';
    const extraTwo = document.createElement('span');
    extraTwo.textContent = 'Extra';
    const extraThree = document.createElement('span');
    extraThree.textContent = 'Extra 2';
    wrapper.appendChild(prev);
    wrapper.appendChild(target);
    wrapper.appendChild(next);
    wrapper.appendChild(extra);
    wrapper.appendChild(extraTwo);
    wrapper.appendChild(extraThree);
    document.body.appendChild(wrapper);

    expect(getNearbyText(target)).toContain('Before');
    expect(getNearbyElements(target)).toContain('button');
    expect(getNearbyElements(target)).toContain('total 6');
  });

  it('returns animation identifiers', function () {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const button = document.createElement('button');
    button.textContent = 'Play';
    const input = document.createElement('input');
    input.setAttribute('type', 'checkbox');
    const span = document.createElement('span');
    span.textContent = 'Badge';
    const div = document.createElement('div');
    div.className = 'card-component';
    const plainDiv = document.createElement('div');
    const longSpan = document.createElement('span');
    longSpan.textContent = 'This is a long label that should be truncated.';
    const section = document.createElement('section');

    expect(identifyAnimationElement(path as unknown as HTMLElement)).toBe('vector');
    expect(identifyAnimationElement(circle as unknown as HTMLElement)).toBe('round');
    expect(identifyAnimationElement(rect as unknown as HTMLElement)).toBe('rect');
    expect(identifyAnimationElement(line as unknown as HTMLElement)).toBe('stroke');
    expect(identifyAnimationElement(ellipse as unknown as HTMLElement)).toBe('oval');
    expect(identifyAnimationElement(polygon as unknown as HTMLElement)).toBe('poly');
    expect(identifyAnimationElement(group as unknown as HTMLElement)).toBe('grp');
    expect(identifyAnimationElement(svg as unknown as HTMLElement)).toBe('svg img');
    expect(identifyAnimationElement(button)).toContain('btn "Play"');
    expect(identifyAnimationElement(input)).toContain('field (checkbox)');
    expect(identifyAnimationElement(span)).toContain('quote "Badge"');
    expect(identifyAnimationElement(div)).toContain('card component');
    expect(identifyAnimationElement(plainDiv)).toBe('holder');
    expect(identifyAnimationElement(longSpan)).toBe('txt');
    expect(identifyAnimationElement(section)).toBe('section');
  });

  it('formats element classes and accessibility', function () {
    const element = document.createElement('div');
    element.className = 'card card_hash123';
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', 'Open');
    element.setAttribute('aria-describedby', 'hint');
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('tabindex', '0');
    document.body.appendChild(element);

    expect(getElementClasses(element)).toContain('card');
    expect(getAccessibilityInfo(element)).toContain('role: button');
    expect(getAccessibilityInfo(element)).toContain('desc-by: hint');
    expect(getAccessibilityInfo(element)).toContain('hidden');
    expect(getAccessibilityInfo(element)).toContain('interactive');
  });

  it('returns empty accessibility info when missing', function () {
    const element = document.createElement('div');
    document.body.appendChild(element);
    expect(getAccessibilityInfo(element)).toBe('');
    expect(getElementClasses(element)).toBe('');
  });

  it('captures computed styles', function () {
    const element = document.createElement('div');
    document.body.appendChild(element);

    const styleMock = {
      color: 'rgb(10, 10, 10)',
      backgroundColor: 'rgb(255, 255, 255)',
      fontSize: '16px',
      fontWeight: '600',
      padding: '4px',
      margin: '4px',
      display: 'flex',
      position: 'absolute',
      borderRadius: '6px',
      getPropertyValue: function getPropertyValue() {
        return '12px';
      },
    } as unknown as CSSStyleDeclaration;

    vi.spyOn(window, 'getComputedStyle').mockReturnValue(styleMock);

    const snapshot = getComputedStylesSnapshot(element);
    expect(snapshot).toContain('color');

    const detailed = getDetailedComputedStyles(element);
    expect(detailed.borderRadius).toBe('12px');

    const fullPath = getFullElementPath(element);
    expect(fullPath).toContain('div');
  });

  it('returns empty styles without window', function () {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
    });

    const element = document.createElement('div');
    expect(getComputedStylesSnapshot(element)).toBe('');
    expect(getDetailedComputedStyles(element)).toEqual({});

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    });
  });

  it('formats full element paths with classes', function () {
    const element = document.createElement('div');
    element.className = 'card_hash123';
    document.body.appendChild(element);
    const fullPath = getFullElementPath(element);
    expect(fullPath).toContain('div.card');
  });

  it('returns empty nearby elements for isolated nodes', function () {
    const element = document.createElement('div');
    expect(getNearbyElements(element)).toBe('');
  });
});
