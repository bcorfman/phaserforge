import { useEffect, useRef, useState } from 'react';

import { useEditorStore } from './EditorStore';
import { Inspector } from './Inspector';
import {
  CLOUD_RETURN_TO_CLOUD_AFTER_AUTH_STORAGE_KEY,
  CloudAccountPanel,
  getCachedCloudAccountUserSnapshot,
  resolveCachedCloudAccountUser,
} from './CloudAccountPanel';
import { isLocalHostname } from '../util/isLocalHostname';

export type InspectorPaneTab = 'inspector' | 'cloud';

export function InspectorPaneView({
  cloudEnabled,
  activeTab,
  onSelectTab,
  inspectorContent,
  cloudContent,
}: {
  cloudEnabled: boolean;
  activeTab: InspectorPaneTab;
  onSelectTab: (tab: InspectorPaneTab) => void;
  inspectorContent: React.ReactNode;
  cloudContent: React.ReactNode;
}) {
  const effectiveTab: InspectorPaneTab = cloudEnabled ? activeTab : 'inspector';

  return (
    <>
      {cloudEnabled ? (
        <div className="inspector-pane-tabs" role="tablist" aria-label="Inspector Pane Tabs">
          <button
            className={`button ${effectiveTab === 'inspector' ? 'active' : ''}`}
            data-testid="inspector-pane-tab-inspector"
            type="button"
            role="tab"
            aria-selected={effectiveTab === 'inspector'}
            onClick={() => onSelectTab('inspector')}
          >
            Inspector
          </button>
          <button
            className={`button ${effectiveTab === 'cloud' ? 'active' : ''}`}
            data-testid="inspector-pane-tab-cloud"
            type="button"
            role="tab"
            aria-selected={effectiveTab === 'cloud'}
            onClick={() => onSelectTab('cloud')}
          >
            Cloud
          </button>
        </div>
      ) : null}

      {effectiveTab === 'inspector' ? inspectorContent : cloudContent}
    </>
  );
}

export function InspectorPane() {
  const { state, dispatch, persistence } = useEditorStore();
  const cloudEnabled = !isLocalHostname(globalThis.location?.hostname);
  const activeCloudGameId = persistence.localProjects.find((entry) => entry.id === persistence.activeProjectId)?.cloudProjectId ?? null;
  const [tab, setTab] = useState<'inspector' | 'cloud'>(() => {
    if (!cloudEnabled) return 'inspector';
    const cachedUser = getCachedCloudAccountUserSnapshot();
    return cachedUser ? 'inspector' : 'cloud';
  });
  const userSelectedTabRef = useRef(false);

  const consumeReturnToCloudAfterAuth = (): boolean => {
    try {
      if (window.sessionStorage.getItem(CLOUD_RETURN_TO_CLOUD_AFTER_AUTH_STORAGE_KEY) !== '1') return false;
      window.sessionStorage.removeItem(CLOUD_RETURN_TO_CLOUD_AFTER_AUTH_STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!cloudEnabled) return;
    if (getCachedCloudAccountUserSnapshot() !== undefined) return;

    let cancelled = false;
    void resolveCachedCloudAccountUser().then((user) => {
      if (cancelled || userSelectedTabRef.current) return;
      if (user && consumeReturnToCloudAfterAuth()) {
        setTab('cloud');
        return;
      }
      setTab(user ? 'inspector' : 'cloud');
    });

    return () => {
      cancelled = true;
    };
  }, [cloudEnabled]);

  const handleSelectTab = (nextTab: InspectorPaneTab) => {
    userSelectedTabRef.current = true;
    setTab(nextTab);
  };

  return (
    <InspectorPaneView
      cloudEnabled={cloudEnabled}
      activeTab={tab}
      onSelectTab={handleSelectTab}
      inspectorContent={<Inspector />}
      cloudContent={(
        <CloudAccountPanel
          state={state}
          activeCloudGameId={activeCloudGameId}
          dispatch={dispatch}
          onLoadYaml={(yaml, sourceLabel) => dispatch({ type: 'load-yaml-text', text: yaml, sourceLabel })}
          onCloudGameLinked={(gameId) => persistence.linkActiveProjectToCloudGame(gameId)}
          onStatus={(message) => dispatch({ type: 'set-status', message, expiresAt: Date.now() + 4000 })}
          onError={(message) => dispatch({ type: 'set-error', error: message })}
        />
      )}
    />
  );
}
