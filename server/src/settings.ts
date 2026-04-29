export type Settings = {
  corsAllowOrigins: string[];
  cookieName: string;
  csrfCookieName: string;
  cookieSecure: boolean;
  cookieDomain?: string;
  sessionTtlMs: number;
  trustProxy: boolean;
  publicBaseUrl?: string;
  githubOAuth?: {
    clientId: string;
    clientSecret: string;
  };
};

export function loadSettingsFromEnv(env: NodeJS.ProcessEnv): Settings {
  const corsAllowOrigins = String(env.CORS_ALLOW_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const githubClientId = env.GITHUB_CLIENT_ID;
  const githubClientSecret = env.GITHUB_CLIENT_SECRET;

  return {
    corsAllowOrigins,
    cookieName: env.COOKIE_NAME ?? 'pa_session',
    csrfCookieName: env.CSRF_COOKIE_NAME ?? 'pa_csrf',
    cookieSecure: (env.COOKIE_SECURE ?? 'false') === 'true',
    sessionTtlMs: Number(env.SESSION_TTL_MS ?? 1000 * 60 * 60 * 24 * 30),
    trustProxy: (env.TRUST_PROXY ?? 'false') === 'true',
    publicBaseUrl: env.PUBLIC_BASE_URL,
    githubOAuth:
      githubClientId && githubClientSecret
        ? { clientId: githubClientId, clientSecret: githubClientSecret }
        : undefined,
  };
}

