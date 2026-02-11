import type { Annotation, OutputDetailLevel } from '@/types';
import { t } from '@/utils/i18n';

type ResolvedAnnotationAssets = {
  annotation: Annotation;
  screenshotSrc?: string;
  attachmentSrcs?: string[];
};

type AgentSnapV3Payload = {
  version: 3;
  reportId: string;
  capturedAt: string;
  source: {
    url: string;
    pathname: string;
    viewport: {
      width: number;
      height: number;
    };
    devicePixelRatio: number;
  };
  capabilities: {
    assetTransport: 'inline_base64';
    supportsExternalUrls: false;
    supportsOcr: false;
  };
  annotations: AgentSnapV3Annotation[];
  assets: AgentSnapV3Asset[];
  tasks: AgentSnapV3Task[];
};

type AgentSnapV3Annotation = {
  id: string;
  label: string;
  selector: string;
  dataTestId?: string;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  targetAssetId: string;
  relatedAssetIds: string[];
  context?: {
    pageSection?: string;
    elementRole?: string;
  };
};

type AgentSnapV3Asset = {
  id: string;
  kind: 'element_crop' | 'attachment';
  mime: string;
  transport: {
    type: 'inline_base64';
    data: string;
  };
  meta: {
    filename: string;
    bytes: number;
    base64Length: number;
    sha256: string;
    width: number;
    height: number;
  };
  provenance: {
    annotationId: string;
    captureMethod: 'agent-snap';
  };
};

type AgentSnapV3Task = {
  id: string;
  type: 'find_visual_issue';
  priority: 'normal';
  instruction: string;
  target: {
    annotationId: string;
    assetId: string;
  };
  output: {
    format: 'markdown';
    maxTokens: 250;
    language: 'en-US';
  };
};

type AssetSourceDescription = {
  data: string;
  mime: string;
  bytes: number;
  filename: string;
};

type AnnotationAssetRefs = {
  screenshotAssetId?: string;
  attachmentAssetIds: string[];
};

type CompatAssetManifest = {
  version: 1;
  page: {
    pathname: string;
    url?: string;
  };
  imageOutputMode: 'base64';
  assetDirectory: string;
  assets: Array<{
    id: string;
    annotationId: string;
    kind: 'screenshot' | 'attachment';
    data: string;
    mime: string;
    bytes: number;
    filename: string;
  }>;
  actions: Array<{
    type: 'materialize-asset';
    assetId: string;
    outputPath: string;
    strategy: 'base64';
  }>;
};

const FALLBACK_TRANSPARENT_WEBP_BASE64 =
  'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==';
const DOWNLOAD_DIRECTORY = './agent-snap-downloads';

