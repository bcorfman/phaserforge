// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EntityListView } from '../../src/editor/EntityList';
import { sampleProject } from '../../src/model/sampleProject';

describe('EntityList project startup controls', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('dispatches startup mode changes from the project panel', () => {
    const dispatch = vi.fn();

    render(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="project"
        expandedGroups={{ 'g-enemies': false }}
        mode="edit"
        startupMode="reload_last_yaml"
        dispatch={dispatch}
      />
    );

    fireEvent.change(screen.getByTestId('project-startup-mode-select'), { target: { value: 'new_empty_scene' } });

    expect(dispatch).toHaveBeenCalledWith({ type: 'set-startup-mode', startupMode: 'new_empty_scene' });
  });
});
