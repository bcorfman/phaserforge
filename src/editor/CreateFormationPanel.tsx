import { useEffect, useMemo, useState } from 'react';
import type { EditorRegistryConfig, EditorRegistryEntry, Id, SceneSpec } from '../model/types';
import { getNextFormationName } from './behaviorCommands';
import { getSceneWorld } from './sceneWorld';
import { ValidatedNumberInput } from './ValidatedNumberInput';

type ArrangeParamSpec = { name: string; type?: string };

function arePairedArrangeParams(a: ArrangeParamSpec, b: ArrangeParamSpec): boolean {
  const aName = a.name;
  const bName = b.name;
  const aLower = aName.toLowerCase();
  const bLower = bName.toLowerCase();

  if ((aLower === 'x' && bLower === 'y') || (aLower === 'y' && bLower === 'x')) return true;
  if ((aLower === 'width' && bLower === 'height') || (aLower === 'height' && bLower === 'width')) return true;
  if ((aLower === 'rows' && bLower === 'cols') || (aLower === 'cols' && bLower === 'rows')) return true;

  if (aName.endsWith('X') && bName.endsWith('Y') && aName.slice(0, -1) === bName.slice(0, -1)) return true;
  if (aName.endsWith('Y') && bName.endsWith('X') && aName.slice(0, -1) === bName.slice(0, -1)) return true;

  if (aName.endsWith('.x') && bName.endsWith('.y') && aName.slice(0, -2) === bName.slice(0, -2)) return true;
  if (aName.endsWith('.y') && bName.endsWith('.x') && aName.slice(0, -2) === bName.slice(0, -2)) return true;

  return false;
}

function groupArrangeParams<T extends ArrangeParamSpec>(params: T[]): Array<{ kind: 'single'; a: T } | { kind: 'pair'; a: T; b: T }> {
  const rows: Array<{ kind: 'single'; a: T } | { kind: 'pair'; a: T; b: T }> = [];
  for (let index = 0; index < params.length; index += 1) {
    const current = params[index];
    const next = params[index + 1];
    if (next && arePairedArrangeParams(current, next)) {
      rows.push({ kind: 'pair', a: current, b: next });
      index += 1;
      continue;
    }
    rows.push({ kind: 'single', a: current });
  }
  return rows;
}

function formatParamLabel(name: string) {
  const withSpaces = name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2');
  return withSpaces.replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildDefaultArrangeParams(entry: EditorRegistryEntry | undefined, scene: SceneSpec): Record<string, number | string | boolean> {
  const params: Record<string, number | string | boolean> = {};
  if (!entry?.parameters) return params;

  for (const param of entry.parameters) {
    if (param.default !== undefined) {
      params[param.name] = param.default;
      continue;
    }
    if (param.type === 'number') params[param.name] = 0;
    else if (param.type === 'boolean') params[param.name] = false;
    else params[param.name] = '';
  }

  const world = getSceneWorld(scene);
  const centerX = world.width / 2;
  const centerY = world.height / 2;
  const defaultNumber = (key: string, value: unknown, fallback: number) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed === 0) params[key] = fallback;
  };

  defaultNumber('startX', params.startX, centerX);
  defaultNumber('centerX', params.centerX, centerX);
  defaultNumber('apexX', params.apexX, centerX);
  defaultNumber('startY', params.startY, centerY);
  defaultNumber('centerY', params.centerY, centerY);
  defaultNumber('apexY', params.apexY, centerY);

  return params;
}

