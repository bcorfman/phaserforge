import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { sampleProject } from '../model/sampleProject';
import { ViewbarYamlControlsView } from './ViewbarYamlControls';
import { setYamlPickerStartIn } from './yamlPickerState';

function YamlControlsStoryHarness() {
  const [project, setProject] = useState<any>(sampleProject);
  const dispatch = fn((action: any) => {
    const storyState = (window as any).__YAML_STORY_STATE__;
    if (storyState) storyState.dispatchCalls.push(action);
    if (action.type === 'load-yaml-text') {
      setProject((current: any) => ({ ...current, id: action.sourceLabel.replace(/\.ya?ml$/i, '') || current.id }));
    }
  });

  return <ViewbarYamlControlsView project={project} dispatch={dispatch as any} />;
}

const meta = {
  title: 'Editor/ViewbarYamlControls',
  component: YamlControlsStoryHarness,
} satisfies Meta<typeof YamlControlsStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ImportAndExportSharePickerStartLocation: Story = {
  play: async ({ canvasElement }) => {
    setYamlPickerStartIn(undefined);
    const openHandle: any = {
      getFile: async () => new File(['id: picked'], 'picked.yaml', { type: 'application/x-yaml' }),
    };
    const saveHandle: any = {
      createWritable: async () => ({
        write: async () => {},
        close: async () => {},
      }),
    };
    (window as any).__YAML_STORY_STATE__ = { dispatchCalls: [] };
    (window as any).__YAML_PICKER_STORY__ = { openCalls: [], saveCalls: [], openHandle, saveHandle };
    (window as any).showOpenFilePicker = async (options: any) => {
      (window as any).__YAML_PICKER_STORY__.openCalls.push(options);
      return [openHandle];
    };
    (window as any).showSaveFilePicker = async (options: any) => {
      (window as any).__YAML_PICKER_STORY__.saveCalls.push(options);
      return saveHandle;
    };
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('yaml-import-button'));
    await userEvent.click(canvas.getByTestId('yaml-export-button'));
    await userEvent.click(canvas.getByTestId('yaml-import-button'));

    await waitFor(() => {
      const testState = (window as any).__YAML_PICKER_STORY__;
      expect(testState.saveCalls).toHaveLength(1);
      expect(testState.openCalls).toHaveLength(2);
      expect(testState.saveCalls[0]?.startIn).toBe(testState.openHandle);
      expect(testState.openCalls[1]?.startIn).toBe(testState.saveHandle);
    });
  },
};
