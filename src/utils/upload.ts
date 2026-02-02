const UPLOAD_ENDPOINT = 'https://static-storage.conekto.eu/api/public/upload';
type UploadOptions = {
  apiKey?: string;
  filename?: string;
};

export async function uploadDataUrl(
  dataUrl: string,
  options: UploadOptions = {},
): Promise<string | null> {
  try {
    const apiKey = options.apiKey;
    if (!apiKey) return null;

    const result = dataUrlToBlob(dataUrl);
    if (!result) return null;
    const { blob, mime } = result;

    const formData = new FormData();
    const filename = buildFilename(options.filename, mime);
    formData.append('file', blob, filename);

    const headers: HeadersInit = {};

    headers['x-upload-secret'] = apiKey;

    const response = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      console.error('Upload failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const downloadUrl = data.downloadUrl;
    if (downloadUrl.startsWith('http')) {
      return downloadUrl;
    }
    const baseUrl = new URL(UPLOAD_ENDPOINT).origin;
    return `${baseUrl}${downloadUrl}`;
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string } | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length !== 2) return null;

    const mimeMatch = parts[0].match(/:(.*?);/);
    if (!mimeMatch) return null;

    const mime = mimeMatch[1];
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return { blob: new Blob([u8arr], { type: mime }), mime };
  } catch (e) {
    console.error('Error converting data URL to Blob:', e);
    return null;
  }
}

function buildFilename(base: string | undefined, mime: string): string {
  const fallback = 'annotation';
  const name = base && base.trim().length > 0 ? base.trim() : fallback;
  const ext = extensionForMime(mime);
  if (name.includes('.')) {
    return name;
  }
  return `${name}.${ext}`;
}

function extensionForMime(mime: string): string {
  const normal = mime.toLowerCase();
  if (normal === 'image/png') return 'png';
  if (normal === 'image/jpeg') return 'jpg';
  if (normal === 'image/jpg') return 'jpg';
  if (normal === 'image/webp') return 'webp';
  if (normal === 'image/gif') return 'gif';
  if (normal === 'image/svg+xml') return 'svg';
  return 'png';
}
