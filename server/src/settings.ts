export type Settings = {
  corsAllowOrigins: string[];
  cookieName: string;
  csrfCookieName: string;
  cookieSecure: boolean;
  cookieSameSite: 'lax' | 'none';
  cookieDomain?: string;
  sessionTtlMs: number;
  trustProxy: boolean;
  publicBaseUrl?: string;
  frontendBaseUrl?: string;
  inviteOnly: boolean;
  inviteTtlMs: number;
  githubOAuth?: {
    clientId: string;
    clientSecret: string;
  };
  deployment?: {
    channel: 'stable' | 'dev' | 'unknown';
    commit: string;
  };
};

export function resolveCookiePolicy(settings: Pick<Settings, 'cookieSameSite' | 'cookieSecure' | 'frontendBaseUrl' | 'publicBaseUrl'>): {
  sameSite: 'lax' | 'none';
  secure: boolean;
} {
  if (settings.cookieSameSite === 'none') return { sameSite: 'none', secure: true };

  const frontendBaseUrl = settings.frontendBaseUrl?.trim();
  const publicBaseUrl = settings.publicBaseUrl?.trim();
  if (frontendBaseUrl && publicBaseUrl) {
    try {
      const frontendUrl = new URL(frontendBaseUrl);
      const publicUrl = new URL(publicBaseUrl);
      if (frontendUrl.protocol === 'https:' && publicUrl.protocol === 'https:' && frontendUrl.origin !== publicUrl.origin) {
        return { sameSite: 'none', secure: true };
      }
    } catch {
      // Fall back to explicit settings when URLs are not parseable.
    }
  }

  return { sameSite: 'lax', secure: settings.cookieSecure };
}

export function loadSettingsFromEnv(env: NodeJS.ProcessEnv): Settings {
  const corsAllowOrigins = String(env.CORS_ALLOW_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const githubClientId = env.GITHUB_CLIENT_ID;
  const githubClientSecret = env.GITHUB_CLIENT_SECRET;

  const cookieSameSite = (env.COOKIE_SAMESITE ?? 'lax').trim().toLowerCase() === 'none' ? 'none' : 'lax';
  const frontendBaseUrl = typeof env.FRONTEND_BASE_URL === 'string' ? env.FRONTEND_BASE_URL.trim().replace(/\/+$/, '') : undefined;
  const inviteOnly = (env.INVITE_ONLY ?? 'false').trim().toLowerCase() === 'true';
  const inviteTtlMs = Number(env.INVITE_TTL_MS ?? 1000 * 60 * 60 * 24 * 7);

  return {
    corsAllowOrigins,
    cookieName: env.COOKIE_NAME ?? 'pa_session',
    csrfCookieName: env.CSRF_COOKIE_NAME ?? 'pa_csrf',
    cookieSecure: (env.COOKIE_SECURE ?? 'false') === 'true',
    cookieSameSite,
    sessionTtlMs: Number(env.SESSION_TTL_MS ?? 1000 * 60 * 60 * 24 * 30),
    trustProxy: (env.TRUST_PROXY ?? 'false') === 'true',
    publicBaseUrl: typeof env.PUBLIC_BASE_URL === 'string' ? env.PUBLIC_BASE_URL.trim().replace(/\/+$/, '') : undefined,
    frontendBaseUrl,
    inviteOnly,
    inviteTtlMs,
    githubOAuth:
      githubClientId && githubClientSecret
        ? { clientId: githubClientId, clientSecret: githubClientSecret }
        : undefined,
    deployment: {
      channel:
        env.DEPLOY_CHANNEL === 'stable' || env.DEPLOY_CHANNEL === 'dev' ? env.DEPLOY_CHANNEL : 'unknown',
      commit: env.DEPLOY_COMMIT?.trim() || 'unknown',
    },
  };
}
