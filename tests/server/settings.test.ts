import { describe, expect, it } from 'vitest';

import { loadSettingsFromEnv } from '../../server/src/settings';

describe('deployment settings', () => {
  it('normalizes deployment channel and commit from the service environment', () => {
    const settings = loadSettingsFromEnv({ DEPLOY_CHANNEL: 'dev', DEPLOY_COMMIT: 'abc123' });
    expect(settings.deployment).toEqual({ channel: 'dev', commit: 'abc123' });
  });

  it('does not infer a stable deployment when the channel is missing or invalid', () => {
    expect(loadSettingsFromEnv({}).deployment).toEqual({ channel: 'unknown', commit: 'unknown' });
    expect(loadSettingsFromEnv({ DEPLOY_CHANNEL: 'production' }).deployment?.channel).toBe('unknown');
  });
});
