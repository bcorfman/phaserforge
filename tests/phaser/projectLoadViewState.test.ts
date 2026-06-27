import { describe, expect, it } from 'vitest';

import type { ProjectSpec } from '../../src/model/types';
import { shouldPreserveViewStateOnProjectLoad } from '../../src/phaser/projectLoadViewState';

function project(id: string): ProjectSpec {
  return {
    id,
    scenes: {},
    initialSceneId: 'scene-1',
    assets: {
      images: {},
      spriteSheets: {},
      fonts: {},
    },
    audio: {
      sounds: {},
    },
    inputMaps: {},
  };
}

describe('shouldPreserveViewStateOnProjectLoad', () => {
  it('preserves view state when reloading the same project', () => {
    expect(shouldPreserveViewStateOnProjectLoad(project('project-1'), project('project-1'))).toBe(true);
  });

  it('does not preserve view state when loading a different project', () => {
    expect(shouldPreserveViewStateOnProjectLoad(project('project-1'), project('project-2'))).toBe(false);
  });

  it('does not preserve view state for the first loaded project', () => {
    expect(shouldPreserveViewStateOnProjectLoad(undefined, project('project-1'))).toBe(false);
  });
});
