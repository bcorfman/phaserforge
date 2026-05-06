export type FilePickerLike = (options?: unknown) => Promise<any>;

export function getOpenFilePicker(): FilePickerLike | null {
  if (typeof window === 'undefined') return null;
  const picker = (window as any).showOpenFilePicker;
  return typeof picker === 'function' ? (picker as FilePickerLike) : null;
}

export async function readFileHandleText(handle: any): Promise<{ text: string; label: string }> {
  const file = await handle.getFile();
  const label = file?.name ? String(file.name) : 'picked file';
  return { text: await file.text(), label };
}

export async function writeTextToHandle(handle: any, text: string): Promise<void> {
  if (!handle || typeof handle.createWritable !== 'function') {
    throw new Error('File handle is not writable');
  }
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

