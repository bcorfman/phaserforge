import type { ProjectSpec } from '../model/types';

export function shouldPreserveViewStateOnProjectLoad(
  currentProject: ProjectSpec | undefined,
  nextProject: ProjectSpec,
): boolean {
  return currentProject?.id === nextProject.id;
}