export function CreateFormationPanel({
  scene,
  registry,
  dispatch,
}: {
  scene: SceneSpec;
  registry: EditorRegistryConfig;
  dispatch: (action: any) => void;
}) {
  const arrangeEntries = useMemo(() => registry.arrange.filter((entry) => entry.implemented), [registry.arrange]);
  const templateEntries = useMemo(
    () => Object.values(scene.entities).slice().sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id)),
    [scene.entities]
  );

  const [suggestedName, setSuggestedName] = useState(() => getNextFormationName(scene));
  const [nameDraft, setNameDraft] = useState(() => getNextFormationName(scene));
  const [arrangeKindDraft, setArrangeKindDraft] = useState(() => arrangeEntries[0]?.type ?? 'grid');
  const [arrangeParamsDraft, setArrangeParamsDraft] = useState<Record<string, number | string | boolean>>(() =>
    buildDefaultArrangeParams(arrangeEntries[0], scene)
  );
  const [memberCountDraft, setMemberCountDraft] = useState(12);
  const [templateEntityId, setTemplateEntityId] = useState<Id>('');
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);

  useEffect(() => {
    const nextSuggestion = getNextFormationName(scene);
    setSuggestedName((prev) => {
      if (prev === nextSuggestion) return prev;
      setNameDraft((current) => (current === prev ? nextSuggestion : current));
      return nextSuggestion;
    });
  }, [scene.groups]);

  useEffect(() => {
    if (arrangeEntries.length === 0) return;
    if (arrangeEntries.some((entry) => entry.type === arrangeKindDraft)) return;
    setArrangeKindDraft(arrangeEntries[0].type);
    setArrangeParamsDraft(buildDefaultArrangeParams(arrangeEntries[0], scene));
  }, [arrangeEntries, arrangeKindDraft, scene]);

  const selectedArrangeEntry = arrangeEntries.find((entry) => entry.type === arrangeKindDraft) ?? arrangeEntries[0];
  const selectedTemplate = templateEntityId ? scene.entities[templateEntityId] : undefined;
  const canChooseTemplate = templateEntries.length > 0;

  const createFormation = (templateId: Id) => {
    const name = nameDraft.trim();
    dispatch({
      type: 'create-group-from-arrange',
      name,
      templateEntityId: templateId,
      arrangeKind: arrangeKindDraft,
      params: arrangeParamsDraft,
      memberCount: arrangeKindDraft === 'grid' ? undefined : memberCountDraft,
    });
  };

  const requestTemplate = (autoContinue: boolean) => {
    setTemplatePickerOpen(true);
    setPendingCreate(autoContinue);
  };

  const handleCreate = () => {
    if (!canChooseTemplate) return;
    if (!templateEntityId) {
      requestTemplate(true);
      return;
    }
    createFormation(templateEntityId);
  };

  const onPickTemplate = (id: Id) => {
    setTemplateEntityId(id);
    setTemplatePickerOpen(false);
    setPendingCreate((current) => {
      if (current) createFormation(id);
      return false;
    });
  };

  const scrollToImportPanel = () => {
    dispatch({ type: 'set-sidebar-scope', scope: 'scene' });
    const dock = document.querySelector('[data-testid="assets-dock"]');
    if (dock instanceof HTMLElement) {
      dock.scrollIntoView({ behavior: 'smooth', block: 'end' });
      return;
    }
    requestAnimationFrame(() => {
      const retry = document.querySelector('[data-testid="assets-dock"]');
      if (retry instanceof HTMLElement) {
        retry.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    });
  };

  return (
    <div className="inspector-block" data-testid="create-formation-panel">
      <div className="inspector-title">Create Formation</div>
      <div className="inspector-row">Choose an arrange preset, then pick a template sprite to clone.</div>

      {!canChooseTemplate && (
        <>
          <div className="inspector-row">Import a sprite to use as a template.</div>
          <button
            className="button"
            data-testid="formation-scroll-to-import-button"
            type="button"
            onClick={scrollToImportPanel}
          >
            Go to Assets Dock
          </button>
        </>
      )}

      <label className="field">
        <span>Formation Name</span>
        <input
          aria-label="Formation Name"
          data-testid="formation-create-name-input"
          type="text"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          placeholder={suggestedName}
        />
      </label>

      <label className="field">
        <span>Preset</span>
        <select
          aria-label="Arrange Preset"
          data-testid="formation-arrange-select"
          value={arrangeKindDraft}
          onChange={(event) => {
            const next = event.target.value;
            setArrangeKindDraft(next);
            const entry = arrangeEntries.find((e) => e.type === next) ?? arrangeEntries[0];
            setArrangeParamsDraft(buildDefaultArrangeParams(entry, scene));
          }}
        >
          {arrangeEntries.map((entry) => (
            <option key={entry.type} value={entry.type}>{entry.displayName}</option>
          ))}
        </select>
      </label>

      {arrangeKindDraft === 'grid' ? (
        <div className="inspector-row">Creates rows × cols sprites.</div>
      ) : (
        <label className="field">
          <span>Member Count</span>
          <input
            aria-label="Member Count"
            data-testid="formation-member-count-input"
            type="number"
            min={1}
            max={200}
            value={memberCountDraft}
            onChange={(event) => setMemberCountDraft(Math.max(1, Math.min(200, Math.floor(Number(event.target.value) || 1))))}
          />
        </label>
      )}

      {(() => {
        const renderParam = (param: any) => {
          const rawValue = arrangeParamsDraft[param.name];
          const label = formatParamLabel(param.name);
          if (param.type === 'boolean') {
            return (
              <label key={param.name} className="field">
                <span>{label}</span>
                <input
                  aria-label={label}
                  data-testid={`formation-arrange-param-${param.name}`}
                  type="checkbox"
                  checked={Boolean(rawValue)}
                  onChange={(event) => setArrangeParamsDraft({ ...arrangeParamsDraft, [param.name]: event.target.checked })}
                />
              </label>
            );
          }
          if (param.type === 'number') {
            return (
              <label key={param.name} className="field">
                <span>{label}</span>
                <ValidatedNumberInput
                  aria-label={label}
                  data-testid={`formation-arrange-param-${param.name}`}
                  value={Number(rawValue ?? 0)}
                  onCommit={(next) => setArrangeParamsDraft({ ...arrangeParamsDraft, [param.name]: next })}
                />
              </label>
            );
          }
          return (
            <label key={param.name} className="field">
              <span>{label}</span>
              <input
                aria-label={label}
                data-testid={`formation-arrange-param-${param.name}`}
                type="text"
                value={String(rawValue ?? '')}
                onChange={(event) => setArrangeParamsDraft({ ...arrangeParamsDraft, [param.name]: event.target.value })}
              />
            </label>
          );
        };

        const params = (selectedArrangeEntry?.parameters ?? []) as ArrangeParamSpec[];
        return groupArrangeParams(params).map((row) => {
          if (row.kind === 'pair') {
            return (
              <div key={`${row.a.name}:${row.b.name}`} className="inspector-grid-2">
                {renderParam(row.a)}
                {renderParam(row.b)}
              </div>
            );
          }
          return renderParam(row.a);
        });
      })()}

      <div className="member-row">
        <div className="tag-button" data-testid="formation-template-selected">
          {selectedTemplate ? `${selectedTemplate.name ?? selectedTemplate.id} · ${selectedTemplate.id}` : 'Template: None'}
        </div>
        <button
          className="tag-button"
          data-testid="formation-choose-template-button"
          type="button"
          onClick={() => requestTemplate(false)}
          disabled={!canChooseTemplate}
        >
          Choose
        </button>
      </div>

      <button
        className="button"
        data-testid="formation-create-button"
        type="button"
        onClick={handleCreate}
        disabled={!canChooseTemplate || arrangeEntries.length === 0}
      >
        Create Formation
      </button>

      {templatePickerOpen && (
        <div className="inspector-block" data-testid="formation-template-picker">
          <div className="inspector-title">Choose Template Sprite</div>
          <div className="inspector-row">Pick one existing sprite to clone.</div>
          <div className="member-tags">
            {templateEntries.map((entity) => (
              <button
                key={entity.id}
                className="tag-button"
                data-testid={`formation-template-pick-${entity.id}`}
                type="button"
                onClick={() => onPickTemplate(entity.id)}
              >
                {entity.name ?? entity.id} · {entity.id}
              </button>
            ))}
          </div>
          <button
            className="button button-danger"
            data-testid="formation-template-cancel-button"
            type="button"
            onClick={() => {
              setTemplatePickerOpen(false);
              setPendingCreate(false);
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
