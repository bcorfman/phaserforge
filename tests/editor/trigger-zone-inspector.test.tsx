import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TriggerZoneInspector } from '../../src/editor/TriggerZoneInspector';
import { sampleProject } from '../../src/model/sampleProject';

describe('TriggerZoneInspector', () => {
  it('renders a structured op selector for trigger calls', () => {
    const sceneId = sampleProject.initialSceneId;
    const scene = sampleProject.scenes[sceneId];
    const zone = {
      id: 't1',
      rect: { x: 0, y: 0, width: 10, height: 10 },
      onEnter: { callId: 'audio.play_sfx', args: { assetId: 'hit', volume: 0.35 } },
    };

    const markup = renderToStaticMarkup(
      <TriggerZoneInspector
        project={sampleProject as any}
        scene={scene as any}
        zone={zone as any}
        dispatch={() => {}}
        disabled={false}
      />
    );

    expect(markup).toContain('data-testid="trigger-onenter-op-select"');
    expect(markup).toContain('data-testid="trigger-onenter-sfx-asset-select"');
    expect(markup).toContain('data-testid="trigger-onenter-sfx-volume-input"');
  });
});

