import express from 'express';
import rateLimit from 'express-rate-limit';

import type { Repositories } from '../types';
import type { Settings } from '../../settings';
import { randomToken, safeEqual, sha256Base64Url } from '../../security/crypto';
import { requireAuth } from '../auth/sessionAuth';
import { AuthSchemas, loginWithPassword, logout, setSessionCookie, signupWithPassword } from '../services/authService';
import { newId } from '../../security/ids';

export function authRouter(settings: Settings, repositories: Repositories) {
  const router = express.Router();
  const cookieSameSite = settings.cookieSameSite === 'none' ? 'none' : 'lax';
  const cookieSecure = settings.cookieSameSite === 'none' ? true : settings.cookieSecure;

  const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  router.get('/csrf', (req, res) => {
    const csrfToken = randomToken(24);
    res.cookie(settings.csrfCookieName, csrfToken, {
      httpOnly: false,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      path: '/',
      ...(settings.cookieDomain ? { domain: settings.cookieDomain } : {}),
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ csrfToken });
  });

  function setOAuthStateCookie(res: express.Response, token: string) {
    res.cookie('pa_oauth_state', token, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
  }

  function clearOAuthStateCookie(res: express.Response) {
    res.clearCookie('pa_oauth_state', { path: '/' });
  }

  function setOAuthForceSwitchCookie(res: express.Response, enabled: boolean) {
    res.cookie('pa_oauth_force_switch', enabled ? '1' : '0', {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
  }

  function clearOAuthForceSwitchCookie(res: express.Response) {
    res.clearCookie('pa_oauth_force_switch', { path: '/' });
  }

  function setReturnToCookie(res: express.Response, returnTo: string) {
    res.cookie('pa_return_to', returnTo, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
  }

  function clearReturnToCookie(res: express.Response) {
    res.clearCookie('pa_return_to', { path: '/' });
  }

  function resolveFrontendRedirectUrl(returnTo: string): string {
    try {
      const base = new URL(settings.frontendBaseUrl ?? '/');
      const target = new URL(returnTo.startsWith('/') ? returnTo : '/', base);
      return target.origin === base.origin ? target.toString() : new URL(base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`, base).toString();
    } catch {
      return '/';
    }
  }

  function redirectToFrontendWithError(res: express.Response, returnTo: string, error: string) {
    const redirectUrl = new URL(resolveFrontendRedirectUrl(returnTo));
    redirectUrl.searchParams.set('githubAuthError', error);
    res.redirect(302, redirectUrl.toString());
  }

  async function createSession(userId: string, res: express.Response) {
    const now = new Date().toISOString();
    const sessionToken = randomToken(32);
    const sessionTokenHash = sha256Base64Url(sessionToken);
    const sessionId = newId('sess');
    const expiresAt = new Date(Date.now() + settings.sessionTtlMs).toISOString();
    await repositories.sessions.create({
      id: sessionId,
      userId,
      tokenHash: sessionTokenHash,
      createdAt: now,
      expiresAt,
      lastSeenAt: now,
    });
    setSessionCookie(res, settings, sessionToken);
  }

  router.get('/github/start', authLimiter, requireAuth(settings, repositories), (req, res) => {
    if (!settings.githubOAuth || !settings.publicBaseUrl || !settings.frontendBaseUrl) {
      res.status(400).json({ error: 'oauth_not_configured' });
      return;
    }

    const rawReturnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : '/';
    const returnTo = (() => {
      if (rawReturnTo.startsWith('/')) return rawReturnTo;
      if (rawReturnTo.startsWith('http://') || rawReturnTo.startsWith('https://')) {
        try {
          const base = new URL(settings.frontendBaseUrl);
          const candidate = new URL(rawReturnTo);
          if (candidate.origin !== base.origin) return null;
          return `${candidate.pathname}${candidate.search}${candidate.hash}` || '/';
        } catch {
          return null;
        }
      }
      return null;
    })();
    if (!returnTo) {
      res.status(400).json({ error: 'invalid_return_to' });
      return;
    }

    const state = randomToken(24);
    setOAuthStateCookie(res, state);
    const forceSwitch = req.query.forceSwitch === '1' || req.query.forceSwitch === 'true';
    setOAuthForceSwitchCookie(res, Boolean(forceSwitch));
    setReturnToCookie(res, returnTo);

    const callbackUrl = new URL('/api/v1/auth/github/callback', settings.publicBaseUrl).toString();
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', settings.githubOAuth.clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'user:email,public_repo');

    res.redirect(302, authUrl.toString());
  });

  router.get('/github/callback', authLimiter, requireAuth(settings, repositories), async (req, res) => {
    if (!settings.githubOAuth || !settings.publicBaseUrl || !settings.frontendBaseUrl) {
      res.status(400).json({ error: 'oauth_not_configured' });
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const cookieState = typeof req.cookies?.pa_oauth_state === 'string' ? req.cookies.pa_oauth_state : undefined;
    clearOAuthStateCookie(res);
    const forceSwitchCookie = typeof req.cookies?.pa_oauth_force_switch === 'string' ? req.cookies.pa_oauth_force_switch : '0';
    clearOAuthForceSwitchCookie(res);
    const returnTo = typeof req.cookies?.pa_return_to === 'string' ? req.cookies.pa_return_to : '/';
    clearReturnToCookie(res);

    if (!code || !state || !cookieState || !safeEqual(state, cookieState)) {
      res.status(400).json({ error: 'invalid_oauth_state' });
      return;
    }

    const callbackUrl = new URL('/api/v1/auth/github/callback', settings.publicBaseUrl).toString();
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        client_id: settings.githubOAuth.clientId,
        client_secret: settings.githubOAuth.clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });
    if (!tokenRes.ok) {
      res.status(502).json({ error: 'github_token_exchange_failed' });
      return;
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenJson.access_token;
    if (!accessToken) {
      res.status(502).json({ error: 'github_token_exchange_failed' });
      return;
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${accessToken}`,
        'user-agent': 'phaserforge',
      },
    });
    if (!userRes.ok) {
      res.status(502).json({ error: 'github_user_fetch_failed' });
      return;
    }
    const ghUser = (await userRes.json()) as { id?: number; login?: string };
    if (typeof ghUser.id !== 'number' || typeof ghUser.login !== 'string' || ghUser.login.trim().length === 0) {
      res.status(502).json({ error: 'github_user_fetch_failed' });
      return;
    }
    const ghLogin = ghUser.login.trim();

    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${accessToken}`,
        'user-agent': 'phaserforge',
      },
    });
    if (!emailRes.ok) {
      res.status(502).json({ error: 'github_email_fetch_failed' });
      return;
    }
    const emails = (await emailRes.json()) as Array<{ email?: string; primary?: boolean; verified?: boolean }>;
    const primary = emails.find((e) => e.primary && e.verified && typeof e.email === 'string');
    const email = primary?.email;
    if (!email) {
      res.status(400).json({ error: 'github_email_unavailable' });
      return;
    }

    const provider = 'github';
    const providerAccountId = String(ghUser.id);

    const userId = (req as unknown as { userId: string }).userId;
    const existingLinked = await repositories.oauth.findByUserIdProvider(userId, provider);
    const existingByAccount = await repositories.oauth.findByProviderAccount(provider, providerAccountId);
    if (existingByAccount && existingByAccount.userId !== userId) {
      await repositories.oauth.deleteByUserIdProvider(existingByAccount.userId, provider);
    }
    if (existingLinked && existingLinked.providerAccountId !== providerAccountId) {
      const allowSwitch = forceSwitchCookie === '1';
      if (!allowSwitch) {
        redirectToFrontendWithError(res, returnTo, 'github_already_linked_different_account');
        return;
      }
      await repositories.oauth.deleteByUserIdProvider(userId, provider);
    }

    const linkedNow = await repositories.oauth.findByUserIdProvider(userId, provider);
    if (linkedNow) {
      await repositories.oauth.update(linkedNow.id, { providerLogin: ghLogin, accessToken });
    } else {
      await repositories.oauth.create({
        id: newId('oa'),
        userId,
        provider,
        providerAccountId,
        providerLogin: ghLogin,
        accessToken,
        createdAt: new Date().toISOString(),
      });
    }

    res.redirect(302, resolveFrontendRedirectUrl(returnTo));
  });

  router.post('/github/disconnect', requireAuth(settings, repositories), async (req, res) => {
    const userId = (req as unknown as { userId: string }).userId;
    await repositories.oauth.deleteByUserIdProvider(userId, 'github');
    res.json({ ok: true });
  });

  router.post('/signup', authLimiter, async (req, res) => {
    const parsed = AuthSchemas.signup.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

    const result = await signupWithPassword(settings, repositories, res, parsed.data);
    if (!result.ok) {
      if (result.error === 'email_taken') {
        res.status(409).json({ error: result.error });
        return;
      }
      if (result.error === 'invite_required' || result.error === 'invite_invalid') {
        res.status(403).json({ error: result.error });
        return;
      }
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ user: result.user });
  });

  router.post('/login', authLimiter, async (req, res) => {
    const parsed = AuthSchemas.login.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

    const result = await loginWithPassword(settings, repositories, res, parsed.data);
    if (!result.ok) {
      res.status(result.error === 'invalid_credentials' ? 401 : 400).json({ error: result.error });
      return;
    }
    res.json({ user: result.user });
  });

  router.post('/logout', requireAuth(settings, repositories), async (req, res) => {
    await logout(settings, repositories, req.cookies, res);
    res.json({ ok: true });
  });

  router.get('/me', requireAuth(settings, repositories), async (req, res) => {
    const userId = (req as unknown as { userId: string }).userId;
    const user = await repositories.users.findById(userId);
    if (!user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    res.json({ user: { id: user.id, email: user.email } });
  });

  return router;
}
