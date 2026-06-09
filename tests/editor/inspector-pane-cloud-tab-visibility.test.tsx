// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../../src/editor/EditorStore', () => {
  return {
    useEditorStore: () => ({ state: {}, dispatch: () => {} }),
  };
});

vi.mock('../../src/editor/Inspector', () => {
  return {
    Inspector: () => null,
  };
});

vi.mock('../../src/editor/CloudAccountPanel', () => {
  return {
    getCachedCloudAccountUserSnapshot: () => undefined,
    resolveCachedCloudAccountUser: async () => null,
    CloudAccountPanel: () => null,
  };
});

import { InspectorPane } from '../../src/editor/InspectorPane';

function setHostname(hostname: string) {
  (globalThis as any).location = { hostname };
}

afterEach(() => {
  delete (globalThis as any).location;
});

describe('InspectorPane Cloud tab visibility', () => {
  it('hides the tab strip entirely on localhost deploys', () => {
    setHostname('localhost');
    const markup = renderToStaticMarkup(<InspectorPane />);
    expect(markup).not.toContain('data-testid="inspector-pane-tab-inspector"');
    expect(markup).not.toContain('data-testid="inspector-pane-tab-cloud"');
    expect(markup).not.toContain('role="tablist"');
  });

  it('shows the Cloud tab on non-localhost deploys', () => {
    setHostname('phaserforge.app');
    const markup = renderToStaticMarkup(<InspectorPane />);
    expect(markup).toContain('data-testid="inspector-pane-tab-inspector"');
    expect(markup).toContain('data-testid="inspector-pane-tab-cloud"');
  });
});
