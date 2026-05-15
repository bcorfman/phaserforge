import { useEffect, useMemo, useRef } from 'react';

export type ActionLibraryEntry = { type: string; displayName: string; category?: string };

export function ActionLibraryDrawer({
  open,
  title,
  search,
  onSearchChange,
  actions,
  pinnedTypes,
  onTogglePin,
  selectedCategory,
  onSelectCategory,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  search: string;
  onSearchChange: (next: string) => void;
  actions: ActionLibraryEntry[];
  pinnedTypes: Set<string>;
  onTogglePin: (type: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onPick: (type: string) => void;
  onClose: () => void;
}) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) searchInputRef.current?.focus();
  }, [open]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of actions) {
      const cat = (a.category ?? '').trim();
      if (cat) set.add(cat);
    }
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [actions]);

  const normalizedSearch = (search ?? '').trim().toLowerCase();
  const filtered = useMemo(() => {
    return actions.filter((a) => {
      if (selectedCategory !== 'All' && (a.category ?? '') !== selectedCategory) return false;
      if (!normalizedSearch) return true;
      return (
        a.type.toLowerCase().includes(normalizedSearch) ||
        a.displayName.toLowerCase().includes(normalizedSearch) ||
        (a.category ?? '').toLowerCase().includes(normalizedSearch)
      );
    });
  }, [actions, normalizedSearch, selectedCategory]);

  const pinnedEntries = useMemo(() => {
    const byType = new Map(actions.map((a) => [a.type, a]));
    return Array.from(pinnedTypes)
      .map((t) => byType.get(t))
      .filter(Boolean) as ActionLibraryEntry[];
  }, [actions, pinnedTypes]);

  if (!open) return null;

  return (
    <div
      className="drawer-overlay"
      data-testid="action-library"
      role="dialog"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-card">
        <div className="panel-heading-row">
          <div className="panel-heading">{title}</div>
          <button className="tag-button" type="button" data-testid="action-library-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="panel-heading-row">
          <input
            ref={searchInputRef}
            className="text-input"
            data-testid="action-library-search"
            aria-label="Search actions"
            type="text"
            value={search}
            placeholder="Search actions…"
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <div className="muted" style={{ whiteSpace: 'nowrap' }}>
            Esc
          </div>
        </div>

        <div>
          <div className="panel-heading">Categories</div>
          <div className="member-tags">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`tag-button ${selectedCategory === cat ? 'active' : ''}`}
                type="button"
                data-testid={`action-library-cat-${cat}`}
                onClick={() => onSelectCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-scroll" style={{ overflow: 'auto', paddingRight: 2 }}>
          {pinnedEntries.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="panel-heading">Pinned (global)</div>
              <div className="member-list">
                {pinnedEntries.map((a) => (
                  <div key={`pinned-${a.type}`} className="member-row">
                    <div
                      className="list-item"
                      role="button"
                      tabIndex={0}
                      data-testid={`action-library-add-${a.type}`}
                      onClick={() => onPick(a.type)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onPick(a.type);
                      }}
                    >
                      <span>{a.displayName}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          className="tag-button"
                          type="button"
                          data-testid={`action-library-pin-${a.type}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(a.type);
                          }}
                        >
                          ★
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel-heading">Actions</div>
          {filtered.length === 0 ? (
            <div className="muted">No matching actions.</div>
          ) : (
            <div className="member-list">
              {filtered.map((a) => {
                const pinned = pinnedTypes.has(a.type);
                return (
                  <div key={a.type} className="member-row">
                    <div
                      className="list-item"
                      role="button"
                      tabIndex={0}
                      data-testid={`action-library-add-${a.type}`}
                      onClick={() => onPick(a.type)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onPick(a.type);
                      }}
                    >
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span>{a.displayName}</span>
                        <span className="muted" style={{ fontSize: '0.78rem' }}>
                          {a.category ?? 'uncategorized'} · {a.type}
                        </span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          className="tag-button"
                          type="button"
                          data-testid={`action-library-pin-${a.type}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(a.type);
                          }}
                        >
                          {pinned ? '★' : '☆'}
                        </button>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
