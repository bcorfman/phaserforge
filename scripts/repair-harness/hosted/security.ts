export type HostedSameSite = 'lax' | 'strict' | 'none';

export interface HostedCookieObservation {
  name: string;
  secure: boolean;
  sameSite?: HostedSameSite;
}

export interface HostedSecurityObservation {
  csrfCookie?: HostedCookieObservation;
  sessionCookie?: HostedCookieObservation;
  csrfHeaderSent: boolean;
  cors: {
    allowOrigin?: string;
    allowCredentials: boolean;
  };
  // Internal-only values accepted by the projection helper and never emitted.
  csrfTokenValue?: string;
  csrfHeaderValue?: string;
  sessionCookieValue?: string;
}

export interface HostedSecurityExpectation {
  frontendOrigin: string;
  csrfCookieName: string;
  sessionCookieName: string;
  expectedSameSite: HostedSameSite;
}

export function assertHostedSecurity(expected: HostedSecurityExpectation, observation: HostedSecurityObservation): string[] {
  const reasons: string[] = [];
  if (!observation.csrfHeaderSent) reasons.push('Authenticated write did not send the CSRF header.');
  if (observation.cors.allowOrigin !== expected.frontendOrigin || observation.cors.allowOrigin === '*') {
    reasons.push('CORS must allow the configured Pages origin, not a wildcard.');
  }
  if (!observation.cors.allowCredentials) reasons.push('CORS must allow credentials for hosted cookies.');
  checkCookie(reasons, 'Session', observation.sessionCookie, expected.sessionCookieName, expected.expectedSameSite);
  checkCookie(reasons, 'CSRF', observation.csrfCookie, expected.csrfCookieName, expected.expectedSameSite);
  return reasons;
}

export function projectHostedSecurityObservation(observation: HostedSecurityObservation): Omit<HostedSecurityObservation, 'csrfTokenValue' | 'csrfHeaderValue' | 'sessionCookieValue'> {
  return {
    ...(observation.csrfCookie ? { csrfCookie: observation.csrfCookie } : {}),
    ...(observation.sessionCookie ? { sessionCookie: observation.sessionCookie } : {}),
    csrfHeaderSent: observation.csrfHeaderSent,
    cors: observation.cors,
  };
}

function checkCookie(reasons: string[], label: string, cookie: HostedCookieObservation | undefined, expectedName: string, expectedSameSite: HostedSameSite): void {
  if (!cookie || cookie.name !== expectedName) {
    reasons.push(`Expected ${label === 'CSRF' ? 'CSRF' : label.toLowerCase()} cookie ${expectedName} was not set.`);
    return;
  }
  if (!cookie.secure) reasons.push(`${label} cookie must be Secure.`);
  if (cookie.sameSite !== expectedSameSite) reasons.push(`${label} cookie must use SameSite=${expectedSameSite} in hosted mode.`);
}
