import type { CollectionMemberRef, CollectionSpec, CounterSpec, GameSceneSpec, ProjectSpec } from '../model/types';
import type { EditorAction } from './EditorStore';

function uniqueMembers(members: CollectionMemberRef[]): CollectionMemberRef[] {
  const map = new Map<string, CollectionMemberRef>();
  for (const m of members ?? []) {
    const key = m.type === 'entity' ? `entity:${m.entityId ?? ''}` : `group:${m.groupId ?? ''}`;
    map.set(key, m);
  }
  return Array.from(map.values());
}

export function SceneStateBody({
  project,
  scene,
  dispatch,
  disabled,
}: {
  project: ProjectSpec;
  scene: GameSceneSpec;
  dispatch: React.Dispatch<EditorAction>;
  disabled: boolean;
}) {
  const counters = project.counters ?? {};
  const collections = project.collections ?? {};

  return (
    <div className="inspector-block" style={{ padding: 0, border: 'none', boxShadow: 'none', background: 'transparent' }}>
      <div className="panel-heading">Counters</div>
      <div className="inspector-row">
        <button className="button button-compact" type="button" disabled={disabled} onClick={() => dispatch({ type: 'create-counter', scope: 'global' })}>
          + Add Global Counter
        </button>{' '}
        <button className="button button-compact" type="button" disabled={disabled} onClick={() => dispatch({ type: 'create-counter', scope: 'scene' })}>
          + Add Scene Counter
        </button>
      </div>
      {Object.keys(counters).length === 0 && <div className="muted">No counters yet.</div>}
      {Object.values(counters).map((counter: CounterSpec) => (
        <div key={counter.id} className="inspector-block" style={{ marginTop: 8 }}>
          <div className="member-row" style={{ justifyContent: 'space-between' }}>
            <strong>{counter.name ?? counter.id}</strong>
            <button className="tag-button tag-button-danger" type="button" disabled={disabled} onClick={() => dispatch({ type: 'remove-counter', id: counter.id })}>
              Remove
            </button>
          </div>
          <label className="field">
            <span>Name</span>
            <input
              aria-label="Counter Name"
              disabled={disabled}
              value={counter.name ?? ''}
              onChange={(e) => dispatch({ type: 'update-counter', id: counter.id, next: { ...counter, name: e.target.value || undefined } })}
            />
          </label>
          <div className="inspector-grid-2">
            <label className="field">
              <span>Scope</span>
              <select
                aria-label="Counter Scope"
                disabled={disabled}
                value={counter.scope}
                onChange={(e) => dispatch({ type: 'update-counter', id: counter.id, next: { ...counter, scope: e.target.value === 'scene' ? 'scene' : 'global' } })}
              >
                <option value="global">Global</option>
                <option value="scene">Scene</option>
              </select>
            </label>
            <label className="field">
              <span>Value</span>
              <input
                aria-label="Counter Value"
                disabled={disabled}
                inputMode="numeric"
                value={String(counter.value ?? 0)}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next)) return;
                  dispatch({ type: 'update-counter', id: counter.id, next: { ...counter, value: next } });
                }}
              />
            </label>
          </div>
          <label className="field">
            <span>Derived From Collection</span>
            <select
              aria-label="Counter Derived Collection"
              disabled={disabled}
              value={counter.derivedFromCollectionId ?? ''}
              onChange={(e) => dispatch({ type: 'update-counter', id: counter.id, next: { ...counter, derivedFromCollectionId: e.target.value || undefined } })}
            >
              <option value="">(none)</option>
              {Object.values(collections).map((c) => (
                <option key={c.id} value={c.id}>{c.name ?? c.id}</option>
              ))}
            </select>
          </label>
        </div>
      ))}

      <div className="panel-heading" style={{ marginTop: 12 }}>Collections</div>
      <div className="inspector-row">
        <button className="button button-compact" type="button" disabled={disabled} onClick={() => dispatch({ type: 'create-collection' })}>
          + Add Collection
        </button>
      </div>
      {Object.keys(collections).length === 0 && <div className="muted">No collections yet.</div>}
      {Object.values(collections).map((collection: CollectionSpec) => (
        <div key={collection.id} className="inspector-block" style={{ marginTop: 8 }}>
          <div className="member-row" style={{ justifyContent: 'space-between' }}>
            <strong>{collection.name ?? collection.id}</strong>
            <button className="tag-button tag-button-danger" type="button" disabled={disabled} onClick={() => dispatch({ type: 'remove-collection', id: collection.id })}>
              Remove
            </button>
          </div>
          <label className="field">
            <span>Name</span>
            <input
              aria-label="Collection Name"
              disabled={disabled}
              value={collection.name ?? ''}
              onChange={(e) => dispatch({ type: 'update-collection', id: collection.id, next: { ...collection, name: e.target.value || undefined } })}
            />
          </label>
          <div className="inspector-row muted">Members (explicit, no query engine)</div>
          <div className="inspector-grid-2">
            <div>
              <div className="panel-heading">Entities</div>
              {Object.values(scene.entities).map((entity) => {
                const checked = (collection.members ?? []).some((m) => m.type === 'entity' && m.entityId === entity.id);
                return (
                  <label key={entity.id} className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      aria-label={`Collection ${collection.id} entity ${entity.id}`}
                      disabled={disabled}
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const nextMembers = (collection.members ?? []).filter((m) => !(m.type === 'entity' && m.entityId === entity.id));
                        if (e.target.checked) nextMembers.push({ type: 'entity', entityId: entity.id });
                        dispatch({ type: 'update-collection', id: collection.id, next: { ...collection, members: uniqueMembers(nextMembers) } });
                      }}
                    />
                    <span>{entity.name ?? entity.id}</span>
                  </label>
                );
              })}
            </div>
            <div>
              <div className="panel-heading">Formations</div>
              {Object.values(scene.groups).map((group) => {
                const checked = (collection.members ?? []).some((m) => m.type === 'group' && m.groupId === group.id);
                return (
                  <label key={group.id} className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      aria-label={`Collection ${collection.id} group ${group.id}`}
                      disabled={disabled}
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const nextMembers = (collection.members ?? []).filter((m) => !(m.type === 'group' && m.groupId === group.id));
                        if (e.target.checked) nextMembers.push({ type: 'group', groupId: group.id });
                        dispatch({ type: 'update-collection', id: collection.id, next: { ...collection, members: uniqueMembers(nextMembers) } });
                      }}
                    />
                    <span>{group.name ?? group.id}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

