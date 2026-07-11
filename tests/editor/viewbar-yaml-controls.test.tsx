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
  let handle: unknown;
  let label: string | undefined;
  return {
    reset() {
      startIn = undefined;
      handle = undefined;
      label = undefined;
    },
    getStartIn: vi.fn(() => startIn),
    setStartIn: vi.fn((value: unknown) => {
      startIn = value;
    }),
    getHandle: vi.fn(() => handle),
    setHandle: vi.fn((value: unknown) => {
      handle = value;
    }),
    getLabel: vi.fn(() => label),
    setLabel: vi.fn((value: string | undefined) => {
      label = value;
    }),
  };
});

const yamlIoMocks = vi.hoisted(() => ({
  picker: vi.fn(),
  readFileHandleText: vi.fn(),
  writeTextToHandle: vi.fn(),
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
  getYamlFileHandle: yamlPickerState.getHandle,
  setYamlFileHandle: yamlPickerState.setHandle,
  getYamlFileSourceLabel: yamlPickerState.getLabel,
  setYamlFileSourceLabel: yamlPickerState.setLabel,
}));

vi.mock('../../src/editor/yamlFileHandles', () => ({
  getOpenFilePicker: () => yamlIoMocks.picker,
  readFileHandleText: yamlIoMocks.readFileHandleText,
  writeTextToHandle: yamlIoMocks.writeTextToHandle,
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
    yamlPickerState.getHandle.mockClear();
    yamlPickerState.setHandle.mockClear();
    yamlPickerState.getLabel.mockClear();
    yamlPickerState.setLabel.mockClear();
    yamlIoMocks.picker.mockReset();
    yamlIoMocks.readFileHandleText.mockReset();
    yamlIoMocks.writeTextToHandle.mockReset();
    yamlIoMocks.exportYamlToDisk.mockReset();
  });

  it('loads YAML through the picker and dispatches the parsed text source', async () => {
    yamlControlsStore.state.project = sampleProject;
    const handle = { id: 'yaml-handle' };
    yamlIoMocks.picker.mockResolvedValue([handle]);
    yamlIoMocks.readFileHandleText.mockResolvedValue({ text: 'id: loaded', label: 'loaded.yaml' });

    render(<ViewbarYamlControls />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('yaml-open-button'));

    expect(yamlIoMocks.picker).toHaveBeenCalledTimes(1);
    expect(yamlPickerState.setStartIn).toHaveBeenCalledWith(handle);
    expect(yamlPickerState.setHandle).toHaveBeenCalledWith(handle);
    expect(yamlPickerState.setLabel).toHaveBeenCalledWith('loaded.yaml');
    expect(yamlControlsStore.dispatch).toHaveBeenCalledWith({
      type: 'load-yaml-text',
      text: 'id: loaded',
      sourceLabel: 'loaded.yaml',
    });
  });

  it('writes YAML back to the existing handle and dispatches saved status', async () => {
    yamlControlsStore.state.project = sampleProject;
    const handle = { id: 'save-handle' };
    yamlPickerState.setHandle(handle);
    yamlPickerState.setLabel('scene.yaml');
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    render(<ViewbarYamlControls />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('yaml-save-button'));

    expect(yamlIoMocks.writeTextToHandle).toHaveBeenCalledWith(handle, serializeProjectToYaml(sampleProject));
    expect(yamlControlsStore.dispatch).toHaveBeenNthCalledWith(1, { type: 'set-error', error: undefined });
    expect(yamlControlsStore.dispatch).toHaveBeenNthCalledWith(2, { type: 'mark-saved' });
    expect(yamlControlsStore.dispatch).toHaveBeenNthCalledWith(3, {
      type: 'set-status',
      message: 'Saved YAML: scene.yaml',
      expiresAt: 1_700_000_004_000,
    });
  });

  it('shows the persisted filename label without shifting the save buttons', () => {
    yamlControlsStore.state.project = sampleProject;
    yamlPickerState.setLabel('level-01.yaml');

    render(<ViewbarYamlControls />);

    expect(screen.getByTestId('yaml-file-label').textContent).toBe('level-01.yaml');
    expect(screen.queryByTestId('yaml-file-label-hidden')).toBeNull();
  });

  it('hides the filename label until a filename exists', () => {
    yamlControlsStore.state.project = sampleProject;

    render(<ViewbarYamlControls />);

    expect(screen.queryByTestId('yaml-file-label')).toBeNull();
    expect(screen.getByTestId('yaml-file-label-hidden')).not.toBeNull();
  });

  it('stores the chosen filename immediately after first save-as so it is visible for later saves', async () => {
    yamlControlsStore.state.project = sampleProject;
    const handle = { id: 'save-handle', name: 'first-save.yaml' };
    yamlIoMocks.exportYamlToDisk.mockResolvedValue({ kind: 'saved', handle, label: 'first-save.yaml' });

    render(<ViewbarYamlControls />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('yaml-save-button'));

    expect(yamlIoMocks.exportYamlToDisk).toHaveBeenCalledWith(
      serializeProjectToYaml(sampleProject),
      expect.objectContaining({ suggestedName: 'scene.yaml', startIn: undefined }),
    );
    expect(yamlPickerState.setHandle).toHaveBeenCalledWith(handle);
    expect(yamlPickerState.setLabel).toHaveBeenCalledWith('first-save.yaml');
  });
});
