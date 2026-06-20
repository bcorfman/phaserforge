import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';

import { createEmptyProject } from '../model/emptyProject';
import { sampleProject } from '../model/sampleProject';
import { EntityListView } from './EntityList';

function makeProjectWithAsset() {
  const project: any = structuredClone(sampleProject);
  project.assets.images = {
    enemy_A: {
      id: 'enemy_A',
      name: 'enemy_A',
      source: { kind: 'embedded', dataUrl: 'data:image/png;base64,AAAA', originalName: 'enemy_A.png', mimeType: 'image/png' },
    },
  };
  return project;
}

function EntityListStoryHarness({
  initialSidebarScope = 'projectTree',
  project = makeProjectWithAsset(),
  dispatchSpy = fn(),
}: {
  initialSidebarScope?: 'projectTree' | 'projectRevisions';
  project?: any;
  dispatchSpy?: ReturnType<typeof fn>;
}) {
  const [sidebarScope, setSidebarScope] = useState<'projectTree' | 'projectRevisions'>(initialSidebarScope);
  const currentSceneId = project.initialSceneId;

  return (
    <EntityListView
      project={project}
      currentSceneId={currentSceneId}
      scene={project.scenes[currentSceneId]}
      selection={{ kind: 'none' }}
      sidebarScope={sidebarScope}
      expandedGroups={{}}
      mode="edit"
      dispatch={(action) => {
        dispatchSpy(action);
        if (action.type === 'set-sidebar-scope') setSidebarScope(action.scope);
      }}
    />
  );
}

const meta = {
  title: 'Editor/EntityList',
  component: EntityListStoryHarness,
  args: {
    initialSidebarScope: 'projectTree',
    project: makeProjectWithAsset(),
    dispatchSpy: fn(),
  },
} satisfies Meta<typeof EntityListStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SceneScopeDefault: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('project-tree-root-button')).toBeTruthy();
    expect(canvas.getByTestId('sprites-dropzone')).toBeTruthy();
    expect(canvas.getByTestId('assets-dock')).toBeTruthy();
  },
};

export const ProjectScopeDefault: Story = {
  args: {
    project: createEmptyProject(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { name: 'Project Tree' })).toBeTruthy();
    expect(canvas.getByRole('heading', { name: 'Input Maps' })).toBeTruthy();
    expect(canvas.getByTestId('sprites-dropzone')).toBeTruthy();
    expect(canvas.getByTestId('assets-dock')).toBeTruthy();
    expect(canvas.queryByTestId('project-startup-panel')).toBeNull();
    expect(args.dispatchSpy).not.toHaveBeenCalled();
  },
};
