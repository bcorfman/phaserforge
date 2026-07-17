// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { sampleScene } from '../../src/model/sampleScene';

const dispatch = vi.hoisted(() => vi.fn());
const eventBus = vi.hoisted(() => ({
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));

vi.mock('../../src/editor/projectPersistence', () => ({
  projectPersistence: {
    loadPreferencesRecord: vi.fn(async () => ({ inspectorFoldouts: { 'group.visualVariations': true } })),
    updatePreferencesRecord: vi.fn(async () => undefined),
  },
}));

vi.mock('../../src/phaser/EventBus', () => ({
  EventBus: eventBus,
}));

vi.mock('../../src/util/deterministicRandom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/util/deterministicRandom')>();
  return {
    ...actual,
    makeSeed: vi.fn(() => 'variation-reroll'),
  };
});

vi.mock('../../src/editor/EditorStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/editor/EditorStore')>();
  const project = {
    id: 'project-1',
    assets: { images: {}, spriteSheets: {}, fonts: {} },
    audio: { sounds: {} },
    inputMaps: {},
    scenes: { [sampleScene.id]: sampleScene as any },
    initialSceneId: sampleScene.id,
    collections: {},
    counters: {},
  };

  return {
    ...actual,
    useEditorStore: () => ({
      state: {
        project,
        currentSceneId: sampleScene.id,
        selection: { kind: 'group', id: 'g-enemies' },
        interaction: undefined,
        registry: { arrange: [], actions: [], conditions: [] },
      },
      dispatch,
    }),
  };
});

import { Inspector } from '../../src/editor/Inspector';

describe('Inspector formation tint variation wiring', () => {
  afterEach(() => {
    cleanup();
    dispatch.mockReset();
    eventBus.emit.mockReset();
    eventBus.on.mockReset();
    eventBus.off.mockReset();
  });

  it('keeps preview reversible while Apply and Reroll commit one store action', async () => {
    render(<Inspector />);

    fireEvent.click(await screen.findByTestId('formation-variation-preview'));
    expect(dispatch).not.toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenLastCalledWith(
      'formation-tint-preview-changed',
      expect.objectContaining({
        groupId: 'g-enemies',
        tints: expect.any(Object),
      })
    );

    fireEvent.click(screen.getByTestId('formation-variation-reroll'));
    expect(eventBus.emit).toHaveBeenLastCalledWith(
      'formation-tint-preview-changed',
      { groupId: 'g-enemies', tints: undefined }
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'apply-group-tint-variation',
      groupId: 'g-enemies',
      seed: 'variation-reroll',
    }));
    dispatch.mockReset();

    fireEvent.click(screen.getByTestId('formation-variation-cancel'));
    expect(dispatch).not.toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenLastCalledWith(
      'formation-tint-preview-changed',
      { groupId: 'g-enemies', tints: undefined }
    );

    fireEvent.click(screen.getByTestId('formation-variation-apply'));
    expect(eventBus.emit).toHaveBeenLastCalledWith(
      'formation-tint-preview-changed',
      { groupId: 'g-enemies', tints: undefined }
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'apply-group-tint-variation',
      groupId: 'g-enemies',
      seed: 'variation-reroll',
    }));
  });
});
