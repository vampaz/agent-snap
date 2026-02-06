const UPLOAD_ENDPOINT = 'https://agent-snap.conekto.eu/api/public/upload';

type UploadOptions = {
  apiKey?: string;
  filename?: string;
};

export type UploadResult = {
  downloadUrl: string;
  viewUrl?: string;
  viewerUrl?: string;
  dailyCount?: number | null;
  dailyLimit?: number | null;
  remaining?: number | null;
};

export async function uploadDataUrlAsset(
  dataUrl: string,
  options: UploadOptions = {},
): Promise<UploadResult | null> {
  try {
    const result = dataUrlToBlob(dataUrl);
    if (!result) return null;
    const { blob, mime } = result;

    const formData = new FormData();
    const filename = buildFilename(options.filename, mime);
    formData.append('file', blob, filename);

    const headers: HeadersInit = {};

    if (options.apiKey) {
      headers['x-upload-secret'] = options.apiKey;
    }

    const response = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 429) {
      console.warn('Agent Snap: upload rate limited (HTTP 429). Falling back to local assets.');
      return null;
    }

    if (!response.ok) {
      console.error('Upload failed:', response.status, response.statusText);
      return null;
    }

    const data = (await response.json()) as {
      downloadUrl?: string;
      viewUrl?: string;
      viewerUrl?: string;
      dailyCount?: number | null;
      dailyLimit?: number | null;
      remaining?: number | null;
    };

    const baseUrl = new URL(UPLOAD_ENDPOINT).origin;
    const downloadUrl = normalizeUrl(data.downloadUrl, baseUrl);
    if (!downloadUrl) return null;
    const viewUrl = normalizeUrl(data.viewUrl, baseUrl);
    const viewerUrl = normalizeUrl(data.viewerUrl, baseUrl);

    return {
      downloadUrl: downloadUrl,
      viewUrl: viewUrl,
      viewerUrl: viewerUrl,
      dailyCount: typeof data.dailyCount === 'number' ? data.dailyCount : (data.dailyCount ?? null),
      dailyLimit: typeof data.dailyLimit === 'number' ? data.dailyLimit : (data.dailyLimit ?? null),
      remaining: typeof data.remaining === 'number' ? data.remaining : (data.remaining ?? null),
    };
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

export async function uploadDataUrl(
  dataUrl: string,
  options: UploadOptions = {},
): Promise<string | null> {
  const result = await uploadDataUrlAsset(dataUrl, options);
  return result ? result.downloadUrl : null;
}

function normalizeUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (!value.startsWith('/')) return undefined;
  return `${baseUrl}${value}`;
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
