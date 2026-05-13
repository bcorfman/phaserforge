import type { AttachmentSpec, AttachmentTemplate, Id, MacroSpec, ProjectSpec, SceneSpec, TargetRef } from '../model/types';
import { applySnippetToTargetAndEvent } from './snippetCommands';

export function createMacroFromAttachments(
  project: ProjectSpec,
  scene: SceneSpec,
  attachmentIds: Id[],
  opts: { name?: string } = {}
): { project: ProjectSpec; macroId: Id } {
  const uniqueIds = Array.from(new Set(attachmentIds)).filter(Boolean);
  const attachments = uniqueIds
    .map((id) => scene.attachments?.[id])
    .filter((a): a is AttachmentSpec => Boolean(a))
    .sort((a, b) => {
      const ao = a.order ?? 0;
      const bo = b.order ?? 0;
      if (ao !== bo) return ao - bo;
      return a.id.localeCompare(b.id);
    });
  const macroId: Id = `macro-${Date.now()}`;
  const name = (opts.name && opts.name.trim().length > 0) ? opts.name.trim() : `Macro ${Object.keys(project.macros ?? {}).length + 1}`;

  const indexById = new Map<string, number>();
  attachments.forEach((a, index) => indexById.set(a.id, index));

  const body: AttachmentTemplate[] = attachments.map((a) => {
    const parentIndex = a.parentAttachmentId ? indexById.get(a.parentAttachmentId) : undefined;
    return {
      ...(a.name ? { name: a.name } : {}),
      ...(a.enabled === false ? { enabled: false } : {}),
      ...(a.applyTo ? { applyTo: a.applyTo } : {}),
      presetId: a.presetId,
      ...(a.params ? { params: a.params } : {}),
      ...(a.condition ? { condition: a.condition } : {}),
      ...(a.tag ? { tag: a.tag } : {}),
      ...(parentIndex !== undefined ? { parentIndex } : {}),
    };
  });

  const macro: MacroSpec = {
    id: macroId,
    name,
    params: [],
    body,
  };

  return {
    macroId,
    project: {
      ...project,
      macros: {
        ...(project.macros ?? {}),
        [macroId]: macro,
      },
    },
  };
}

export function applyMacroToTargetAndEvent(scene: SceneSpec, target: TargetRef, eventId: Id | undefined, macro: MacroSpec): SceneSpec {
  // v1: macros are expansion-only (no parameter binding yet).
  const snippetLike = { id: macro.id, name: macro.name, kind: 'attachments' as const, attachmentsTemplate: macro.body };
  return applySnippetToTargetAndEvent(scene, target, eventId, snippetLike as any);
}