export function generateOutput(
  annotations: Annotation[],
  pathname: string,
  detailLevel: OutputDetailLevel = 'standard',
): string {
  if (annotations.length === 0) return '';

  const resolvedAnnotations = annotations.map(function resolveAssets(annotation) {
    return resolveAnnotationAssets(annotation);
  });
  const captureTime = new Date().toISOString();
  const built = buildAgentSnapV3Payload(resolvedAnnotations, pathname, captureTime);
  const payload = built.payload;
  const annotationAssetRefs = built.annotationAssetRefs;
  const referencePrefix = t('output.referencePrefix');

  const viewport =
    typeof window !== 'undefined'
      ? `${window.innerWidth}x${window.innerHeight}`
      : t('output.unknown');

  let output = `## ${t('output.pageFeedback')}: ${pathname}\n`;

  if (detailLevel === 'forensic') {
    output += `\n**${t('output.environment')}:**\n`;
    output += `- ${t('output.viewport')}: ${viewport}\n`;
    if (typeof window !== 'undefined') {
      output += `- ${t('output.url')}: ${window.location.href}\n`;
      output += `- ${t('output.userAgent')}: ${navigator.userAgent}\n`;
      output += `- ${t('output.timestamp')}: ${new Date().toISOString()}\n`;
      output += `- ${t('output.devicePixelRatio')}: ${window.devicePixelRatio}\n`;
    }
    output += '\n---\n';
  } else {
    output += `**${t('output.viewport')}:** ${viewport}\n`;
  }
  output += '\n';

  output += renderAgentSnapV3Payload(payload);
  output += renderCompatAssetManifest(payload, pathname);
  output += `**${t('output.agentTips')}:** ${t('output.agentTipsText')}\n\n`;

  resolvedAnnotations.forEach(function writeAnnotation(entry, index) {
    const annotation = entry.annotation;
    const annotationRefs = annotationAssetRefs[index] || {
      attachmentAssetIds: [],
    };
    const screenshotId = annotationRefs.screenshotAssetId;
    const attachmentIds = annotationRefs.attachmentAssetIds;
    const annotationIndex = index + 1;

    if (detailLevel === 'forensic') {
      output += `### ${annotationIndex}. ${annotation.element}\n`;
      if (annotation.isMultiSelect && annotation.fullPath) {
        output += `*${t('output.forensicNote')}*\n`;
      }
      if (annotation.fullPath) {
        output += `**${t('output.fullDomPath')}:** ${annotation.fullPath}\n`;
      }
      if (annotation.dataTestId) {
        output += `**${t('output.testId')}:** ${annotation.dataTestId}\n`;
      }
      if (annotation.cssClasses) {
        output += `**${t('output.cssClasses')}:** ${annotation.cssClasses}\n`;
      }
      if (annotation.boundingBox) {
        output += `**${t('output.position')}:** x:${Math.round(annotation.boundingBox.x)}, y:${Math.round(annotation.boundingBox.y)} (${Math.round(annotation.boundingBox.width)}x${Math.round(annotation.boundingBox.height)}px)\n`;
      }
      output += `**${t('output.annotationAt')}:** ${annotation.x.toFixed(1)}% from left, ${Math.round(annotation.y)}px from top\n`;
      if (annotation.selectedText) {
        output += `**${t('output.selectedText')}:** "${annotation.selectedText}"\n`;
      }
      if (annotation.nearbyText && !annotation.selectedText) {
        output += `**${t('output.context')}:** ${annotation.nearbyText.slice(0, 100)}\n`;
      }
      if (annotation.computedStyles) {
        output += `**${t('output.computedStyles')}:** ${annotation.computedStyles}\n`;
      }
      if (annotation.accessibility) {
        output += `**${t('output.accessibility')}:** ${annotation.accessibility}\n`;
      }
      if (annotation.nearbyElements) {
        output += `**${t('output.nearbyElements')}:** ${annotation.nearbyElements}\n`;
      }
      if (screenshotId) {
        output += `**${t('output.screenshot')}:** ${referencePrefix} ${screenshotId}\n`;
      }
      if (attachmentIds.length > 0) {
        output += `**${t('output.attachments')}:**\n`;
        attachmentIds.forEach(function writeAttachment(attachmentId) {
          output += `${referencePrefix} ${attachmentId}\n`;
        });
      }
      output += `**${t('output.feedback')}:** ${annotation.comment}\n\n`;
      return;
    }

    output += `### ${annotationIndex}. ${annotation.element}\n`;
    output += `**${t('output.location')}:** ${annotation.elementPath}\n`;

    if (annotation.dataTestId) {
      output += `**${t('output.testId')}:** ${annotation.dataTestId}\n`;
    }

    if (screenshotId) {
      output += `**${t('output.screenshot')}:** ${referencePrefix} ${screenshotId}\n`;
    }

    if (attachmentIds.length > 0) {
      output += `**${t('output.attachments')}:**\n`;
      attachmentIds.forEach(function writeAttachment(attachmentId) {
        output += `${referencePrefix} ${attachmentId}\n`;
      });
    }

    if (detailLevel === 'detailed') {
      if (annotation.cssClasses) {
        output += `**${t('output.classes')}:** ${annotation.cssClasses}\n`;
      }

      if (annotation.boundingBox) {
        output += `**${t('output.position')}:** ${Math.round(annotation.boundingBox.x)}px, ${Math.round(annotation.boundingBox.y)}px (${Math.round(annotation.boundingBox.width)}x${Math.round(annotation.boundingBox.height)}px)\n`;
      }
    }

    if (annotation.selectedText) {
      output += `**${t('output.selectedText')}:** "${annotation.selectedText}"\n`;
    }

    if (detailLevel === 'detailed' && annotation.nearbyText && !annotation.selectedText) {
      output += `**${t('output.context')}:** ${annotation.nearbyText.slice(0, 100)}\n`;
    }

    output += `**${t('output.feedback')}:** ${annotation.comment}\n\n`;
  });

  return output.trim();
}

