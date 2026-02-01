type SvgOptions = {
  size?: number;
  className?: string;
  title?: string;
};

type SvgToggleOptions = SvgOptions & {
  isOpen?: boolean;
  isPaused?: boolean;
  copied?: boolean;
};

function createSvgElement(size: number, viewBox = '0 0 24 24'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('fill', 'none');
  return svg;
}

function appendPath(parent: SVGElement, attrs: Record<string, string>): SVGPathElement {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  Object.entries(attrs).forEach(function setAttr([key, value]) {
    path.setAttribute(key, value);
  });
  parent.appendChild(path);
  return path;
}

function appendStyle(svg: SVGSVGElement, css: string): void {
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = css;
  svg.appendChild(style);
}

export function createIconListSparkle(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 24;
  const svg = createSvgElement(size);

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(group);

  appendPath(group, {
    d: 'M5 2v6M2 5h6',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  appendPath(group, {
    d: 'M12 5h3m-3 17h3m3-17h.5A3.5 3.5 0 0 1 22 8.5V9m0 9v.5a3.5 3.5 0 0 1-3.5 3.5H18m-9 0h-.5A3.5 3.5 0 0 1 5 18.5V18m17-6v3M5 12v3',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
  });

  return svg;
}

export function createIconPausePlayAnimated(options: SvgToggleOptions = {}): SVGSVGElement {
  const size = options.size ?? 24;
  const isPaused = options.isPaused ?? false;
  const svg = createSvgElement(size);

  appendStyle(svg, '.pause-bar,.play-triangle{transition:opacity 0.15s ease;}');

  // Play Group (Visible when PAUSED, so user clicks to PLAY/RESUME)
  const playGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  playGroup.setAttribute('class', 'play-triangle');
  playGroup.setAttribute('style', `opacity: ${isPaused ? 1 : 0}`);
  appendPath(playGroup, {
    d: 'M18.89 12.846c-.353 1.343-2.023 2.292-5.364 4.19c-3.23 1.835-4.845 2.752-6.146 2.384a3.25 3.25 0 0 1-1.424-.841C5 17.614 5 15.743 5 12s0-5.614.956-6.579a3.25 3.25 0 0 1 1.424-.84c1.301-.37 2.916.548 6.146 2.383c3.34 1.898 5.011 2.847 5.365 4.19a3.3 3.3 0 0 1 0 1.692Z',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linejoin': 'round',
  });
  svg.appendChild(playGroup);

  // Pause Group (Visible when RUNNING, so user clicks to PAUSE)
  const pauseGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  pauseGroup.setAttribute('class', 'pause-bar');
  pauseGroup.setAttribute('style', `opacity: ${isPaused ? 0 : 1}`);
  appendPath(pauseGroup, {
    d: 'M4 7c0-1.414 0-2.121.44-2.56C4.878 4 5.585 4 7 4s2.121 0 2.56.44C10 4.878 10 5.585 10 7v10c0 1.414 0 2.121-.44 2.56C9.122 20 8.415 20 7 20s-2.121 0-2.56-.44C4 19.122 4 18.415 4 17zm10 0c0-1.414 0-2.121.44-2.56C14.878 4 15.585 4 17 4s2.121 0 2.56.44C20 4.878 20 5.585 20 7v10c0 1.414 0 2.121-.44 2.56c-.439.44-1.146.44-2.56.44s-2.121 0-2.56-.44C14 19.122 14 18.415 14 17z',
    stroke: 'currentColor',
    'stroke-width': '1.5',
  });
  svg.appendChild(pauseGroup);

  return svg;
}

export function createIconEyeAnimated(options: SvgToggleOptions = {}): SVGSVGElement {
  const size = options.size ?? 24;
  const isOpen = options.isOpen ?? true;
  const svg = createSvgElement(size);

  appendStyle(svg, '.eye-open,.eye-closed{transition:opacity 0.2s ease;}');

  const openGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  openGroup.setAttribute('class', 'eye-open');
  openGroup.setAttribute('style', `opacity: ${isOpen ? 1 : 0}`);
  appendPath(openGroup, {
    d: 'M3.91752 12.7539C3.65127 12.2996 3.65037 11.7515 3.9149 11.2962C4.9042 9.59346 7.72688 5.49994 12 5.49994C16.2731 5.49994 19.0958 9.59346 20.0851 11.2962C20.3496 11.7515 20.3487 12.2996 20.0825 12.7539C19.0908 14.4459 16.2694 18.4999 12 18.4999C7.73064 18.4999 4.90918 14.4459 3.91752 12.7539Z',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  appendPath(openGroup, {
    d: 'M12 14.8261C13.5608 14.8261 14.8261 13.5608 14.8261 12C14.8261 10.4392 13.5608 9.17392 12 9.17392C10.4392 9.17392 9.17391 10.4392 9.17391 12C9.17391 13.5608 10.4392 14.8261 12 14.8261Z',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  svg.appendChild(openGroup);

  const closedGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  closedGroup.setAttribute('class', 'eye-closed');
  closedGroup.setAttribute('style', `opacity: ${isOpen ? 0 : 1}`);
  appendPath(closedGroup, {
    d: 'M18.6025 9.28503C18.9174 8.9701 19.4364 8.99481 19.7015 9.35271C20.1484 9.95606 20.4943 10.507 20.7342 10.9199C21.134 11.6086 21.1329 12.4454 20.7303 13.1328C20.2144 14.013 19.2151 15.5225 17.7723 16.8193C16.3293 18.1162 14.3852 19.2497 12.0008 19.25C11.4192 19.25 10.8638 19.1823 10.3355 19.0613C9.77966 18.934 9.63498 18.2525 10.0382 17.8493C10.2412 17.6463 10.5374 17.573 10.8188 17.6302C11.1993 17.7076 11.5935 17.75 12.0008 17.75C13.8848 17.7497 15.4867 16.8568 16.7693 15.7041C18.0522 14.5511 18.9606 13.1867 19.4363 12.375C19.5656 12.1543 19.5659 11.8943 19.4373 11.6729C19.2235 11.3049 18.921 10.8242 18.5364 10.3003C18.3085 9.98991 18.3302 9.5573 18.6025 9.28503ZM12.0008 4.75C12.5814 4.75006 13.1358 4.81803 13.6632 4.93953C14.2182 5.06741 14.362 5.74812 13.9593 6.15091C13.7558 6.35435 13.4589 6.42748 13.1771 6.36984C12.7983 6.29239 12.4061 6.25006 12.0008 6.25C10.1167 6.25 8.51415 7.15145 7.23028 8.31543C5.94678 9.47919 5.03918 10.8555 4.56426 11.6729C4.43551 11.8945 4.43582 12.1542 4.56524 12.375C4.77587 12.7343 5.07189 13.2012 5.44718 13.7105C5.67623 14.0213 5.65493 14.4552 5.38193 14.7282C5.0671 15.0431 4.54833 15.0189 4.28292 14.6614C3.84652 14.0736 3.50813 13.5369 3.27129 13.1328C2.86831 12.4451 2.86717 11.6088 3.26739 10.9199C3.78185 10.0345 4.77959 8.51239 6.22247 7.2041C7.66547 5.89584 9.61202 4.75 12.0008 4.75Z',
    fill: 'currentColor',
  });
  appendPath(closedGroup, {
    d: 'M5 19L19 5',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
  });
  svg.appendChild(closedGroup);

  return svg;
}

export function createIconCopyAnimated(options: SvgToggleOptions = {}): SVGSVGElement {
  const size = options.size ?? 24;
  const copied = options.copied ?? false;
  const svg = createSvgElement(size);

  appendStyle(svg, '.copy-icon,.check-icon{transition:opacity 0.2s ease,transform 0.2s ease;}');

  const copyGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  copyGroup.setAttribute('class', 'copy-icon');
  copyGroup.setAttribute(
    'style',
    `opacity: ${copied ? 0 : 1}; transform: ${copied ? 'scale(0.8)' : 'scale(1)'}; transform-origin: center;`,
  );
  appendPath(copyGroup, {
    d: 'M16.964 8.982c-.003-2.95-.047-4.478-.906-5.524a4 4 0 0 0-.553-.554C14.4 2 12.76 2 9.48 2s-4.92 0-6.024.905a4 4 0 0 0-.553.554C1.998 4.56 1.998 6.2 1.998 9.48s0 4.92.906 6.023q.25.304.553.553c1.046.86 2.575.904 5.525.906',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  appendPath(copyGroup, {
    d: 'm14.028 9.025l2.966-.043m-2.98 13.02l2.966-.043m4.992-7.937l-.028 2.96M9.01 14.036l-.028 2.96m2.505-7.971c-.832.149-2.17.302-2.477 2.024m10.485 10.91c.835-.137 2.174-.27 2.508-1.986M19.495 9.025c.832.149 2.17.302 2.477 2.024M11.5 21.957c-.833-.148-2.17-.301-2.478-2.023',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  svg.appendChild(copyGroup);

  const checkGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  checkGroup.setAttribute('class', 'check-icon');
  checkGroup.setAttribute(
    'style',
    `opacity: ${copied ? 1 : 0}; transform: ${copied ? 'scale(1)' : 'scale(0.8)'}; transform-origin: center;`,
  );
  appendPath(checkGroup, {
    d: 'M12 20C7.58172 20 4 16.4182 4 12C4 7.58172 7.58172 4 12 4C16.4182 4 20 7.58172 20 12C20 16.4182 16.4182 20 12 20Z',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  appendPath(checkGroup, {
    d: 'M15 10L11 14.25L9.25 12.25',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  svg.appendChild(checkGroup);

  return svg;
}

export function createIconTrash(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size);

  appendPath(svg, {
    d: 'm19.5 5.5l-.62 10.025c-.158 2.561-.237 3.842-.88 4.763a4 4 0 0 1-1.2 1.128c-.957.584-2.24.584-4.806.584c-2.57 0-3.855 0-4.814-.585a4 4 0 0 1-1.2-1.13c-.642-.922-.72-2.205-.874-4.77L4.5 5.5M9 11.735h6m-4.5 3.919h3M3 5.5h18m-4.945 0l-.682-1.408c-.454-.936-.68-1.403-1.071-1.695a2 2 0 0 0-.275-.172C13.594 2 13.074 2 12.034 2c-1.065 0-1.598 0-2.039.234a2 2 0 0 0-.278.18c-.396.303-.617.788-1.059 1.757L8.053 5.5',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
  });

  return svg;
}

export function createIconGear(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size);

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(group);

  appendPath(group, {
    d: 'M15.5 12a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0Z',
    stroke: 'currentColor',
    'stroke-width': '1.5',
  });
  appendPath(group, {
    d: 'M21.011 14.097c.522-.141.783-.212.886-.346c.103-.135.103-.351.103-.784v-1.934c0-.433 0-.65-.103-.784s-.364-.205-.886-.345c-1.95-.526-3.171-2.565-2.668-4.503c.139-.533.208-.8.142-.956s-.256-.264-.635-.479l-1.725-.98c-.372-.21-.558-.316-.725-.294s-.356.21-.733.587c-1.459 1.455-3.873 1.455-5.333 0c-.377-.376-.565-.564-.732-.587c-.167-.022-.353.083-.725.295l-1.725.979c-.38.215-.57.323-.635.48c-.066.155.003.422.141.955c.503 1.938-.718 3.977-2.669 4.503c-.522.14-.783.21-.886.345S2 10.6 2 11.033v1.934c0 .433 0 .65.103.784s.364.205.886.346c1.95.526 3.171 2.565 2.668 4.502c-.139.533-.208.8-.142.956s.256.264.635.48l1.725.978c.372.212.558.317.725.295s.356-.21.733-.587c1.46-1.457 3.876-1.457 5.336 0c.377.376.565.564.732.587c.167.022.353-.083.726-.295l1.724-.979c.38-.215.57-.323.635-.48s-.003-.422-.141-.955c-.504-1.937.716-3.976 2.666-4.502Z',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
  });

  return svg;
}

export function createIconXmarkLarge(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 24;
  const svg = createSvgElement(size);

  appendPath(svg, {
    d: 'M5.432 18.568c.576.576 1.51.576 2.087 0L12 14.086l4.481 4.481a1.475 1.475 0 0 0 2.087-2.086L14.087 12l4.48-4.48a1.475 1.475 0 1 0-2.086-2.087l-4.48 4.48l-4.482-4.48a1.475 1.475 0 0 0-2.087 2.085L9.914 12l-4.482 4.482a1.475 1.475 0 0 0 0 2.086',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  return svg;
}

export function createIconSun(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size);

  appendPath(svg, {
    d: 'M17 12a5 5 0 1 1-10 0a5 5 0 0 1 10 0Z',
    stroke: 'currentColor',
    'stroke-width': '1.5',
  });
  appendPath(svg, {
    d: 'M11.2 3h1.6M11.2 21h1.6M17.964 5.636h1.6M4.436 18.364h1.6M4.436 5.636h1.6M17.964 18.364h1.6M20.2 12h1.6M2.2 12h1.6',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  return svg;
}

export function createIconMoon(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size);

  appendPath(svg, {
    d: 'M21.5 14.078A8.557 8.557 0 0 1 9.922 2.5C5.668 3.497 2.5 7.315 2.5 11.873a9.627 9.627 0 0 0 9.627 9.627c4.558 0 8.376-3.168 9.373-7.422',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  return svg;
}

export function createIconHelp(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 20;
  const svg = createSvgElement(size, '0 0 20 20');

  svg.setAttribute('viewBox', '0 0 24 24');

  appendPath(svg, {
    d: 'M21.5 12a9.5 9.5 0 0 1-9.5 9.5c-1.628 0-3.16-.41-4.5-1.131c-1.868-1.007-3.125-.071-4.234.097a.53.53 0 0 1-.456-.156a.64.64 0 0 1-.117-.703c.436-1.025.835-2.969.29-4.607a9.5 9.5 0 0 1-.483-3a9.5 9.5 0 1 1 19 0',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  appendPath(svg, {
    d: 'M9.5 9.5a2.5 2.5 0 1 1 3.912 2.064C12.728 12.032 12 12.672 12 13.5',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  appendPath(svg, {
    d: 'M12 16.5h.009',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  return svg;
}

export function createIconCheckSmall(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 14;
  const svg = createSvgElement(size, '0 0 14 14');

  appendPath(svg, {
    d: 'M3.9375 7L6.125 9.1875L10.5 4.8125',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  return svg;
}

export function createIconCheckSmallAnimated(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 14;
  const svg = createSvgElement(size, '0 0 14 14');

  appendStyle(
    svg,
    '@keyframes checkDraw{0%{stroke-dashoffset:12;}100%{stroke-dashoffset:0;}}@keyframes checkBounce{0%{transform:scale(0.5);opacity:0;}50%{transform:scale(1.12);opacity:1;}75%{transform:scale(0.95);}100%{transform:scale(1);}}.check-path-animated{stroke-dasharray:12;stroke-dashoffset:0;transform-origin:center;animation:checkDraw 0.18s ease-out,checkBounce 0.3s cubic-bezier(0.34,1.56,0.64,1);}',
  );

  appendPath(svg, {
    class: 'check-path-animated',
    d: 'M3.9375 7L6.125 9.1875L10.5 4.8125',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  return svg;
}

export function createIconPlus(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size, '0 0 16 16');

  appendPath(svg, {
    d: 'M8 3v10M3 8h10',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
  });

  return svg;
}

export function createIconXmark(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size);

  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('clip-path', 'url(#clip0_2_53)');
  svg.appendChild(group);

  appendPath(group, {
    d: 'M16.25 16.25L7.75 7.75',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  appendPath(group, {
    d: 'M7.75 16.25L16.25 7.75',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  clipPath.setAttribute('id', 'clip0_2_53');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '24');
  rect.setAttribute('height', '24');
  rect.setAttribute('fill', 'white');
  clipPath.appendChild(rect);
  defs.appendChild(clipPath);
  svg.appendChild(defs);

  return svg;
}

export function createIconClose(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size, '0 0 16 16');

  appendPath(svg, {
    d: 'M4 4l8 8M12 4l-8 8',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
  });

  return svg;
}

export function createIconEdit(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size, '0 0 24 24');

  appendPath(svg, {
    d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  appendPath(svg, {
    d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1l1-4l9.5-9.5z',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  return svg;
}
