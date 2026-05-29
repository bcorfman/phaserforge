export const VIEW_STATE_STORAGE_KEY = 'phaserforge.viewState.v1';

export type ViewState = { zoom: number; scrollX: number; scrollY: number };
export type StoredViewState = ViewState & { projectId: string };

export function parseStoredViewState(raw: string | null | undefined): StoredViewState | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredViewState> | null;
    if (!parsed || typeof parsed !== 'object') return undefined;

    const zoom = Number((parsed as any).zoom);
    const scrollX = Number((parsed as any).scrollX);
    const scrollY = Number((parsed as any).scrollY);
    const projectId = typeof (parsed as any).projectId === 'string' ? (parsed as any).projectId : '';

    if (!Number.isFinite(zoom) || !Number.isFinite(scrollX) || !Number.isFinite(scrollY)) return undefined;
    if (zoom <= 0) return undefined;
    if (!projectId) return undefined;

    return { projectId, zoom, scrollX, scrollY };
  } catch {
    return undefined;
  }
}

export function readStoredViewState(storage: Storage, projectId: string): ViewState | undefined {
  const parsed = parseStoredViewState(storage.getItem(VIEW_STATE_STORAGE_KEY));
  if (!parsed) return undefined;
  if (parsed.projectId !== projectId) return undefined;
  return { zoom: parsed.zoom, scrollX: parsed.scrollX, scrollY: parsed.scrollY };
}

export function writeStoredViewState(storage: Storage, projectId: string, view: ViewState): void {
  const payload: StoredViewState = { projectId, ...view };
  storage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(payload));
}
