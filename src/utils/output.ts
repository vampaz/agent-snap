import type { Annotation, OutputDetailLevel } from '@/types';
import { t } from '@/utils/i18n';

export function generateOutput(
  annotations: Annotation[],
  pathname: string,
  detailLevel: OutputDetailLevel = 'standard',
): string {
  if (annotations.length === 0) return '';

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

  annotations.forEach(function writeAnnotation(annotation, index) {
    if (detailLevel === 'forensic') {
      output += `### ${index + 1}. ${annotation.element}\n`;
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
      const screenshotSrc = annotation.remoteScreenshot || annotation.screenshot;
      if (screenshotSrc) {
        const altText = t('output.screenshotAlt', { index: index + 1 });
        output += `**${t('output.screenshot')}:**\n![${altText}](${screenshotSrc})\n`;
      }
      const attachmentSrcs = annotation.remoteAttachments || annotation.attachments;
      if (attachmentSrcs && attachmentSrcs.length > 0) {
        output += `**${t('output.attachments')}:**\n`;
        attachmentSrcs.forEach((src, i) => {
          const altText = t('output.attachmentAlt', { index: i + 1 });
          output += `![${altText}](${src})\n`;
        });
      }
      output += `**${t('output.feedback')}:** ${annotation.comment}\n\n`;
      return;
    }

    output += `### ${index + 1}. ${annotation.element}\n`;
    output += `**${t('output.location')}:** ${annotation.elementPath}\n`;

    if (annotation.dataTestId) {
      output += `**${t('output.testId')}:** ${annotation.dataTestId}\n`;
    }

    const screenshotSrc = annotation.remoteScreenshot || annotation.screenshot;
    if (screenshotSrc) {
      const altText = t('output.screenshotAlt', { index: index + 1 });
      output += `**${t('output.screenshot')}:**\n![${altText}](${screenshotSrc})\n`;
    }

    const attachmentSrcs = annotation.remoteAttachments || annotation.attachments;
    if (attachmentSrcs && attachmentSrcs.length > 0) {
      output += `**${t('output.attachments')}:**\n`;
      attachmentSrcs.forEach((src, i) => {
        const altText = t('output.attachmentAlt', { index: i + 1 });
        output += `![${altText}](${src})\n`;
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
