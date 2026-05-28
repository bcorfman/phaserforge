import type { ProjectSpec } from '../model/types';
import { parseProjectYaml, serializeProjectToYaml } from '../model/serialization';

export type WorkspaceSummary = {
  scenes: number;
  entities: number;
  groups: number;
  assets: number;
};

export type YamlWorkspaceSummary =
  | ({ ok: true; canonicalYaml: string; summary: WorkspaceSummary })
  | ({ ok: false; canonicalYaml?: string; summary: WorkspaceSummary; error: string });

export function summarizeProject(project: ProjectSpec): WorkspaceSummary {
  const scenes = Object.keys(project.scenes ?? {}).length;

  let entities = 0;
  let groups = 0;
  for (const scene of Object.values(project.scenes ?? {})) {
    entities += Object.keys(scene.entities ?? {}).length;
    groups += Object.keys(scene.groups ?? {}).length;
  }

  const assets =
    Object.keys(project.assets?.images ?? {}).length +
    Object.keys(project.assets?.spriteSheets ?? {}).length +
    Object.keys(project.assets?.fonts ?? {}).length +
    Object.keys(project.audio?.sounds ?? {}).length;

  return { scenes, entities, groups, assets };
}

export function summarizeYamlWorkspace(yamlText: string): YamlWorkspaceSummary {
  try {
    const project = parseProjectYaml(yamlText);
    const canonicalYaml = serializeProjectToYaml(project);
    return { ok: true, canonicalYaml, summary: summarizeProject(project) };
  } catch (err) {
    return {
      ok: false,
      summary: { scenes: 0, entities: 0, groups: 0, assets: 0 },
      error: err instanceof Error ? err.message : 'invalid_yaml',
    };
  }
}