function resolveAnnotationAssets(annotation: Annotation): ResolvedAnnotationAssets {
  return {
    annotation: annotation,
    screenshotSrc: annotation.screenshot,
    attachmentSrcs: annotation.attachments,
  };
}

function buildAgentSnapV3Payload(
  resolvedAnnotations: ResolvedAnnotationAssets[],
  pathname: string,
  capturedAt: string,
): { payload: AgentSnapV3Payload; annotationAssetRefs: AnnotationAssetRefs[] } {
  const assets: AgentSnapV3Asset[] = [];
  const annotations: AgentSnapV3Annotation[] = [];
  const tasks: AgentSnapV3Task[] = [];
  const annotationRefs: AnnotationAssetRefs[] = [];

  resolvedAnnotations.forEach(function mapAnnotation(entry, index) {
    const sourceAnnotation = entry.annotation;
    const annotationId = buildAnnotationId(sourceAnnotation.id, index + 1);
    const targetAssetId = buildAssetId(annotationId, 'target');
    const attachmentAssetIds: string[] = [];
    let hasTargetAsset = false;

    if (entry.screenshotSrc) {
      const targetAsset = buildAssetEntry({
        source: entry.screenshotSrc,
        id: targetAssetId,
        annotationId: annotationId,
        kind: 'element_crop',
        box: sourceAnnotation.boundingBox,
      });
      if (targetAsset) {
        assets.push(targetAsset);
        hasTargetAsset = true;
      }
    }

    if (entry.attachmentSrcs) {
      entry.attachmentSrcs.forEach(function mapAttachment(source, attachmentIndex) {
        const attachmentId = buildAssetId(annotationId, `attachment_${attachmentIndex + 1}`);
        const attachmentAsset = buildAssetEntry({
          source: source,
          id: attachmentId,
          annotationId: annotationId,
          kind: 'attachment',
          box: sourceAnnotation.boundingBox,
        });
        if (attachmentAsset) {
          assets.push(attachmentAsset);
          attachmentAssetIds.push(attachmentId);
        }
      });
    }

    if (!hasTargetAsset) {
      const fallbackAsset = buildAssetEntry({
        source: `data:image/webp;base64,${FALLBACK_TRANSPARENT_WEBP_BASE64}`,
        id: targetAssetId,
        annotationId: annotationId,
        kind: 'element_crop',
        box: sourceAnnotation.boundingBox,
      });
      if (fallbackAsset) {
        assets.push(fallbackAsset);
        hasTargetAsset = true;
      }
    }

    const box = resolveAnnotationBox(sourceAnnotation);
    const context = buildAnnotationContext(sourceAnnotation.elementPath);

    annotations.push({
      id: annotationId,
      label: sourceAnnotation.element,
      selector: sourceAnnotation.elementPath,
      dataTestId: sourceAnnotation.dataTestId || undefined,
      box: box,
      targetAssetId: targetAssetId,
      relatedAssetIds: attachmentAssetIds,
      context: context,
    });

    tasks.push({
      id: `task_${String(index + 1).padStart(3, '0')}`,
      type: 'find_visual_issue',
      priority: 'normal',
      instruction: sourceAnnotation.comment,
      target: {
        annotationId: annotationId,
        assetId: targetAssetId,
      },
      output: {
        format: 'markdown',
        maxTokens: 250,
        language: 'en-US',
      },
    });

    annotationRefs.push({
      screenshotAssetId: entry.screenshotSrc ? targetAssetId : undefined,
      attachmentAssetIds: attachmentAssetIds,
    });
  });

  const source = resolveSource(pathname);

  return {
    payload: {
      version: 3,
      reportId: buildReportId(capturedAt),
      capturedAt: capturedAt,
      source: source,
      capabilities: {
        assetTransport: 'inline_base64',
        supportsExternalUrls: false,
        supportsOcr: false,
      },
      annotations: annotations,
      assets: assets,
      tasks: tasks,
    },
    annotationAssetRefs: annotationRefs,
  };
}

