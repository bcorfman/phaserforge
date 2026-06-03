import { useState } from 'react';

import { useEditorStore } from './EditorStore';
import { Inspector } from './Inspector';
import { CloudAccountPanel } from './CloudAccountPanel';
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
  const { state, dispatch } = useEditorStore();
  const [tab, setTab] = useState<'inspector' | 'cloud'>('inspector');
  const cloudEnabled = !isLocalHostname(globalThis.location?.hostname);

  return (
    <InspectorPaneView
      cloudEnabled={cloudEnabled}
      activeTab={tab}
      onSelectTab={setTab}
      inspectorContent={<Inspector />}
      cloudContent={(
        <CloudAccountPanel
          state={state}
          dispatch={dispatch}
          onLoadYaml={(yaml, sourceLabel) => dispatch({ type: 'load-yaml-text', text: yaml, sourceLabel })}
          onStatus={(message) => dispatch({ type: 'set-status', message, expiresAt: Date.now() + 4000 })}
          onError={(message) => dispatch({ type: 'set-error', error: message })}
        />
      )}
    />
  );
}
