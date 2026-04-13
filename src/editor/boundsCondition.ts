import { type Selection } from './EditorStore';
import { type Id, type SceneSpec } from '../model/types';

export function getPrimaryBoundsConditionId(scene: SceneSpec): Id | undefined {
  return Object.values(scene.attachments).find((attachment) => attachment.presetId === 'MoveUntil' && attachment.condition?.type === 'BoundsHit')?.id;
}

export function getEditableBoundsConditionId(scene: SceneSpec, selection: Selection): Id | undefined {
  if (selection.kind !== 'attachment') return undefined;
  const attachment = scene.attachments[selection.id];
  if (!attachment) return undefined;
  return attachment.presetId === 'MoveUntil' && attachment.condition?.type === 'BoundsHit' ? attachment.id : undefined;
}
