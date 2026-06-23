import { describe, expect, it } from 'vitest';

import { createEmptyProject } from '../../src/model/emptyProject';
import { serializeProjectToYaml } from '../../src/model/serialization';
import {
  convertLegacyCloudGameYamlToProject,
  migrateLegacyCloudGames,
} from '../../server/src/server/services/gameMigrationService';

describe('game migration service', () => {
  it('converts legacy cloud YAML to a structured project with a canonical fingerprint', () => {
    const project = createEmptyProject();
    project.id = 'project-1';
    project.title = 'Migrated Game';

    const result = convertLegacyCloudGameYamlToProject(serializeProjectToYaml(project));

    expect(result.project).toEqual(project);
    expect(typeof result.canonicalProject).toBe('string');
    expect(result.canonicalProject.length).toBeGreaterThan(10);
  });

  it('blocks migration when legacy YAML is malformed', () => {
    expect(() => convertLegacyCloudGameYamlToProject('not: [valid')).toThrow(/invalid|yaml/i);
  });

  it('migrates every legacy cloud row and blocks if any row fails', () => {
    const project = createEmptyProject();
    project.id = 'project-1';
    project.title = 'Migrated Game';

    expect(() => migrateLegacyCloudGames([
      { id: 'g-1', title: 'Migrated Game', yaml: serializeProjectToYaml(project) },
      { id: 'g-2', title: 'Broken Game', yaml: 'not: [valid' },
    ])).toThrow(/g-2/);
  });
});
