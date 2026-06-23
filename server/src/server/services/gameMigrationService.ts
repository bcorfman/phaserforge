import { canonicalizeProjectForComparison, projectsSemanticallyEqual } from '../../../../src/model/projectCanonical';
import { parseProjectYaml } from '../../../../src/model/serialization';
import type { ProjectSpec } from '../../../../src/model/types';
import { validateProjectSpec } from '../../../../src/model/validation';

export type LegacyCloudGameYamlRow = {
  id: string;
  title: string;
  yaml: string;
};

export type MigratedCloudGameRow = {
  id: string;
  title: string;
  project: ProjectSpec;
  canonicalProject: string;
};

export function convertLegacyCloudGameYamlToProject(yaml: string): {
  project: ProjectSpec;
  canonicalProject: string;
} {
  try {
    const project = parseProjectYaml(yaml);
    validateProjectSpec(project);
    const canonicalProject = canonicalizeProjectForComparison(project);
    const canonicalRoundTrip = JSON.parse(canonicalProject) as ProjectSpec;
    if (!projectsSemanticallyEqual(project, canonicalRoundTrip)) {
      throw new Error('canonical_project_mismatch');
    }
    return { project, canonicalProject };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid_yaml_project:${message}`);
  }
}

export function migrateLegacyCloudGames(rows: LegacyCloudGameYamlRow[]): MigratedCloudGameRow[] {
  return rows.map((row) => {
    try {
      const converted = convertLegacyCloudGameYamlToProject(row.yaml);
      return {
        id: row.id,
        title: row.title,
        project: converted.project,
        canonicalProject: converted.canonicalProject,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`cloud_game_migration_failed:${row.id}:${message}`);
    }
  });
}
