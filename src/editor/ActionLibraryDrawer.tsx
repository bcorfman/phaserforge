import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export type ActionLibraryEntry = { type: string; displayName: string; category?: string };
export type PatternLibraryEntry = { id: string; name: string };

function titleCase(input: string): string {
  const s = (input ?? '').trim();
  if (!s) return s;
  return s
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function ActionLibraryDrawer({
  open,
  title,
  actions,
  patterns,
  pinnedTypes,
  onTogglePin,
  pinnedPatternIds,
  onTogglePinnedPattern,
  selectedCategory,
  onSelectCategory,
  onPickAction,
  onPickPattern,
  anchorRect,
  onClose,
}: {
  open: boolean;
  title: string;
  actions: ActionLibraryEntry[];
  patterns: PatternLibraryEntry[];
  pinnedTypes: Set<string>;
  onTogglePin: (type: string) => void;
  pinnedPatternIds: Set<string>;
  onTogglePinnedPattern: (id: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onPickAction: (type: string) => void;
  onPickPattern: (patternId: string) => void;
  anchorRect?: { left: number; top: number; width: number; height: number } | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of actions) {
      const cat = (a.category ?? '').trim();
      if (cat) set.add(cat);
    }
    return ['All', 'Patterns', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [actions]);

  const filtered = useMemo(() => {
    if (selectedCategory === 'Patterns') return [];
    return actions.filter((a) => {
      if (selectedCategory !== 'All' && (a.category ?? '') !== selectedCategory) return false;
      return true;
    });
  }, [actions, selectedCategory]);

  const pinnedEntries = useMemo(() => {
    if (selectedCategory === 'Patterns') return [];
    const byType = new Map(actions.map((a) => [a.type, a]));
    return Array.from(pinnedTypes)
      .map((t) => byType.get(t))
      .filter((entry): entry is ActionLibraryEntry => Boolean(entry))
      .filter((entry) => {
        if (selectedCategory === 'All') return true;
        return (entry.category ?? '') === selectedCategory;
      });
  }, [actions, pinnedTypes, selectedCategory]);

  const pinnedPatterns = useMemo(() => {
    if (selectedCategory !== 'Patterns') return [];
    const byId = new Map(patterns.map((p) => [p.id, p]));
    return Array.from(pinnedPatternIds)
      .map((id) => byId.get(id))
      .filter(Boolean) as PatternLibraryEntry[];
  }, [patterns, pinnedPatternIds, selectedCategory]);

  const filteredPatterns = useMemo(() => {
    if (selectedCategory !== 'Patterns') return [];
    return patterns;
  }, [patterns, selectedCategory]);

  const isPopover = Boolean(anchorRect);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !isPopover || !anchorRect) {
      setPopoverPos(null);
      return;
    }
    const card = cardRef.current;
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 0;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 0;
    const cardW = card?.offsetWidth ?? 540;
    const cardH = card?.offsetHeight ?? 520;

    const padding = 10;
    const belowTop = anchorRect.top + anchorRect.height + padding;
    const aboveTop = anchorRect.top - cardH - padding;
    const top = belowTop + cardH <= viewportH - padding ? belowTop : Math.max(padding, aboveTop);

    const maxLeft = Math.max(padding, viewportW - cardW - padding);
    const left = Math.min(Math.max(padding, anchorRect.left), maxLeft);
    setPopoverPos({ top, left });
  }, [anchorRect, isPopover, open]);

  if (!open) return null;

  return (
    <div
      className={`drawer-overlay ${isPopover ? 'drawer-overlay-popover' : ''}`}
      data-testid="action-library"
      role="dialog"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`drawer-card ${isPopover ? 'drawer-card-popover' : ''}`}
        style={
          isPopover
            ? {
                position: 'absolute',
                top: popoverPos?.top ?? 0,
                left: popoverPos?.left ?? 0,
                height: 'min(70vh, 44rem)',
              }
            : undefined
        }
        ref={cardRef}
      >
        <div className="panel-heading-row">
          <div className="panel-heading">{title}</div>
          <button className="button button-compact" type="button" data-testid="action-library-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div>
          <div className="panel-heading">Categories</div>
          <div className="member-tags action-library-categories" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`button button-compact ${selectedCategory === cat ? 'active' : ''}`}
                type="button"
                data-testid={`action-library-cat-${cat}`}
                onClick={() => onSelectCategory(cat)}
              >
                {cat === 'All' ? 'All' : titleCase(cat)}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-scroll" style={{ overflow: 'auto', paddingRight: 2 }}>
          {pinnedEntries.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="panel-heading">Pinned (filtered)</div>
              <div className="member-list">
                {pinnedEntries.map((a) => (
                  <div key={`pinned-${a.type}`} className="member-row">
                    <div
                      className="list-item"
                      role="button"
                      tabIndex={0}
                      data-testid={`action-library-add-${a.type}`}
                      onClick={() => onPickAction(a.type)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onPickAction(a.type);
                      }}
                    >
                      <span>{a.displayName}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          className="scene-graph-button"
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

          {selectedCategory === 'Patterns' ? (
            <>
              {pinnedPatterns.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div className="panel-heading">Pinned (filtered)</div>
                  <div className="member-list">
                    {pinnedPatterns.map((p) => (
                      <div key={`pinned-pattern-${p.id}`} className="member-row">
                        <div
                          className="list-item"
                          role="button"
                          tabIndex={0}
                          data-testid={`pattern-library-apply-${p.id}`}
                          onClick={() => onPickPattern(p.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') onPickPattern(p.id);
                          }}
                        >
                          <span>{p.name}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                              className="scene-graph-button"
                              type="button"
                              data-testid={`pattern-library-pin-${p.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePinnedPattern(p.id);
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
              <div className="panel-heading">Patterns</div>
              {filteredPatterns.length === 0 ? (
                <div className="muted">No patterns yet.</div>
              ) : (
                <div className="member-list">
                  {filteredPatterns.map((p) => {
                    const pinned = pinnedPatternIds.has(p.id);
                    return (
                      <div key={p.id} className="member-row">
                        <div
                          className="list-item"
                          role="button"
                          tabIndex={0}
                          data-testid={`pattern-library-apply-${p.id}`}
                          onClick={() => onPickPattern(p.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') onPickPattern(p.id);
                          }}
                        >
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span>{p.name}</span>
                            <span className="muted" style={{ fontSize: '0.78rem' }}>
                              Pattern · {p.id}
                            </span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                              className="scene-graph-button"
                              type="button"
                              data-testid={`pattern-library-pin-${p.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePinnedPattern(p.id);
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
            </>
          ) : (
            <>
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
                          onClick={() => onPickAction(a.type)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') onPickAction(a.type);
                          }}
                        >
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                            <span>{a.displayName}</span>
                            <span className="muted" style={{ fontSize: '0.78rem' }}>
                              {a.category ? titleCase(a.category) : 'Uncategorized'} · {a.type}
                            </span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                              className="scene-graph-button"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
