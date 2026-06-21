import { useEffect, useState, type ReactNode } from 'react';
import { projectPersistence } from './projectPersistence';

type FoldoutMap = Record<string, boolean>;

export function useInspectorFoldouts() {
  const [map, setMap] = useState<FoldoutMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void projectPersistence.loadPreferencesRecord().then((preferences) => {
      if (cancelled) return;
      setMap(preferences?.inspectorFoldouts ?? {});
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void projectPersistence.updatePreferencesRecord({ inspectorFoldouts: map });
  }, [hydrated, map]);

  useEffect(() => {
    const handler = () => {
      void projectPersistence.loadPreferencesRecord().then((preferences) => {
        setMap(preferences?.inspectorFoldouts ?? {});
      });
    };
    window.addEventListener('phaserforge:test-reset-ui', handler);
    return () => {
      window.removeEventListener('phaserforge:test-reset-ui', handler);
    };
  }, []);

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
  summary,
  open,
  onToggle,
  children,
  testId,
}: {
  title: string;
  summary?: ReactNode;
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
        {summary ? <div className="inspector-foldout-summary">{summary}</div> : null}
      </div>
      {open && <div className="inspector-foldout-body">{children}</div>}
    </div>
  );
}
