// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EntityListView } from '../../src/editor/EntityList';
import { sampleProject } from '../../src/model/sampleProject';

describe('EntityList project scope', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not render the removed startup and reset panel', () => {
    render(
      <EntityListView
        project={sampleProject}
        currentSceneId={sampleProject.initialSceneId}
        scene={sampleProject.scenes[sampleProject.initialSceneId]}
        selection={{ kind: 'none' }}
        sidebarScope="project"
        expandedGroups={{ 'g-enemies': false }}
        mode="edit"
        dispatch={() => {}}
      />
    );

    expect(screen.queryByTestId('project-startup-panel')).toBeNull();
    expect(screen.queryByTestId('project-startup-mode-select')).toBeNull();
    expect(screen.queryByTestId('project-reset-now-button')).toBeNull();
  });
});
