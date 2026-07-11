type FilePickerLike = (options?: unknown) => Promise<any>;

function getSaveFilePicker(): FilePickerLike | null {
  if (typeof window === 'undefined') return null;
  const picker = (window as any).showSaveFilePicker;
  return typeof picker === 'function' ? (picker as FilePickerLike) : null;
}

export type YamlExportResult = { kind: 'saved'; handle: any } | { kind: 'downloaded' };

export async function exportYamlToDisk(
  yaml: string,
  options: { suggestedName?: string; startIn?: any } = {}
): Promise<YamlExportResult> {
  const suggestedName = options.suggestedName ?? 'scene.yaml';
  const picker = getSaveFilePicker();
  if (picker) {
    const handle = await picker({
      suggestedName,
      types: [
        {
          description: 'YAML',
          accept: {
            'application/x-yaml': ['.yaml', '.yml'],
          },
        },
      ],
      ...(options.startIn ? { startIn: options.startIn } : {}),
    });

    const writable = await handle.createWritable();
    await writable.write(yaml);
    await writable.close();
    return { kind: 'saved', handle };
  }

  if (typeof document === 'undefined') throw new Error('Document unavailable for download fallback');

  const blob = new Blob([yaml], { type: 'application/x-yaml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = suggestedName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }

  return { kind: 'downloaded' };
}
