import type {
  AttachmentSpec,
  AttachmentTemplate,
  Id,
  ParamSpec,
  PatternSpec,
  ProjectSpec,
  SceneSpec,
  TargetRef,
  TemplatePrimitive,
} from '../model/types';
import { applySnippetToTargetAndEvent } from './snippetCommands';

function coerceParamBinding(param: ParamSpec, raw: unknown): { ok: true; value: string | number | boolean } | { ok: false; error: string } {
  const value = raw ?? param.default;
  if (value === undefined) return { ok: false, error: `Missing required param: ${param.name}` };

  switch (param.type) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(String(value));
      if (!Number.isFinite(n)) return { ok: false, error: `Invalid number for param: ${param.name}` };
      return { ok: true, value: n };
    }
    case 'boolean': {
      if (typeof value === 'boolean') return { ok: true, value };
      const s = String(value).trim().toLowerCase();
      if (s === 'true') return { ok: true, value: true };
      if (s === 'false') return { ok: true, value: false };
      return { ok: false, error: `Invalid boolean for param: ${param.name}` };
    }
    case 'string':
    case 'target': {
      return { ok: true, value: String(value) };
    }
    default: {
      // Exhaustiveness guard for older projects.
      return { ok: true, value: String(value) };
    }
  }
}

function substituteInString(text: string, bindings: Record<string, string | number | boolean>): string {
  let out = text;
  for (const [paramId, value] of Object.entries(bindings)) {
    out = out.split(`{{${paramId}}}`).join(String(value));
  }
  return out;
}

function substitutePrimitiveForParams(value: TemplatePrimitive, bindings: Record<string, string | number | boolean>): TemplatePrimitive {
  if (typeof value !== 'string') return value;

  // If the entire value is a single placeholder, preserve the bound type.
  for (const [paramId, bound] of Object.entries(bindings)) {
    if (value === `{{${paramId}}}`) return bound as any;
  }
  return substituteInString(value, bindings);
}

export function createPatternFromAttachments(
  project: ProjectSpec,
  scene: SceneSpec,
  attachmentIds: Id[],
  opts: { name?: string } = {}
): { project: ProjectSpec; patternId: Id } {
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

  const patternId: Id = `pattern-${Date.now()}`;
  const name = opts.name && opts.name.trim().length > 0 ? opts.name.trim() : `Pattern ${Object.keys(project.patterns ?? {}).length + 1}`;

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

  const pattern: PatternSpec = {
    id: patternId,
    name,
    params: [],
    body,
    source: { sceneId: scene.id, targetKind: attachments[0]?.target.type },
  };

  return {
    patternId,
    project: {
      ...project,
      patterns: {
        ...(project.patterns ?? {}),
        [patternId]: pattern,
      },
    },
  };
}

export function applyPatternToTargetAndEvent(
  scene: SceneSpec,
  target: TargetRef,
  eventId: Id | undefined,
  pattern: PatternSpec,
  bindings: Record<Id, unknown>
): { scene: SceneSpec; error?: string } {
  const template = pattern.body ?? [];
  if (template.length === 0) return { scene };

  const bound: Record<string, string | number | boolean> = {};
  for (const param of pattern.params ?? []) {
    const coerced = coerceParamBinding(param as any, (bindings as any)[param.id]);
    if (!coerced.ok) return { scene, error: coerced.error };
    bound[param.id] = coerced.value;
  }

  const substituted: AttachmentTemplate[] = template.map((t) => {
    const nextParams: Record<string, TemplatePrimitive> | undefined =
      t.params && typeof t.params === 'object'
        ? Object.fromEntries(Object.entries(t.params).map(([k, v]) => [k, substitutePrimitiveForParams(v as any, bound)]))
        : undefined;

    return {
      ...t,
      ...(t.name ? { name: substituteInString(t.name, bound) } : {}),
      ...(t.tag ? { tag: substituteInString(t.tag, bound) } : {}),
      ...(nextParams ? { params: nextParams } : {}),
    };
  });

  // Reuse the existing attachment expansion logic.
  const snippetLike = { id: pattern.id, name: pattern.name, kind: 'attachments' as const, attachmentsTemplate: substituted };
  const nextScene = applySnippetToTargetAndEvent(scene, target, eventId, snippetLike as any);
  return nextScene === scene ? { scene } : { scene: nextScene };
}
