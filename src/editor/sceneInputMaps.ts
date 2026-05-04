import type { GameSceneSpec, ProjectSpec } from '../model/types';

export type SceneMapSelection = { kind: 'project-default' } | { kind: 'none' } | { kind: 'map'; mapId: string };

export function readSceneMapSelection(
  sceneInput: GameSceneSpec['input'] | undefined,
  which: 'active' | 'fallback'
): SceneMapSelection {
  const noneFlag = which === 'active' ? sceneInput?.activeMapNone : sceneInput?.fallbackMapNone;
  if (noneFlag) return { kind: 'none' };
  const mapId = which === 'active' ? sceneInput?.activeMapId : sceneInput?.fallbackMapId;
  if (typeof mapId === 'string' && mapId.length > 0) return { kind: 'map', mapId };
  return { kind: 'project-default' };
}

export function listSceneInputActionIds(scene: GameSceneSpec, project: ProjectSpec): string[] {
  const maps = project.inputMaps ?? {};
  const projectDefault = project.defaultInputMapId;

  const activeSelection = readSceneMapSelection(scene.input, 'active');
  if (activeSelection.kind === 'none') return [];

  const selectionIds: string[] = [];
  for (const which of ['active', 'fallback'] as const) {
    const selection = which === 'active' ? activeSelection : readSceneMapSelection(scene.input, which);
    if (selection.kind === 'none') continue;
    const id = selection.kind === 'map' ? selection.mapId : projectDefault;
    if (typeof id === 'string' && id.length > 0) selectionIds.push(id);
  }

  const unique: string[] = [];
  for (const id of selectionIds) if (!unique.includes(id)) unique.push(id);

  const actionIds = new Set<string>();
  for (const id of unique) {
    const map = maps[id];
    if (!map) continue;
    for (const actionId of Object.keys(map.actions ?? {})) actionIds.add(actionId);
  }

  return Array.from(actionIds).sort();
}

export function listActiveSceneInputActionIds(scene: GameSceneSpec, project: ProjectSpec): string[] {
  const maps = project.inputMaps ?? {};
  const projectDefault = project.defaultInputMapId;
  const selection = readSceneMapSelection(scene.input, 'active');
  if (selection.kind === 'none') return [];
  const id = selection.kind === 'map' ? selection.mapId : projectDefault;
  if (typeof id !== 'string' || id.length === 0) return [];
  const map = maps[id];
  if (!map) return [];
  return Object.keys(map.actions ?? {}).sort();
}
