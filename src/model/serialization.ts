import { parse, stringify } from 'yaml';
import { SceneSpec } from './types';
import { migrateSceneSpec } from './migrateScene';

export function serializeSceneToYaml(scene: SceneSpec): string {
  return stringify(scene, {
    indent: 2,
    lineWidth: 0,
    minContentWidth: 0,
  });
}

export function parseSceneYaml(text: string): SceneSpec {
  const parsed = parse(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid YAML scene');
  }
  return migrateSceneSpec(parsed);
}