function resolveSource(pathname: string): AgentSnapV3Payload['source'] {
  if (typeof window === 'undefined') {
    return {
      url: pathname,
      pathname: pathname,
      viewport: { width: 0, height: 0 },
      devicePixelRatio: 1,
    };
  }

  return {
    url: window.location.href,
    pathname: pathname,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    devicePixelRatio: window.devicePixelRatio,
  };
}

function buildReportId(capturedAt: string): string {
  const date = new Date(capturedAt);
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `snap_${y}${m}${d}_${hh}${mm}${ss}_01`;
}

function buildAnnotationId(rawId: string, index: number): string {
  const normalized = normalizeToken(rawId);
  if (normalized) {
    return `ann_${normalized}`;
  }
  return `ann_${String(index).padStart(3, '0')}`;
}

function buildAssetId(annotationId: string, suffix: string): string {
  return `asset_${annotationId}_${suffix}`;
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function resolveAnnotationBox(annotation: Annotation): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (annotation.boundingBox) {
    return {
      x: annotation.boundingBox.x,
      y: annotation.boundingBox.y,
      width: annotation.boundingBox.width,
      height: annotation.boundingBox.height,
    };
  }

  return {
    x: annotation.x,
    y: annotation.y,
    width: 0,
    height: 0,
  };
}

function buildAnnotationContext(
  selector: string,
): { pageSection?: string; elementRole?: string } | undefined {
  const parts = selector
    .split('>')
    .map(function trimPart(part) {
      return part.trim();
    })
    .filter(Boolean);

  if (parts.length === 0) return undefined;

  return {
    pageSection: parts[0],
    elementRole: parts[parts.length - 1],
  };
}

function buildAssetEntry(options: {
  source: string;
  id: string;
  annotationId: string;
  kind: 'element_crop' | 'attachment';
  box?: { x: number; y: number; width: number; height: number };
}): AgentSnapV3Asset | null {
  const description = describeAssetSource(options.source, options.id);
  if (!description) return null;

  const width = options.box ? Math.max(Math.round(options.box.width), 0) : 0;
  const height = options.box ? Math.max(Math.round(options.box.height), 0) : 0;

  return {
    id: options.id,
    kind: options.kind,
    mime: description.mime,
    transport: {
      type: 'inline_base64',
      data: description.data,
    },
    meta: {
      filename: description.filename,
      bytes: description.bytes,
      base64Length: description.data.length,
      sha256: computeSha256ForBase64(description.data),
      width: width,
      height: height,
    },
    provenance: {
      annotationId: options.annotationId,
      captureMethod: 'agent-snap',
    },
  };
}

function renderAgentSnapV3Payload(payload: AgentSnapV3Payload): string {
  return `\`\`\`agent-snap-v3\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n\n`;
}

function renderCompatAssetManifest(payload: AgentSnapV3Payload, pathname: string): string {
  const manifest: CompatAssetManifest = {
    version: 1,
    page: {
      pathname: pathname,
      url: payload.source.url,
    },
    imageOutputMode: 'base64',
    assetDirectory: DOWNLOAD_DIRECTORY,
    assets: payload.assets.map(function mapAsset(asset) {
      return {
        id: asset.id,
        annotationId: asset.provenance.annotationId,
        kind: asset.kind === 'element_crop' ? 'screenshot' : 'attachment',
        data: asset.transport.data,
        mime: asset.mime,
        bytes: asset.meta.bytes,
        filename: asset.meta.filename,
      };
    }),
    actions: payload.assets.map(function mapAction(asset) {
      return {
        type: 'materialize-asset',
        assetId: asset.id,
        outputPath: `${DOWNLOAD_DIRECTORY}/${asset.meta.filename}`,
        strategy: 'base64',
      };
    }),
  };

  return `\`\`\`agent-snap-assets\n${JSON.stringify(manifest, null, 2)}\n\`\`\`\n\n`;
}

function parseDataUrl(
  url: string,
): { base64: string; extension: string | null; mime: string } | null {
  if (!url.startsWith('data:')) return null;
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const base64 = match[2];
  return { base64: base64, extension: extensionForMime(mime), mime: mime };
}

