import { describe, expect, it } from 'vitest';
import { createProjectSnapshot, parseProjectSnapshot, parseProjectYaml, serializeProjectSnapshot, serializeProjectToYaml } from '../../src/model/serialization';
import { sampleScene } from '../../src/model/sampleScene';
import { stringify } from 'yaml';

describe('project YAML serialization', () => {
  it('round-trips a minimal project spec (patterns canonical)', () => {
    const project = {
      id: 'project-1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: {
        sounds: {
          music_theme: { id: 'music_theme', source: { kind: 'embedded', dataUrl: 'data:audio/mp3;base64,AAAA', originalName: 'theme.mp3', mimeType: 'audio/mpeg' } },
          forest_ambience: { id: 'forest_ambience', source: { kind: 'embedded', dataUrl: 'data:audio/wav;base64,AAAA', originalName: 'forest.wav', mimeType: 'audio/wav' } },
        },
      },
      inputMaps: {},
      baseSceneId: 'scene-1',
      sceneMeta: {
        'scene-1': { name: 'Base', role: 'base' },
      },
      scenes: {
        'scene-1': {
          ...sampleScene,
          backgroundLayers: [],
          collisionRules: [
            {
              id: 'shot-hit',
              a: { type: 'layer', layer: 'shots' },
              b: { type: 'layer', layer: 'obstacles' },
              interaction: 'overlap',
              onEnter: [
                { callId: 'entity.destroy', args: { target: 'a' } },
                { callId: 'entity.destroy', args: { target: 'b' } },
              ],
            },
          ],
          music: { assetId: 'music_theme', loop: true, volume: 0.65, fadeMs: 250 },
          ambience: [{ assetId: 'forest_ambience', loop: true, volume: 0.35 }],
        },
      },
      initialSceneId: 'scene-1',
      patterns: {
        p1: {
          id: 'p1',
          name: 'Pattern 1',
          params: [],
          body: [{ presetId: 'Wait', params: { durationMs: 10 } }],
        },
        p2: {
          id: 'p2',
          name: 'Pattern 2',
          params: [{ id: 'p1', name: 'durationMs', type: 'number', default: 10 }],
          body: [{ presetId: 'Wait', params: { durationMs: 10 } }],
          source: { sceneId: 'scene-1', targetKind: 'entity' },
        },
      },
    };

    const yaml = serializeProjectToYaml(project);
    expect(yaml).toMatch(/\npatterns:\n/);
    expect(yaml).not.toMatch(/\nsnippets:\n/);
    expect(yaml).not.toMatch(/\nmacros:\n/);
    const parsed = parseProjectYaml(yaml);

    expect(parsed).toEqual(project);
  });

  it('loads legacy snippets/macros into patterns and serializes patterns only', () => {
    const legacyProjectYaml = stringify({
      id: 'project-1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: { 'scene-1': { ...sampleScene, backgroundLayers: [] } },
      initialSceneId: 'scene-1',
      snippets: {
        s1: {
          id: 's1',
          name: 'Snippet 1',
          kind: 'attachments',
          source: { sceneId: 'scene-1', targetKind: 'entity' },
          attachmentsTemplate: [{ presetId: 'Wait', params: { durationMs: 10 }, tag: 't-{{x}}' }],
        },
      },
      macros: {
        s1: {
          id: 's1',
          name: 'Macro wins on id collision',
          params: [{ id: 'x', name: 'x', type: 'string' }],
          body: [{ presetId: 'Wait', params: { durationMs: 10 } }],
        },
        m2: {
          id: 'm2',
          name: 'Macro 2',
          params: [],
          body: [{ presetId: 'Wait', params: { durationMs: 20 } }],
        },
      },
    } as any, { indent: 2, lineWidth: 0, minContentWidth: 0 });

    // This YAML includes legacy keys. parse should canonicalize to patterns.
    expect(legacyProjectYaml).toMatch(/\nsnippets:\n/);
    expect(legacyProjectYaml).toMatch(/\nmacros:\n/);

    const parsed = parseProjectYaml(legacyProjectYaml);
    expect(Object.keys(parsed.patterns ?? {}).length).toBe(3);
    expect(parsed.patterns?.s1?.name).toBe('Macro wins on id collision');
    expect(parsed.snippets).toBeUndefined();
    expect(parsed.macros).toBeUndefined();

    const reserialized = serializeProjectToYaml(parsed);
    expect(reserialized).toMatch(/\npatterns:\n/);
    expect(reserialized).not.toMatch(/\nsnippets:\n/);
    expect(reserialized).not.toMatch(/\nmacros:\n/);
  });

  it('round-trips optional project title and publish metadata', () => {
    const project = {
      id: 'project-1',
      title: 'My Game',
      pixelsPerUnit: 2,
      renderMode: 'smooth-2d',
      publishTitle: 'My Published Game',
      publishGithubPagesRepo: 'mygame',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: { 'scene-1': { ...sampleScene, backgroundLayers: [] } },
      initialSceneId: 'scene-1',
    };

    const yaml = serializeProjectToYaml(project as any);
    expect(yaml).toMatch(/\ntitle:\s*My Game\n/);
    expect(yaml).toMatch(/\npixelsPerUnit:\s*2\n/);
    expect(yaml).toMatch(/\nrenderMode:\s*smooth-2d\n/);
    expect(yaml).toMatch(/\npublishTitle:\s*My Published Game\n/);
    expect(yaml).toMatch(/\npublishGithubPagesRepo:\s*mygame\n/);
    expect(parseProjectYaml(yaml)).toEqual(project);
  });

  it('migrates legacy GitHub Pages route metadata into the repo field', () => {
    const yaml = serializeProjectToYaml({
      id: 'project-1',
      title: 'My Game',
      publishGithubPagesRepo: 'legacy-route',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: { 'scene-1': { ...sampleScene, backgroundLayers: [] } },
      initialSceneId: 'scene-1',
    } as any).replace('publishGithubPagesRepo:', 'publishGithubPagesRoute:');

    const parsed = parseProjectYaml(yaml);
    expect(parsed.publishGithubPagesRepo).toBe('legacy-route');
    expect((parsed as any).publishGithubPagesRoute).toBeUndefined();
  });

  it('drops sceneMeta entries that reference unknown scenes', () => {
    const yaml = serializeProjectToYaml({
      id: 'project-1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: { 'scene-1': { ...sampleScene, backgroundLayers: [] } },
      initialSceneId: 'scene-1',
      sceneMeta: {
        'scene-1': { name: 'Known', role: 'stage' },
        'missing-scene': { name: 'Missing', role: 'wave' },
      },
    });

    const parsed = parseProjectYaml(yaml);
    expect(parsed.sceneMeta).toEqual({ 'scene-1': { name: 'Known', role: 'stage' } });
  });

  it('throws when baseSceneId references an unknown scene', () => {
    const yaml = serializeProjectToYaml({
      id: 'project-1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: { 'scene-1': { ...sampleScene, backgroundLayers: [] } },
      initialSceneId: 'scene-1',
      baseSceneId: 'missing-scene',
    });

    expect(() => parseProjectYaml(yaml)).toThrow(/baseSceneId references unknown scene/);
  });

  it('round-trips scene spriteOrder (manual Sprites list order)', () => {
    const project = {
      id: 'project-1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: {
        'scene-1': {
          ...sampleScene,
          spriteOrder: ['e2', 'e1'],
        },
      },
      initialSceneId: 'scene-1',
      patterns: {},
    } as any;

    const yaml = serializeProjectToYaml(project);
    expect(yaml).toMatch(/\n\s+spriteOrder:\n/);
    const parsed = parseProjectYaml(yaml);
    expect((parsed.scenes as any)['scene-1'].spriteOrder).toEqual(['e2', 'e1']);
  });

  it('round-trips scene backgroundColor, entity tint, and scatter layout params', () => {
    const project = {
      id: 'project-1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: {
        'scene-1': {
          ...sampleScene,
          backgroundColor: 0x000000,
          entities: {
            ...sampleScene.entities,
            e1: { ...sampleScene.entities.e1, tint: 0x224466 },
          },
          groups: {
            ...sampleScene.groups,
            g1: {
              ...sampleScene.groups.g1,
              layout: {
                type: 'arrange',
                arrangeKind: 'scatter',
                params: { minX: 0, maxX: 720, minY: 5, maxY: 1285, seed: 'stars-1' },
              },
            },
          },
        },
      },
      initialSceneId: 'scene-1',
      patterns: {},
    } as any;

    const yaml = serializeProjectToYaml(project);
    expect(yaml).toMatch(/\n\s+backgroundColor:\s*0\n/);
    expect(yaml).toMatch(/\n\s+ tint:\s*2245734\n/);
    const parsed = parseProjectYaml(yaml) as any;
    expect(parsed.scenes['scene-1'].backgroundColor).toBe(0x000000);
    expect(parsed.scenes['scene-1'].entities.e1.tint).toBe(0x224466);
    expect(parsed.scenes['scene-1'].groups.g1.layout).toEqual(project.scenes['scene-1'].groups.g1.layout);
  });

  it('loads older YAML without scene background, entity tint, scatter, event, or value-source fields', () => {
    const yaml = stringify({
      id: 'legacy-project',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: {
        'scene-1': {
          id: 'scene-1',
          world: { width: 320, height: 240 },
          entities: {
            e1: { id: 'e1', x: 10, y: 20, width: 8, height: 8 },
          },
          groups: {},
          attachments: {},
          behaviors: {},
          actions: {},
          conditions: {},
        },
      },
      initialSceneId: 'scene-1',
    }, { indent: 2, lineWidth: 0, minContentWidth: 0 });

    const parsed = parseProjectYaml(yaml) as any;
    expect(parsed.scenes['scene-1'].backgroundColor).toBeUndefined();
    expect(parsed.scenes['scene-1'].entities.e1.tint).toBeUndefined();
    expect(parsed.scenes['scene-1'].eventBlocks).toBeUndefined();
    expect(parsed.scenes['scene-1'].attachments).toEqual({});

    const reserialized = serializeProjectToYaml(parsed);
    expect(reserialized).not.toMatch(/backgroundColor:/);
    expect(reserialized).not.toMatch(/tint:/);
    expect(reserialized).not.toMatch(/eventBlocks:/);
    expect(reserialized).not.toMatch(/valueSource:/);
  });

  it('round-trips typed Bounds event triggers, event-source target binding, and action value sources', () => {
    const project = {
      id: 'project-1',
      assets: { images: {}, spriteSheets: {}, fonts: {} },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: {
        'scene-1': {
          ...sampleScene,
          eventBlocks: {
            wrap: {
              id: 'wrap',
              target: { type: 'group', groupId: 'g-enemies' },
              trigger: { type: 'bounds', boundsEvent: 'wrapped', axis: 'y', side: 'bottom' },
            },
          },
          attachments: {
            rerollX: {
              id: 'rerollX',
              target: { type: 'group', groupId: 'g-enemies' },
              eventId: 'wrap',
              targetMode: 'event-source',
              presetId: 'SetProperty',
              params: { property: 'x', valueSource: { kind: 'randomRange', min: 0, max: 720, seed: 'wrap-x' } },
            },
            copyWrappedY: {
              id: 'copyWrappedY',
              target: { type: 'group', groupId: 'g-enemies' },
              eventId: 'wrap',
              targetMode: 'event-source',
              presetId: 'SetProperty',
              params: { property: 'y', valueSource: { kind: 'eventField', field: 'positionY' } },
            },
          },
        },
      },
      initialSceneId: 'scene-1',
      patterns: {},
    } as any;

    const yaml = serializeProjectToYaml(project);
    expect(yaml).toMatch(/type:\s*bounds/);
    expect(yaml).toMatch(/boundsEvent:\s*wrapped/);
    expect(yaml).toMatch(/targetMode:\s*event-source/);
    expect(yaml).toMatch(/valueSource:/);
    expect(yaml).toMatch(/kind:\s*eventField/);
    expect(yaml).toMatch(/field:\s*positionY/);
    expect(parseProjectYaml(yaml)).toEqual(project);
  });

  it('round-trips embedded asset path hints for publish and relink flows', () => {
    const project = {
      id: 'project-1',
      assets: {
        images: {
          enemy: {
            id: 'enemy',
            width: 16,
            height: 16,
            source: {
              kind: 'embedded',
              dataUrl: 'data:image/png;base64,AAAA',
              originalName: 'enemy.png',
              mimeType: 'image/png',
            },
          },
        },
        spriteSheets: {},
        fonts: {},
      },
      audio: { sounds: {} },
      inputMaps: {},
      scenes: { 'scene-1': { ...sampleScene, backgroundLayers: [] } },
      initialSceneId: 'scene-1',
      patterns: {},
    } as any;

    const yaml = serializeProjectToYaml(project);
    const parsed = parseProjectYaml(yaml);
    expect(parsed.assets.images.enemy.source).toMatchObject({
      kind: 'embedded',
      originalName: 'enemy.png',
    });
  });

  it('round-trips cloud and path asset sources for cloud save and publish flows', () => {
    const project = {
      id: 'project-1',
      assets: {
        images: {
          hero: {
            id: 'hero',
            width: 16,
            height: 16,
            source: {
              kind: 'cloud',
              assetId: 'asset-img-1',
              originalName: 'hero.png',
              mimeType: 'image/png',
            },
          },
        },
        spriteSheets: {},
        fonts: {
          arcade: {
            id: 'arcade',
            name: 'Arcade',
            source: {
              kind: 'path',
              path: 'assets/fonts/arcade.woff2',
              originalName: 'arcade.woff2',
              mimeType: 'font/woff2',
            },
          },
        },
      },
      audio: {
        sounds: {
          theme: {
            id: 'theme',
            source: {
              kind: 'cloud',
              assetId: 'asset-audio-1',
              originalName: 'theme.mp3',
              mimeType: 'audio/mpeg',
            },
          },
        },
      },
      inputMaps: {},
      scenes: { 'scene-1': { ...sampleScene, backgroundLayers: [] } },
      initialSceneId: 'scene-1',
      patterns: {},
    } as any;

    const yaml = serializeProjectToYaml(project);
    const parsed = parseProjectYaml(yaml);
    expect(parsed).toEqual(project);
  });
});

