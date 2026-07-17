import { describe, expect, it } from 'vitest';
import { getChannelScopedStorageKey, isCloudPersistenceEnabledForChannel, resolveEditorDeployChannel } from '../../src/editor/deployChannel';

describe('deploy channel helpers', () => {
  it('keeps stable on the existing production persistence namespace', () => {
    expect(resolveEditorDeployChannel({ VITE_PHASERFORGE_DEPLOY_CHANNEL: 'stable' }, { pathname: '/phaserforge/stable/' })).toBe('stable');
    expect(getChannelScopedStorageKey('phaserforge.persistence.v1', { VITE_PHASERFORGE_DEPLOY_CHANNEL: 'stable' })).toBe('phaserforge.persistence.v1');
  });

  it('scopes dev persistence away from stable', () => {
    expect(resolveEditorDeployChannel({ VITE_PHASERFORGE_DEPLOY_CHANNEL: 'dev' }, { pathname: '/phaserforge/stable/' })).toBe('dev');
    expect(getChannelScopedStorageKey('phaserforge.persistence.v1', { VITE_PHASERFORGE_DEPLOY_CHANNEL: 'dev' })).toBe('phaserforge.persistence.v1.dev');
  });

  it('falls back to the deployed path when the build env is absent', () => {
    expect(resolveEditorDeployChannel({}, { pathname: '/phaserforge/dev/' })).toBe('dev');
    expect(resolveEditorDeployChannel({}, { pathname: '/phaserforge/' })).toBe('stable');
  });

  it('gates dev cloud persistence behind an explicit compatibility flag', () => {
    expect(isCloudPersistenceEnabledForChannel({ VITE_PHASERFORGE_DEPLOY_CHANNEL: 'stable' })).toBe(true);
    expect(isCloudPersistenceEnabledForChannel({ VITE_PHASERFORGE_DEPLOY_CHANNEL: 'dev' })).toBe(false);
    expect(isCloudPersistenceEnabledForChannel({
      VITE_PHASERFORGE_DEPLOY_CHANNEL: 'dev',
      VITE_PHASERFORGE_ENABLE_DEV_CLOUD_PERSISTENCE: '1',
    })).toBe(true);
  });
});