function describeAssetSource(source: string, id: string): AssetSourceDescription | null {
  const dataPayload = parseDataUrl(source);
  if (!dataPayload) return null;
  const filename = dataPayload.extension ? `${id}.${dataPayload.extension}` : id;
  return {
    data: dataPayload.base64,
    mime: dataPayload.mime,
    bytes: base64ByteLength(dataPayload.base64),
    filename: filename,
  };
}

function base64ByteLength(base64: string): number {
  const normalized = base64.replace(/[\r\n\s]/g, '');
  if (!normalized) return 0;
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

function computeSha256ForBase64(base64: string): string {
  const bytes = base64ToBytes(base64);
  const hash = sha256Bytes(bytes);
  return bytesToHex(hash);
}

function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/[\r\n\s]/g, '');
  if (!normalized) return new Uint8Array(0);
  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return new TextEncoder().encode(normalized);
  }
}

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count));
}

function sha256Bytes(input: Uint8Array): Uint8Array {
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const w = new Array(64).fill(0);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const messageLength = input.length;
  const bitLength = messageLength * 8;
  const totalLength = Math.ceil((messageLength + 1 + 8) / 64) * 64;
  const message = new Uint8Array(totalLength);
  message.set(input);
  message[messageLength] = 0x80;

  const bitLengthHi = Math.floor(bitLength / 0x100000000);
  const bitLengthLo = bitLength >>> 0;
  message[totalLength - 8] = (bitLengthHi >>> 24) & 0xff;
  message[totalLength - 7] = (bitLengthHi >>> 16) & 0xff;
  message[totalLength - 6] = (bitLengthHi >>> 8) & 0xff;
  message[totalLength - 5] = bitLengthHi & 0xff;
  message[totalLength - 4] = (bitLengthLo >>> 24) & 0xff;
  message[totalLength - 3] = (bitLengthLo >>> 16) & 0xff;
  message[totalLength - 2] = (bitLengthLo >>> 8) & 0xff;
  message[totalLength - 1] = bitLengthLo & 0xff;

  for (let offset = 0; offset < totalLength; offset += 64) {
    for (let t = 0; t < 16; t += 1) {
      const index = offset + t * 4;
      w[t] =
        (message[index] << 24) |
        (message[index + 1] << 16) |
        (message[index + 2] << 8) |
        message[index + 3];
    }

    for (let t = 16; t < 64; t += 1) {
      const s0 = rotateRight(w[t - 15], 7) ^ rotateRight(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotateRight(w[t - 2], 17) ^ rotateRight(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (((w[t - 16] + s0) >>> 0) + ((w[t - 7] + s1) >>> 0)) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (((((h + s1) >>> 0) + ch) >>> 0) + ((k[t] + w[t]) >>> 0)) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return new Uint8Array([
    (h0 >>> 24) & 0xff,
    (h0 >>> 16) & 0xff,
    (h0 >>> 8) & 0xff,
    h0 & 0xff,
    (h1 >>> 24) & 0xff,
    (h1 >>> 16) & 0xff,
    (h1 >>> 8) & 0xff,
    h1 & 0xff,
    (h2 >>> 24) & 0xff,
    (h2 >>> 16) & 0xff,
    (h2 >>> 8) & 0xff,
    h2 & 0xff,
    (h3 >>> 24) & 0xff,
    (h3 >>> 16) & 0xff,
    (h3 >>> 8) & 0xff,
    h3 & 0xff,
    (h4 >>> 24) & 0xff,
    (h4 >>> 16) & 0xff,
    (h4 >>> 8) & 0xff,
    h4 & 0xff,
    (h5 >>> 24) & 0xff,
    (h5 >>> 16) & 0xff,
    (h5 >>> 8) & 0xff,
    h5 & 0xff,
    (h6 >>> 24) & 0xff,
    (h6 >>> 16) & 0xff,
    (h6 >>> 8) & 0xff,
    h6 & 0xff,
    (h7 >>> 24) & 0xff,
    (h7 >>> 16) & 0xff,
    (h7 >>> 8) & 0xff,
    h7 & 0xff,
  ]);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(function toHex(byte) {
      return byte.toString(16).padStart(2, '0');
    })
    .join('');
}

function extensionForMime(mime: string): string | null {
  const normalized = mime.toLowerCase();
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/jpg') return 'jpg';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/gif') return 'gif';
  if (normalized === 'image/svg+xml') return 'svg';
  return null;
}
