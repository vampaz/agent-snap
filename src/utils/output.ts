import type { Annotation, OutputDetailLevel } from '@/types';
import { t } from '@/utils/i18n';

type ResolvedAnnotationAssets = {
  annotation: Annotation;
  screenshotSrc?: string;
  attachmentSrcs?: string[];
};

type AssetManifest = {
  version: 1;
  page: {
    pathname: string;
    url?: string;
  };
  imageOutputMode: 'base64';
  assetDirectory?: string;
  assets: AssetManifestEntry[];
  actions?: AssetManifestAction[];
};

type AssetManifestEntry = {
  id: string;
  annotationId: string;
  annotationIndex: number;
  kind: 'screenshot' | 'attachment';
  data: string;
  mime: string;
  bytes: number;
  filename: string;
};

type AssetManifestAction = {
  type: 'materialize-asset';
  assetId: string;
  outputPath: string;
  strategy?: 'base64';
};

type AssetSourceDescription = {
  data: string;
  mime: string;
  bytes: number;
  filename: string;
};

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
  const assetManifest = buildAssetManifest(resolvedAnnotations, pathname);
  const referencePrefix = t('output.referencePrefix');
  const assetIds = new Set(assetManifest.assets.map((asset) => asset.id));

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

  output += `**${t('output.agentTips')}:** ${t('output.agentTipsText')}\n\n`;
  output += renderAssetManifest(assetManifest);

  resolvedAnnotations.forEach(function writeAnnotation(entry, index) {
    const annotation = entry.annotation;
    const annotationIndex = index + 1;
    const screenshotId = `agent-snap-annotation-${annotationIndex}-screenshot`;
    const attachmentIds = collectAttachmentIds(annotationIndex, entry.attachmentSrcs, assetIds);
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
      if (assetIds.has(screenshotId)) {
        output += `**${t('output.screenshot')}:** ${referencePrefix} ${screenshotId}\n`;
      }
      if (attachmentIds.length > 0) {
        output += `**${t('output.attachments')}:**\n`;
        attachmentIds.forEach((attachmentId) => {
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

    if (assetIds.has(screenshotId)) {
      output += `**${t('output.screenshot')}:** ${referencePrefix} ${screenshotId}\n`;
    }

    if (attachmentIds.length > 0) {
      output += `**${t('output.attachments')}:**\n`;
      attachmentIds.forEach((attachmentId) => {
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

function collectAttachmentIds(
  annotationIndex: number,
  attachments: string[] | undefined,
  assetIds: Set<string>,
): string[] {
  if (!attachments || attachments.length === 0) return [];
  const ids: string[] = [];
  attachments.forEach((_attachment, index) => {
    const attachmentId = `agent-snap-annotation-${annotationIndex}-attachment-${index + 1}`;
    if (assetIds.has(attachmentId)) {
      ids.push(attachmentId);
    }
  });
  return ids;
}

function resolveAnnotationAssets(annotation: Annotation): ResolvedAnnotationAssets {
  return {
    annotation: annotation,
    screenshotSrc: annotation.screenshot,
    attachmentSrcs: annotation.attachments,
  };
}

function buildAssetManifest(
  resolvedAnnotations: ResolvedAnnotationAssets[],
  pathname: string,
): AssetManifest {
  const assets: AssetManifestEntry[] = [];

  resolvedAnnotations.forEach(function collectAssets(entry, index) {
    const annotationIndex = index + 1;
    const annotationId = entry.annotation.id;
    if (entry.screenshotSrc) {
      const asset = buildAssetEntry({
        source: entry.screenshotSrc,
        baseName: `agent-snap-annotation-${annotationIndex}-screenshot`,
        annotationId: annotationId,
        annotationIndex: annotationIndex,
        kind: 'screenshot',
      });
      if (asset) {
        assets.push(asset);
      }
    }
    if (entry.attachmentSrcs) {
      entry.attachmentSrcs.forEach((source, attachmentIndex) => {
        const asset = buildAssetEntry({
          source: source,
          baseName: `agent-snap-annotation-${annotationIndex}-attachment-${attachmentIndex + 1}`,
          annotationId: annotationId,
          annotationIndex: annotationIndex,
          kind: 'attachment',
        });
        if (asset) {
          assets.push(asset);
        }
      });
    }
  });

  const page: { pathname: string; url?: string } = { pathname: pathname };
  if (typeof window !== 'undefined') {
    page.url = window.location.href;
  }
  const actions = buildAssetActions(assets);

  return {
    version: 1,
    page: page,
    imageOutputMode: 'base64',
    assetDirectory: DOWNLOAD_DIRECTORY,
    assets: assets,
    actions: actions.length > 0 ? actions : undefined,
  };
}

function buildAssetActions(assets: AssetManifestEntry[]): AssetManifestAction[] {
  return assets.map(function buildAction(asset) {
    return {
      type: 'materialize-asset',
      assetId: asset.id,
      outputPath: `${DOWNLOAD_DIRECTORY}/${asset.filename}`,
      strategy: 'base64',
    };
  });
}

function buildAssetEntry(options: {
  source: string;
  baseName: string;
  annotationId: string;
  annotationIndex: number;
  kind: 'screenshot' | 'attachment';
}): AssetManifestEntry | null {
  const description = describeAssetSource(options.source, options.baseName);
  if (!description) return null;
  const entry: AssetManifestEntry = {
    id: options.baseName,
    annotationId: options.annotationId,
    annotationIndex: options.annotationIndex,
    kind: options.kind,
    filename: description.filename,
    data: description.data,
    mime: description.mime,
    bytes: description.bytes,
  };
  return entry;
}

function renderAssetManifest(manifest: AssetManifest): string {
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

function describeAssetSource(source: string, baseName: string): AssetSourceDescription | null {
  const dataPayload = parseDataUrl(source);
  if (!dataPayload) return null;
  const filename = dataPayload.extension ? `${baseName}.${dataPayload.extension}` : baseName;
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
