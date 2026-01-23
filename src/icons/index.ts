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

function createSvgElement(size: number, viewBox = "0 0 24 24"): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("fill", "none");
  return svg;
}

function appendPath(
  parent: SVGElement,
  attrs: Record<string, string>,
): SVGPathElement {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  Object.entries(attrs).forEach(function setAttr([key, value]) {
    path.setAttribute(key, value);
  });
  parent.appendChild(path);
  return path;
}

function appendCircle(
  parent: SVGElement,
  attrs: Record<string, string>,
): SVGCircleElement {
  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  Object.entries(attrs).forEach(function setAttr([key, value]) {
    circle.setAttribute(key, value);
  });
  parent.appendChild(circle);
  return circle;
}

function appendStyle(svg: SVGSVGElement, css: string): void {
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = css;
  svg.appendChild(style);
}

export function createIconListSparkle(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 24;
  const svg = createSvgElement(size);

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("clip-path", "url(#clip0_list_sparkle)");
  svg.appendChild(group);

  appendPath(group, {
    d: "M11.5 12L5.5 12",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  appendPath(group, {
    d: "M18.5 6.75L5.5 6.75",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  appendPath(group, {
    d: "M9.25 17.25L5.5 17.25",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  appendPath(group, {
    d: "M16 12.75L16.5179 13.9677C16.8078 14.6494 17.3506 15.1922 18.0323 15.4821L19.25 16L18.0323 16.5179C17.3506 16.8078 16.8078 17.3506 16.5179 18.0323L16 19.25L15.4821 18.0323C15.1922 17.3506 14.6494 16.8078 13.9677 16.5179L12.75 16L13.9677 15.4821C14.6494 15.1922 15.1922 14.6494 15.4821 13.9677L16 12.75Z",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linejoin": "round",
  });

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const clipPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "clipPath",
  );
  clipPath.setAttribute("id", "clip0_list_sparkle");
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", "24");
  rect.setAttribute("height", "24");
  rect.setAttribute("fill", "white");
  clipPath.appendChild(rect);
  defs.appendChild(clipPath);
  svg.appendChild(defs);

  return svg;
}

export function createIconPausePlayAnimated(
  options: SvgToggleOptions = {},
): SVGSVGElement {
  const size = options.size ?? 24;
  const isPaused = options.isPaused ?? false;
  const svg = createSvgElement(size);

  appendStyle(svg, ".pause-bar,.play-triangle{transition:opacity 0.15s ease;}");

  appendPath(svg, {
    class: "pause-bar",
    d: "M8 6L8 18",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    style: `opacity: ${isPaused ? 0 : 1}`,
  });
  appendPath(svg, {
    class: "pause-bar",
    d: "M16 18L16 6",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    style: `opacity: ${isPaused ? 0 : 1}`,
  });
  appendPath(svg, {
    class: "play-triangle",
    d: "M17.75 10.701C18.75 11.2783 18.75 12.7217 17.75 13.299L8.75 18.4952C7.75 19.0725 6.5 18.3509 6.5 17.1962L6.5 6.80384C6.5 5.64914 7.75 4.92746 8.75 5.50481L17.75 10.701Z",
    stroke: "currentColor",
    "stroke-width": "1.5",
    style: `opacity: ${isPaused ? 1 : 0}`,
  });

  return svg;
}

export function createIconEyeAnimated(
  options: SvgToggleOptions = {},
): SVGSVGElement {
  const size = options.size ?? 24;
  const isOpen = options.isOpen ?? true;
  const svg = createSvgElement(size);

  appendStyle(svg, ".eye-open,.eye-closed{transition:opacity 0.2s ease;}");

  const openGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  openGroup.setAttribute("class", "eye-open");
  openGroup.setAttribute("style", `opacity: ${isOpen ? 1 : 0}`);
  appendPath(openGroup, {
    d: "M3.91752 12.7539C3.65127 12.2996 3.65037 11.7515 3.9149 11.2962C4.9042 9.59346 7.72688 5.49994 12 5.49994C16.2731 5.49994 19.0958 9.59346 20.0851 11.2962C20.3496 11.7515 20.3487 12.2996 20.0825 12.7539C19.0908 14.4459 16.2694 18.4999 12 18.4999C7.73064 18.4999 4.90918 14.4459 3.91752 12.7539Z",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  appendPath(openGroup, {
    d: "M12 14.8261C13.5608 14.8261 14.8261 13.5608 14.8261 12C14.8261 10.4392 13.5608 9.17392 12 9.17392C10.4392 9.17392 9.17391 10.4392 9.17391 12C9.17391 13.5608 10.4392 14.8261 12 14.8261Z",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(openGroup);

  const closedGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  closedGroup.setAttribute("class", "eye-closed");
  closedGroup.setAttribute("style", `opacity: ${isOpen ? 0 : 1}`);
  appendPath(closedGroup, {
    d: "M18.6025 9.28503C18.9174 8.9701 19.4364 8.99481 19.7015 9.35271C20.1484 9.95606 20.4943 10.507 20.7342 10.9199C21.134 11.6086 21.1329 12.4454 20.7303 13.1328C20.2144 14.013 19.2151 15.5225 17.7723 16.8193C16.3293 18.1162 14.3852 19.2497 12.0008 19.25C11.4192 19.25 10.8638 19.1823 10.3355 19.0613C9.77966 18.934 9.63498 18.2525 10.0382 17.8493C10.2412 17.6463 10.5374 17.573 10.8188 17.6302C11.1993 17.7076 11.5935 17.75 12.0008 17.75C13.8848 17.7497 15.4867 16.8568 16.7693 15.7041C18.0522 14.5511 18.9606 13.1867 19.4363 12.375C19.5656 12.1543 19.5659 11.8943 19.4373 11.6729C19.2235 11.3049 18.921 10.8242 18.5364 10.3003C18.3085 9.98991 18.3302 9.5573 18.6025 9.28503ZM12.0008 4.75C12.5814 4.75006 13.1358 4.81803 13.6632 4.93953C14.2182 5.06741 14.362 5.74812 13.9593 6.15091C13.7558 6.35435 13.4589 6.42748 13.1771 6.36984C12.7983 6.29239 12.4061 6.25006 12.0008 6.25C10.1167 6.25 8.51415 7.15145 7.23028 8.31543C5.94678 9.47919 5.03918 10.8555 4.56426 11.6729C4.43551 11.8945 4.43582 12.1542 4.56524 12.375C4.77587 12.7343 5.07189 13.2012 5.44718 13.7105C5.67623 14.0213 5.65493 14.4552 5.38193 14.7282C5.0671 15.0431 4.54833 15.0189 4.28292 14.6614C3.84652 14.0736 3.50813 13.5369 3.27129 13.1328C2.86831 12.4451 2.86717 11.6088 3.26739 10.9199C3.78185 10.0345 4.77959 8.51239 6.22247 7.2041C7.66547 5.89584 9.61202 4.75 12.0008 4.75Z",
    fill: "currentColor",
  });
  appendPath(closedGroup, {
    d: "M5 19L19 5",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });
  svg.appendChild(closedGroup);

  return svg;
}

export function createIconCopyAnimated(
  options: SvgToggleOptions = {},
): SVGSVGElement {
  const size = options.size ?? 24;
  const copied = options.copied ?? false;
  const svg = createSvgElement(size);

  appendStyle(
    svg,
    ".copy-icon,.check-icon{transition:opacity 0.2s ease,transform 0.2s ease;}",
  );

  const copyGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  copyGroup.setAttribute("class", "copy-icon");
  copyGroup.setAttribute(
    "style",
    `opacity: ${copied ? 0 : 1}; transform: ${copied ? "scale(0.8)" : "scale(1)"}; transform-origin: center;`,
  );
  appendPath(copyGroup, {
    d: "M4.75 11.25C4.75 10.4216 5.42157 9.75 6.25 9.75H12.75C13.5784 9.75 14.25 10.4216 14.25 11.25V17.75C14.25 18.5784 13.5784 19.25 12.75 19.25H6.25C5.42157 19.25 4.75 18.5784 4.75 17.75V11.25Z",
    stroke: "currentColor",
    "stroke-width": "1.5",
  });
  appendPath(copyGroup, {
    d: "M17.25 14.25H17.75C18.5784 14.25 19.25 13.5784 19.25 12.75V6.25C19.25 5.42157 18.5784 4.75 17.75 4.75H11.25C10.4216 4.75 9.75 5.42157 9.75 6.25V6.75",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });
  svg.appendChild(copyGroup);

  const checkGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  checkGroup.setAttribute("class", "check-icon");
  checkGroup.setAttribute(
    "style",
    `opacity: ${copied ? 1 : 0}; transform: ${copied ? "scale(1)" : "scale(0.8)"}; transform-origin: center;`,
  );
  appendPath(checkGroup, {
    d: "M12 20C7.58172 20 4 16.4182 4 12C4 7.58172 7.58172 4 12 4C16.4182 4 20 7.58172 20 12C20 16.4182 16.4182 20 12 20Z",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  appendPath(checkGroup, {
    d: "M15 10L11 14.25L9.25 12.25",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(checkGroup);

  return svg;
}

export function createIconTrash(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size);

  appendPath(svg, {
    d: "M10 11.5L10.125 15.5",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  appendPath(svg, {
    d: "M14 11.5L13.87 15.5",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  appendPath(svg, {
    d: "M9 7.5V6.25C9 5.42157 9.67157 4.75 10.5 4.75H13.5C14.3284 4.75 15 5.42157 15 6.25V7.5",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  appendPath(svg, {
    d: "M5.5 7.75H18.5",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });
  appendPath(svg, {
    d: "M6.75 7.75L7.11691 16.189C7.16369 17.2649 7.18708 17.8028 7.41136 18.2118C7.60875 18.5717 7.91211 18.8621 8.28026 19.0437C8.69854 19.25 9.23699 19.25 10.3139 19.25H13.6861C14.763 19.25 15.3015 19.25 15.7197 19.0437C16.0879 18.8621 16.3912 18.5717 16.5886 18.2118C16.8129 17.8028 16.8363 17.2649 16.8831 16.189L17.25 7.75",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });

  return svg;
}

export function createIconGear(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size);

  appendPath(svg, {
    d: "M10.6504 5.81117C10.9939 4.39628 13.0061 4.39628 13.3496 5.81117C13.5715 6.72517 14.6187 7.15891 15.4219 6.66952C16.6652 5.91193 18.0881 7.33479 17.3305 8.57815C16.8411 9.38134 17.2748 10.4285 18.1888 10.6504C19.6037 10.9939 19.6037 13.0061 18.1888 13.3496C17.2748 13.5715 16.8411 14.6187 17.3305 15.4219C18.0881 16.6652 16.6652 18.0881 15.4219 17.3305C14.6187 16.8411 13.5715 17.2748 13.3496 18.1888C13.0061 19.6037 10.9939 19.6037 10.6504 18.1888C10.4285 17.2748 9.38135 16.8411 8.57815 17.3305C7.33479 18.0881 5.91193 16.6652 6.66952 15.4219C7.15891 14.6187 6.72517 13.5715 5.81117 13.3496C4.39628 13.0061 4.39628 10.9939 5.81117 10.6504C6.72517 10.4285 7.15891 9.38134 6.66952 8.57815C5.91193 7.33479 7.33479 5.91192 8.57815 6.66952C9.38135 7.15891 10.4285 6.72517 10.6504 5.81117Z",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  appendCircle(svg, {
    cx: "12",
    cy: "12",
    r: "2.5",
    stroke: "currentColor",
    "stroke-width": "1.5",
  });

  return svg;
}

export function createIconXmarkLarge(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 24;
  const svg = createSvgElement(size);

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("clip-path", "url(#clip0_1_660)");
  svg.appendChild(group);

  appendPath(group, {
    d: "M17.25 17.25L6.75 6.75",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  appendPath(group, {
    d: "M6.75 17.25L17.25 6.75",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const clipPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "clipPath",
  );
  clipPath.setAttribute("id", "clip0_1_660");
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", "24");
  rect.setAttribute("height", "24");
  rect.setAttribute("fill", "white");
  clipPath.appendChild(rect);
  defs.appendChild(clipPath);
  svg.appendChild(defs);

  return svg;
}

export function createIconSun(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size);

  appendCircle(svg, {
    cx: "12",
    cy: "12",
    r: "4",
    stroke: "currentColor",
    "stroke-width": "1.5",
  });
  appendPath(svg, {
    d: "M12 5V3",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });
  appendPath(svg, {
    d: "M12 21V19",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });
  appendPath(svg, {
    d: "M16.95 7.05L18.36 5.64",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });
  appendPath(svg, {
    d: "M5.64 18.36L7.05 16.95",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });
  appendPath(svg, {
    d: "M19 12H21",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });
  appendPath(svg, {
    d: "M3 12H5",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });
  appendPath(svg, {
    d: "M16.95 16.95L18.36 18.36",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });
  appendPath(svg, {
    d: "M5.64 5.64L7.05 7.05",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });

  return svg;
}

export function createIconMoon(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size);

  appendPath(svg, {
    d: "M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });

  return svg;
}

export function createIconHelp(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 20;
  const svg = createSvgElement(size, "0 0 20 20");

  appendPath(svg, {
    d: "M10 16.0417C6.66328 16.0417 3.95834 13.3367 3.95834 10C3.95834 6.66328 6.66328 3.95833 10 3.95833C13.3367 3.95833 16.0417 6.66328 16.0417 10C16.0417 13.3367 13.3367 16.0417 10 16.0417Z",
    stroke: "currentColor",
    "stroke-opacity": "0.2",
    "stroke-width": "1.25",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  appendPath(svg, {
    d: "M8.24188 8.18736C8.38392 7.78357 8.66429 7.44309 9.03331 7.22621C9.40234 7.00933 9.83621 6.93005 10.2581 7.00241C10.68 7.07477 11.0626 7.29411 11.3383 7.62157C11.6139 7.94903 11.7648 8.36348 11.7642 8.79152C11.7642 9.99986 10 10.604 10 10.604V10.8333",
    stroke: "currentColor",
    "stroke-opacity": "0.2",
    "stroke-width": "1.25",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  appendPath(svg, {
    d: "M10 13.0208H10.006",
    stroke: "currentColor",
    "stroke-opacity": "0.2",
    "stroke-width": "1.25",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });

  return svg;
}

export function createIconCheckSmallAnimated(
  options: SvgOptions = {},
): SVGSVGElement {
  const size = options.size ?? 14;
  const svg = createSvgElement(size, "0 0 14 14");

  appendStyle(
    svg,
    "@keyframes checkDraw{0%{stroke-dashoffset:12;}100%{stroke-dashoffset:0;}}@keyframes checkBounce{0%{transform:scale(0.5);opacity:0;}50%{transform:scale(1.12);opacity:1;}75%{transform:scale(0.95);}100%{transform:scale(1);}}.check-path-animated{stroke-dasharray:12;stroke-dashoffset:0;transform-origin:center;animation:checkDraw 0.18s ease-out,checkBounce 0.3s cubic-bezier(0.34,1.56,0.64,1);}",
  );

  appendPath(svg, {
    class: "check-path-animated",
    d: "M3.9375 7L6.125 9.1875L10.5 4.8125",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });

  return svg;
}

export function createIconPlus(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size, "0 0 16 16");

  appendPath(svg, {
    d: "M8 3v10M3 8h10",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });

  return svg;
}

export function createIconXmark(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size);

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("clip-path", "url(#clip0_2_53)");
  svg.appendChild(group);

  appendPath(group, {
    d: "M16.25 16.25L7.75 7.75",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  appendPath(group, {
    d: "M7.75 16.25L16.25 7.75",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const clipPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "clipPath",
  );
  clipPath.setAttribute("id", "clip0_2_53");
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", "24");
  rect.setAttribute("height", "24");
  rect.setAttribute("fill", "white");
  clipPath.appendChild(rect);
  defs.appendChild(clipPath);
  svg.appendChild(defs);

  return svg;
}

export function createIconClose(options: SvgOptions = {}): SVGSVGElement {
  const size = options.size ?? 16;
  const svg = createSvgElement(size, "0 0 16 16");

  appendPath(svg, {
    d: "M4 4l8 8M12 4l-8 8",
    stroke: "currentColor",
    "stroke-width": "1.5",
    "stroke-linecap": "round",
  });

  return svg;
}