describe('project structured snapshots', () => {
  it('canonicalizes and validates a structured ProjectSpec without YAML', () => {
    const project = {
      id: 'project-1',
      title: 'Snapshot Project',
      assets: {
        images: {
          enemy: {
            id: 'enemy',
            width: 16,
            height: 16,
            source: { kind: 'embedded', dataUrl: 'data:image/png;base64,AAAA', originalName: 'enemy.png', mimeType: 'image/png' },
          },
        },
        spriteSheets: {},
        fonts: {},
      },
      audio: {
        sounds: {
          theme: {
            id: 'theme',
            source: { kind: 'embedded', dataUrl: 'data:audio/mp3;base64,AAAA', originalName: 'theme.mp3', mimeType: 'audio/mpeg' },
          },
        },
      },
      inputMaps: {
        arrows: { actions: { moveLeft: [{ device: 'keyboard', key: 'ArrowLeft', event: 'held' }] } },
      },
      defaultInputMapId: 'arrows',
      collections: { gems: { id: 'gems', name: 'Gems', entityIds: ['e1'] } },
      counters: { score: { id: 'score', name: 'Score', initialValue: 0 } },
      scenes: {
        'scene-1': {
          ...sampleScene,
          backgroundColor: 0x000000,
          entities: {
            ...sampleScene.entities,
            e1: { ...sampleScene.entities.e1, tint: 0x224466 },
          },
          groups: {
            ...sampleScene.groups,
            g1: {
              ...sampleScene.groups.g1,
              layout: {
                type: 'arrange',
                arrangeKind: 'scatter',
                params: { minX: 0, maxX: 720, minY: 5, maxY: 1285, seed: 'stars-1' },
              },
            },
          },
          eventBlocks: {
            wrap: {
              id: 'wrap',
              target: { type: 'group', groupId: 'g-enemies' },
              trigger: { type: 'bounds', boundsEvent: 'wrapped', axis: 'y', side: 'bottom' },
            },
          },
          attachments: {
            rerollX: {
              id: 'rerollX',
              target: { type: 'group', groupId: 'g-enemies' },
              eventId: 'wrap',
              targetMode: 'event-source',
              presetId: 'SetProperty',
              params: { property: 'x', valueSource: { kind: 'randomRange', min: 0, max: 720, seed: 'wrap-x' } },
            },
          },
        },
      },
      initialSceneId: 'scene-1',
      patterns: {
        p1: {
          id: 'p1',
          name: 'Pattern 1',
          params: [],
          body: [{ presetId: 'Wait', params: { durationMs: 10 } }],
        },
      },
    } as any;

    const snapshot = createProjectSnapshot(project);
    expect(snapshot.version).toBe(1);
    expect(parseProjectSnapshot(snapshot)).toEqual(project);
    expect(parseProjectSnapshot(JSON.parse(serializeProjectSnapshot(project)))).toEqual(project);
  });

  it('rejects unsupported structured snapshot versions', () => {
    expect(() => parseProjectSnapshot({ version: 999, project: {} })).toThrow(/Unsupported project snapshot version/);
  });
});
