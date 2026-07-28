import { describe, expect, it } from 'vitest';

import {
  assertHostedSecurity,
  projectHostedSecurityObservation,
  type HostedSecurityObservation,
} from '../../scripts/repair-harness/hosted/security';

const expected = {
  frontendOrigin: 'https://pages.example',
  csrfCookieName: 'pa_csrf',
  sessionCookieName: 'pa_session',
  expectedSameSite: 'none' as const,
};

function observation(overrides: Partial<HostedSecurityObservation> = {}): HostedSecurityObservation {
  return {
    csrfCookie: { name: 'pa_csrf', secure: true, sameSite: 'none' },
    sessionCookie: { name: 'pa_session', secure: true, sameSite: 'none' },
    csrfHeaderSent: true,
    cors: { allowOrigin: 'https://pages.example', allowCredentials: true },
    ...overrides,
  };
}

describe('hosted security and lifecycle assertions phase 3', () => {
  it('accepts the expected CSRF/header/CORS/cookie contract', () => {
    expect(assertHostedSecurity(expected, observation())).toEqual([]);
  });

  it('rejects a missing CSRF cookie, missing write header, unsafe CORS, and weak cookies', () => {
    const reasons = assertHostedSecurity(expected, observation({
      csrfCookie: undefined,
      sessionCookie: { name: 'pa_session', secure: false, sameSite: 'lax' },
      csrfHeaderSent: false,
      cors: { allowOrigin: '*', allowCredentials: true },
    }));
    expect(reasons).toEqual(expect.arrayContaining([
      'Expected CSRF cookie pa_csrf was not set.',
      'Authenticated write did not send the CSRF header.',
      'CORS must allow the configured Pages origin, not a wildcard.',
      'Session cookie must be Secure.',
      'Session cookie must use SameSite=none in hosted mode.',
    ]));
  });

  it('projects only names and policy metadata, never cookie or header values', () => {
    const projected = projectHostedSecurityObservation({
      ...observation(),
      csrfTokenValue: 'csrf-secret',
      csrfHeaderValue: 'csrf-secret',
      sessionCookieValue: 'session-secret',
    });
    expect(projected).toEqual({
      csrfCookie: { name: 'pa_csrf', secure: true, sameSite: 'none' },
      sessionCookie: { name: 'pa_session', secure: true, sameSite: 'none' },
      csrfHeaderSent: true,
      cors: { allowOrigin: 'https://pages.example', allowCredentials: true },
    });
    expect(JSON.stringify(projected)).not.toContain('secret');
  });
});
