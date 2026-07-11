// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sampleProject } from '../../src/model/sampleProject';
import { serializeProjectToYaml } from '../../src/model/serialization';

const yamlControlsStore = vi.hoisted(() => ({
  state: { project: null as unknown },
  dispatch: vi.fn(),
}));

const yamlPickerState = vi.hoisted(() => {
  let startIn: unknown;
  return {
    reset() {
      startIn = undefined;
    },
    getStartIn: vi.fn(() => startIn),
    setStartIn: vi.fn((value: unknown) => {
      startIn = value;
    }),
  };
});

const yamlIoMocks = vi.hoisted(() => ({
  picker: vi.fn(),
  readFileHandleText: vi.fn(),
  exportYamlToDisk: vi.fn(),
}));

vi.mock('../../src/editor/EditorStore', () => ({
  useEditorStore: () => ({
    state: yamlControlsStore.state,
    dispatch: yamlControlsStore.dispatch,
  }),
}));

vi.mock('../../src/editor/yamlPickerState', () => ({
  getYamlPickerStartIn: yamlPickerState.getStartIn,
  setYamlPickerStartIn: yamlPickerState.setStartIn,
}));

vi.mock('../../src/editor/yamlFileHandles', () => ({
  getOpenFilePicker: () => yamlIoMocks.picker,
  readFileHandleText: yamlIoMocks.readFileHandleText,
}));

vi.mock('../../src/editor/yamlFileExport', () => ({
  exportYamlToDisk: yamlIoMocks.exportYamlToDisk,
}));

import { ViewbarYamlControls } from '../../src/editor/ViewbarYamlControls';

describe('ViewbarYamlControls', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    yamlControlsStore.dispatch.mockReset();
    yamlControlsStore.state.project = sampleProject;
    yamlPickerState.reset();
    yamlPickerState.getStartIn.mockClear();
    yamlPickerState.setStartIn.mockClear();
    yamlIoMocks.picker.mockReset();
    yamlIoMocks.readFileHandleText.mockReset();
    yamlIoMocks.exportYamlToDisk.mockReset();
  });

  it('loads YAML through the picker and dispatches the parsed text source', async () => {
    yamlControlsStore.state.project = sampleProject;
    const handle = { id: 'yaml-handle' };
    yamlIoMocks.picker.mockResolvedValue([handle]);
    yamlIoMocks.readFileHandleText.mockResolvedValue({ text: 'id: loaded', label: 'loaded.yaml' });

    render(<ViewbarYamlControls />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('yaml-import-button'));

    expect(yamlIoMocks.picker).toHaveBeenCalledTimes(1);
    expect(yamlPickerState.setStartIn).toHaveBeenCalledWith(handle);
    expect(yamlControlsStore.dispatch).toHaveBeenCalledWith({
      type: 'load-yaml-text',
      text: 'id: loaded',
      sourceLabel: 'loaded.yaml',
    });
  });

  it('exports YAML through the save picker and dispatches saved status', async () => {
    yamlControlsStore.state.project = sampleProject;
    const handle = { id: 'save-handle', name: 'first-save.yaml' };
    yamlIoMocks.exportYamlToDisk.mockResolvedValue({ kind: 'saved', handle });
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    render(<ViewbarYamlControls />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('yaml-export-button'));

    expect(yamlIoMocks.exportYamlToDisk).toHaveBeenCalledWith(
      serializeProjectToYaml(sampleProject),
      expect.objectContaining({ suggestedName: 'scene.yaml', startIn: undefined }),
    );
    expect(yamlPickerState.setStartIn).toHaveBeenCalledWith(handle);
    expect(yamlControlsStore.dispatch).toHaveBeenNthCalledWith(1, { type: 'set-error', error: undefined });
    expect(yamlControlsStore.dispatch).toHaveBeenNthCalledWith(2, { type: 'mark-saved' });
    expect(yamlControlsStore.dispatch).toHaveBeenNthCalledWith(3, {
      type: 'set-status',
      message: 'Saved YAML',
      expiresAt: 1_700_000_004_000,
    });
  });
});
