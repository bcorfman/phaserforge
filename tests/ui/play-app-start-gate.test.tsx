// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const project = {
  id: 'project-1',
  title: 'Published Game',
  initialSceneId: 'scene-1',
  assets: { fonts: {}, images: {}, spriteSheets: {} },
  audio: { sounds: {} },
  scenes: {
    'scene-1': {
      id: 'scene-1',
      name: 'Scene 1',
      entities: {},
      groups: {},
      attachments: {},
      eventBlocks: {},
      behaviors: {},
      actions: {},
      conditions: {},
      backgroundLayers: [],
      collisionRules: [],
      triggers: [],
    },
  },
} as any;

const eventBus = vi.hoisted(() => ({
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));

vi.mock('../../src/phaser/PhaserHost', () => ({
  PhaserGame: ({ currentActiveScene }: { currentActiveScene?: () => void }) => {
    React.useEffect(() => {
      currentActiveScene?.();
    }, [currentActiveScene]);
    return <div data-testid="mock-phaser-game" />;
  },
}));

vi.mock('../../src/phaser/EventBus', () => ({
  EventBus: eventBus,
  getActiveScene: () => null,
}));

vi.mock('../../src/cloud/api', () => ({
  getGame: vi.fn(async () => ({ game: { project } })),
}));

vi.mock('../../src/model/serialization', () => ({
  parseProjectYaml: vi.fn(() => project),
  parseProjectSnapshot: vi.fn(() => project),
}));

vi.mock('../../src/editor/sceneWorld', () => ({
  getSceneWorld: () => ({ width: 640, height: 480 }),
}));

vi.mock('../../src/AudioDebugOverlay', () => ({
  AudioDebugOverlay: () => null,
}));

import PlayApp from '../../src/PlayApp';

describe('PlayApp start gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.head.innerHTML = '';
    window.history.replaceState({}, '', '/?yamlUrl=%2Fgame.yaml');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'project: yaml' })) as any);
  });

  afterEach(() => {
    cleanup();
    delete (window as any).__phaserGame;
    vi.unstubAllGlobals();
  });

  it('shows a click-to-start gate before mounting the runtime', async () => {
    render(<PlayApp />);

    expect((await screen.findByTestId('play-start-gate')).textContent).toContain('Click to Start');
    expect(fetch).toHaveBeenCalledWith('/game.yaml', { credentials: 'omit', cache: 'no-store' });
    expect(await screen.findByTestId('mock-phaser-game')).not.toBeNull();
    expect(eventBus.emit).not.toHaveBeenCalledWith('runtime:load-project', expect.anything(), expect.anything(), 'play');
  });

  it('loads structured project snapshots when a project URL is provided', async () => {
    window.history.replaceState({}, '', '/?projectUrl=%2Fgame.json');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ version: 1, project }) })) as any);

    render(<PlayApp />);

    expect(await screen.findByTestId('play-start-gate')).not.toBeNull();
    expect(fetch).toHaveBeenCalledWith('/game.json', { credentials: 'omit', cache: 'no-store' });
  });

  it('starts the game only after the player clicks the gate', async () => {
    render(<PlayApp />);

    const startGate = await screen.findByTestId('play-start-gate');
    await waitFor(() => {
      expect((startGate as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(startGate);

    expect(await screen.findByTestId('mock-phaser-game')).not.toBeNull();
    expect(eventBus.emit).toHaveBeenCalledWith('runtime:load-project', project, 'scene-1', 'play');
    await waitFor(() => {
      expect(screen.queryByTestId('play-start-gate')).toBeNull();
    });
  });

  it('uses the start click to unlock the mounted Phaser audio context', async () => {
    const unlock = vi.fn();
    const resume = vi.fn();
    (window as any).__phaserGame = {
      sound: {
        unlock,
        context: { resume },
      },
    };
    render(<PlayApp />);

    const startGate = await screen.findByTestId('play-start-gate');
    await waitFor(() => {
      expect((startGate as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(startGate);

    expect(unlock).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(eventBus.emit).toHaveBeenCalledWith('runtime:load-project', project, 'scene-1', 'play');
    expect(unlock.mock.invocationCallOrder[0]).toBeLessThan(eventBus.emit.mock.invocationCallOrder[0]);
  });
});
