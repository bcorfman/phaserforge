import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { sampleProject } from '../model/sampleProject';
import { ViewbarYamlControlsView } from './ViewbarYamlControls';
import { setYamlFileHandle, setYamlFileSourceLabel, setYamlPickerStartIn } from './yamlPickerState';

function YamlControlsStoryHarness() {
  const [project, setProject] = useState<any>(sampleProject);
  const dispatch = fn((action: any) => {
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

export const OpenAndSaveSharePickerHandle: Story = {
  play: async ({ canvasElement }) => {
    setYamlPickerStartIn(undefined);
    setYamlFileHandle(undefined);
    setYamlFileSourceLabel(undefined);
    const openHandle: any = {
      getFile: async () => new File(['id: picked'], 'picked.yaml', { type: 'application/x-yaml' }),
    };
    const saveHandle: any = {
      createWritable: async () => ({
        write: async () => {},
        close: async () => {},
      }),
    };
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
    await userEvent.click(canvas.getByTestId('yaml-open-button'));
    await userEvent.click(canvas.getByTestId('yaml-save-as-button'));
    await userEvent.click(canvas.getByTestId('yaml-open-button'));

    await waitFor(() => {
      const testState = (window as any).__YAML_PICKER_STORY__;
      expect(testState.saveCalls).toHaveLength(1);
      expect(testState.openCalls).toHaveLength(2);
      expect(testState.saveCalls[0]?.startIn).toBe(testState.openHandle);
      expect(testState.openCalls[1]?.startIn).toBe(testState.saveHandle);
    });
  },
};

export const SaveExistingHandle: Story = {
  play: async ({ canvasElement }) => {
    const writes: string[] = [];
    const saveHandle: any = {
      createWritable: async () => ({
        write: async (text: string) => writes.push(text),
        close: async () => {},
      }),
    };
    setYamlPickerStartIn(undefined);
    setYamlFileHandle(saveHandle);
    setYamlFileSourceLabel('scene.yaml');
    (window as any).__YAML_SAVE_STORY__ = { writes, saveHandle };
    (window as any).showSaveFilePicker = async () => saveHandle;
    (window as any).showOpenFilePicker = undefined;
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('yaml-save-button'));
    await waitFor(() => {
      expect((window as any).__YAML_SAVE_STORY__.writes.length).toBe(1);
    });
  },
};
