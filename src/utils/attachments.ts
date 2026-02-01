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
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = () => resolve(null);
    reader.onabort = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
