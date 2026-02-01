export async function readImageFiles(files: File[], max: number): Promise<string[]> {
  const results: string[] = [];
  if (max <= 0) return results;

  for (const file of files) {
    if (results.length >= max) break;
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await readFileAsDataUrl(file);
    if (dataUrl) {
      results.push(dataUrl);
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
  return compressImage(dataUrl);
}

async function compressImage(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
