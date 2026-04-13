import { useEffect, useState, type ReactNode } from 'react';
import YAML from 'yaml';

const INSPECTOR_FOLDOUTS_STORAGE_KEY = 'phaseractions.inspectorFoldouts.v1';

type FoldoutMap = Record<string, boolean>;

function loadFoldoutMap(): FoldoutMap {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(INSPECTOR_FOLDOUTS_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = YAML.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const map: FoldoutMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean') map[key] = value;
    }
    return map;
  } catch {
    return {};
  }
}

function saveFoldoutMap(map: FoldoutMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INSPECTOR_FOLDOUTS_STORAGE_KEY, YAML.stringify(map));
  } catch {
    // ignore
  }
}

export function useInspectorFoldouts() {
  const [map, setMap] = useState<FoldoutMap>(() => loadFoldoutMap());

  useEffect(() => {
    saveFoldoutMap(map);
  }, [map]);

  const isOpen = (key: string, defaultOpen: boolean) => map[key] ?? defaultOpen;

  const setOpen = (key: string, open: boolean) => {
    setMap((prev) => ({ ...prev, [key]: open }));
  };

  const toggle = (key: string, defaultOpen: boolean) => {
    setMap((prev) => ({ ...prev, [key]: !(prev[key] ?? defaultOpen) }));
  };

  return { isOpen, setOpen, toggle };
}

export function InspectorFoldout({
  title,
  open,
  onToggle,
  children,
  testId,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="inspector-foldout" data-testid={testId}>
      <div className="inspector-foldout-header">
        <button
          className="inspector-foldout-toggle"
          type="button"
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
          onClick={onToggle}
        >
          {open ? '▾' : '▸'}
        </button>
        <div className="inspector-foldout-title">{title}</div>
      </div>
      {open && <div className="inspector-foldout-body">{children}</div>}
    </div>
  );
}

