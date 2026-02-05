export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 1000000;
export const ATTACHMENT_COMPRESSION_THRESHOLD_BYTES = 300000;
export const ATTACHMENT_JPEG_QUALITY = 0.85;

export async function readImageFiles(
  files: File[],
  max: number = MAX_ATTACHMENTS,
): Promise<string[]> {
  const results: string[] = [];
  const limit = Math.min(Math.max(max, 0), MAX_ATTACHMENTS);
  if (limit <= 0) return results;

  for (const file of files) {
    if (results.length >= limit) break;
    if (!file.type.startsWith('image/')) continue;
    if (file.size > MAX_ATTACHMENT_BYTES) continue;
    const dataUrl = await readFileAsDataUrl(file);
    if (dataUrl) {
      let finalUrl = dataUrl;
      if (file.size > ATTACHMENT_COMPRESSION_THRESHOLD_BYTES) {
        const compressed = await compressDataUrlToJpeg(dataUrl, ATTACHMENT_JPEG_QUALITY);
        if (compressed) {
          finalUrl = compressed;
        }
      }
      results.push(finalUrl);
    }
  }

  return results;
}

async function readFileAsDataUrl(file: File): Promise<string | null> {
  const dataUrl = await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = () => resolve(null);
    reader.onabort = () => resolve(null);
    reader.readAsDataURL(file);
  });

  if (!dataUrl) return null;
  return dataUrl;
}

async function compressDataUrlToJpeg(dataUrl: string, quality: number): Promise<string | null> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return await new Promise<string | null>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = function handleLoad() {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width || 1;
      canvas.height = image.naturalHeight || image.height || 1;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(null);
        return;
      }
      context.drawImage(image, 0, 0);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(null);
      }
    };
    image.onerror = function handleError() {
      resolve(null);
    };
    image.src = dataUrl;
  });
}
