export type LoadedImageMetadata = {
  src: string;
  name: string;
  mimeType?: string;
  width: number;
  height: number;
};

function readU32BE(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

export function parseImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A, IHDR starts at byte 12.
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = readU32BE(view, 16);
    const height = readU32BE(view, 20);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return { width, height };
  }
  return null;
}

export async function readImageDimensionsFromFile(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const buffer = await file.arrayBuffer();
    return parseImageDimensions(new Uint8Array(buffer));
  } catch {
    return null;
  }
}

export async function loadImageMetadataFromSrc(src: string, name: string, mimeType?: string): Promise<LoadedImageMetadata> {
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Unable to load image'));
  });
  image.src = src;
  await loaded;
  try {
    // Safari/WebKit can report 0x0 until decode completes (especially in headless).
    await image.decode?.();
  } catch {
    // Ignore decode errors; the load event already fired.
  }
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Unable to determine image size');
  }
  return { src, name, mimeType, width, height };
}

export async function loadImageMetadataFromFile(
  file: File,
  dataUrl: string,
): Promise<LoadedImageMetadata> {
  const parsed = await readImageDimensionsFromFile(file);
  if (parsed) {
    return { src: dataUrl, name: file.name, mimeType: file.type || undefined, width: parsed.width, height: parsed.height };
  }
  return loadImageMetadataFromSrc(dataUrl, file.name, file.type || undefined);
}

