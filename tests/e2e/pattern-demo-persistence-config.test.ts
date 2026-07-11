import { describe, expect, it } from 'vitest';
import { getPatternDemoCloudLiveConfigError } from './patternDemoPersistenceCloudConfig';

describe('pattern demo cloud-live config', () => {
  it('allows local mode without a hosted base URL', () => {
    expect(getPatternDemoCloudLiveConfigError({
      persistenceTarget: 'local',
      baseUrl: '',
    })).toBeNull();
  });

  it('requires a base URL in cloud-live mode', () => {
    expect(getPatternDemoCloudLiveConfigError({
      persistenceTarget: 'cloud-live',
      baseUrl: '',
    })).toContain('`PW_BASE_URL`');
  });

  it('rejects localhost targets in cloud-live mode', () => {
    expect(getPatternDemoCloudLiveConfigError({
      persistenceTarget: 'cloud-live',
      baseUrl: 'http://127.0.0.1:4173',
    })).toContain('cannot target a local base URL');
  });

  it('accepts the deployed GitHub Pages target in cloud-live mode', () => {
    expect(getPatternDemoCloudLiveConfigError({
      persistenceTarget: 'cloud-live',
      baseUrl: 'https://bcorfman.github.io/phaserforge/',
    })).toBeNull();
  });
});
