// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';

const persistence = vi.hoisted(() => ({
  loadPreferencesRecord: vi.fn(async () => null),
  updatePreferencesRecord: vi.fn(async () => null),
}));

vi.mock('../../src/editor/projectPersistence', () => ({
  projectPersistence: persistence,
}));

describe('actionPins', () => {
  beforeEach(() => {
    vi.resetModules();
    persistence.loadPreferencesRecord.mockReset();
    persistence.updatePreferencesRecord.mockReset();
    persistence.loadPreferencesRecord.mockResolvedValue(null);
    persistence.updatePreferencesRecord.mockImplementation(async (patch: any) => patch);
  });

  it('returns empty when window is not available (SSR-safe)', async () => {
    const prevWindow = (globalThis as any).window;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (globalThis as any).window;

    const pins = await import('../../src/editor/actionPins');
    expect(pins.loadPinnedActionTypes()).toEqual([]);
    await pins.savePinnedActionTypes(['MoveUntil']);
    expect(pins.loadPinnedActionTypes()).toEqual([]);

    (globalThis as any).window = prevWindow;
  });

  it('returns empty when storage is empty or invalid JSON', async () => {
    const pins = await import('../../src/editor/actionPins');
    persistence.loadPreferencesRecord.mockResolvedValueOnce(null);
    await pins.loadPinnedActionTypesFromPersistence();
    expect(pins.loadPinnedActionTypes()).toEqual([]);
    persistence.loadPreferencesRecord.mockResolvedValueOnce({ pinnedActionTypes: undefined });
    await pins.loadPinnedActionTypesFromPersistence();
    expect(pins.loadPinnedActionTypes()).toEqual([]);
  });

  it('dedupes + sorts when saving and loading', async () => {
    const pins = await import('../../src/editor/actionPins');
    await pins.savePinnedActionTypes(['Wait', 'MoveUntil', 'Wait', '', 'Repeat']);
    expect(pins.loadPinnedActionTypes()).toEqual(['MoveUntil', 'Repeat', 'Wait']);
  });

  it('toggles pin on/off and persists', async () => {
    const pins = await import('../../src/editor/actionPins');

    expect(await pins.togglePinnedActionType('MoveUntil')).toEqual(['MoveUntil']);
    expect(pins.loadPinnedActionTypes()).toEqual(['MoveUntil']);

    expect(await pins.togglePinnedActionType('MoveUntil')).toEqual([]);
    expect(pins.loadPinnedActionTypes()).toEqual([]);
  });
});
