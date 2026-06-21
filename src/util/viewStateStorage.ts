export const VIEW_STATE_STORAGE_KEY = 'phaserforge.viewState.v1';

export type ViewState = {
  zoom: number;
  scrollX: number;
  scrollY: number;
  viewportWidth?: number;
  viewportHeight?: number;
};
export type StoredViewState = ViewState & { projectId: string };

export function shouldPersistViewState(options: {
  projectId: string | null | undefined;
  initialized: boolean;
  restoreAttempted: boolean;
}): boolean {
  return Boolean(options.projectId) && options.initialized && options.restoreAttempted;
}

export function shouldResetViewStateForProjectChange(options: {
  initialized: boolean;
  currentProjectId: string | null | undefined;
  lastProjectId: string | null | undefined;
}): boolean {
  return Boolean(options.initialized && options.currentProjectId && options.lastProjectId && options.currentProjectId !== options.lastProjectId);
}

export function doesReportedViewMatchCurrentScene(options: {
  initialized: boolean;
  reportedWorldWidth?: number;
  reportedWorldHeight?: number;
  currentWorldWidth: number;
  currentWorldHeight: number;
}): boolean {
  if (!options.initialized) return true;
  if (!Number.isFinite(options.reportedWorldWidth) || !Number.isFinite(options.reportedWorldHeight)) return false;
  return options.reportedWorldWidth === options.currentWorldWidth && options.reportedWorldHeight === options.currentWorldHeight;
}

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

    const viewportWidth = Number((parsed as any).viewportWidth);
    const viewportHeight = Number((parsed as any).viewportHeight);

    return {
      projectId,
      zoom,
      scrollX,
      scrollY,
      viewportWidth: Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : undefined,
      viewportHeight: Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : undefined,
    };
  } catch {
    return undefined;
  }
}

export function readStoredViewState(storage: Storage, projectId: string): ViewState | undefined {
  const parsed = parseStoredViewState(storage.getItem(VIEW_STATE_STORAGE_KEY));
  if (!parsed) return undefined;
  if (parsed.projectId !== projectId) return undefined;
  return {
    zoom: parsed.zoom,
    scrollX: parsed.scrollX,
    scrollY: parsed.scrollY,
    viewportWidth: parsed.viewportWidth,
    viewportHeight: parsed.viewportHeight,
  };
}

export function writeStoredViewState(storage: Storage, projectId: string, view: ViewState): void {
  const payload: StoredViewState = { projectId, ...view };
  storage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(payload));
}
