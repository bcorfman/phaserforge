import type { AttachmentSpec, AttachmentTemplate, Id, ProjectSpec, SceneSpec, SnippetSpec, TargetRef } from '../model/types';

function allocId(prefix: string, index: number): Id {
  return `${prefix}-${Date.now()}-${index + 1}`;
}

export function createSnippetFromAttachments(
  project: ProjectSpec,
  scene: SceneSpec,
  attachmentIds: Id[],
  opts: { name?: string } = {}
): { project: ProjectSpec; snippetId: Id } {
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
  const snippetId: Id = `snippet-${Date.now()}`;
  const name = (opts.name && opts.name.trim().length > 0) ? opts.name.trim() : `Snippet ${Object.keys(project.snippets ?? {}).length + 1}`;

  const indexById = new Map<string, number>();
  attachments.forEach((a, index) => indexById.set(a.id, index));

  const attachmentsTemplate: AttachmentTemplate[] = attachments.map((a) => {
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

  const snippet: SnippetSpec = {
    id: snippetId,
    name,
    kind: 'attachments',
    source: { sceneId: scene.id, targetKind: attachments[0]?.target.type },
    attachmentsTemplate,
  };

  return {
    snippetId,
    project: {
      ...project,
      snippets: {
        ...(project.snippets ?? {}),
        [snippetId]: snippet,
      },
    },
  };
}

export function applySnippetToTargetAndEvent(
  scene: SceneSpec,
  target: TargetRef,
  eventId: Id | undefined,
  snippet: SnippetSpec
): SceneSpec {
  const template = snippet.attachmentsTemplate ?? [];
  if (template.length === 0) return scene;

  const existing = Object.values(scene.attachments ?? {})
    .filter((a) => {
      if (a.target.type !== target.type) return false;
      if (target.type === 'entity') return a.target.entityId === (target as any).entityId;
      return a.target.groupId === (target as any).groupId;
    })
    .filter((a) => (typeof a.eventId === 'string' && a.eventId.length > 0 ? a.eventId : undefined) === (eventId && eventId.length > 0 ? eventId : undefined))
    .filter((a) => !a.parentAttachmentId)
    .sort((a, b) => {
      const ao = a.order ?? 0;
      const bo = b.order ?? 0;
      if (ao !== bo) return ao - bo;
      return a.id.localeCompare(b.id);
    });
  const baseOrder = existing.length === 0 ? 0 : (existing[existing.length - 1].order ?? existing.length - 1) + 1;

  const nextAttachments: Record<Id, AttachmentSpec> = { ...(scene.attachments ?? {}) };
  const createdIds: Id[] = [];
  const createdByIndex = new Map<number, Id>();

  for (let index = 0; index < template.length; index += 1) {
    const t = template[index];
    const id = allocId('att', index);
    createdIds.push(id);
    createdByIndex.set(index, id);
    nextAttachments[id] = {
      id,
      target,
      ...(eventId ? { eventId } : {}),
      presetId: t.presetId,
      ...(t.name ? { name: t.name } : {}),
      ...(t.enabled === false ? { enabled: false } : { enabled: true }),
      ...(t.applyTo ? { applyTo: t.applyTo } : {}),
      order: baseOrder + index,
      ...(t.params ? { params: t.params } : {}),
      ...(t.condition ? { condition: t.condition } : {}),
      ...(t.tag ? { tag: t.tag } : {}),
    } as any;
  }

  // Wire nesting.
  for (let index = 0; index < template.length; index += 1) {
    const t = template[index];
    const id = createdByIndex.get(index);
    if (!id) continue;
    if (t.parentIndex === undefined) continue;
    const parentId = createdByIndex.get(t.parentIndex);
    if (!parentId) continue;
    const child = nextAttachments[id];
    nextAttachments[id] = { ...child, parentAttachmentId: parentId };
    const parent = nextAttachments[parentId];
    const children = Array.isArray((parent as any).children) ? (parent as any).children : [];
    if (!children.includes(id)) nextAttachments[parentId] = { ...(parent as any), children: [...children, id] };
  }

  return { ...scene, attachments: nextAttachments };
}

