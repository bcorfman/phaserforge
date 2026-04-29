import express from 'express';
import rateLimit from 'express-rate-limit';

import type { Repositories } from '../types';
import type { Settings } from '../../settings';
import { randomToken, safeEqual, sha256Base64Url } from '../../security/crypto';
import { requireAuth } from '../auth/sessionAuth';
import { AuthSchemas, loginWithPassword, logout, setCsrfCookie, setSessionCookie, signupWithPassword } from '../services/authService';
import { newId } from '../../security/ids';

export function authRouter(settings: Settings, repositories: Repositories) {
  const router = express.Router();

  const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  router.get('/csrf', (_req, res) => {
    const csrf = randomToken(24);
    setCsrfCookie(res, settings, csrf);
    res.json({ csrfToken: csrf });
  });

  function setOAuthStateCookie(res: express.Response, token: string) {
    res.cookie('pa_oauth_state', token, {
      httpOnly: true,
      secure: settings.cookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
  }

  function clearOAuthStateCookie(res: express.Response) {
    res.clearCookie('pa_oauth_state', { path: '/' });
  }

  function setReturnToCookie(res: express.Response, returnTo: string) {
    res.cookie('pa_return_to', returnTo, {
      httpOnly: true,
      secure: settings.cookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
  }

  function clearReturnToCookie(res: express.Response) {
    res.clearCookie('pa_return_to', { path: '/' });
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

  router.get('/github/start', (req, res) => {
    if (!settings.githubOAuth || !settings.publicBaseUrl) {
      res.status(400).json({ error: 'oauth_not_configured' });
      return;
    }

    const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : '/';
    if (!returnTo.startsWith('/')) {
      res.status(400).json({ error: 'invalid_return_to' });
      return;
    }

    const state = randomToken(24);
    setOAuthStateCookie(res, state);
    setReturnToCookie(res, returnTo);

    const callbackUrl = new URL('/api/v1/auth/github/callback', settings.publicBaseUrl).toString();
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', settings.githubOAuth.clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'user:email');

    res.redirect(302, authUrl.toString());
  });

  router.get('/github/callback', async (req, res) => {
    if (!settings.githubOAuth || !settings.publicBaseUrl) {
      res.status(400).json({ error: 'oauth_not_configured' });
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const cookieState = typeof req.cookies?.pa_oauth_state === 'string' ? req.cookies.pa_oauth_state : undefined;
    clearOAuthStateCookie(res);
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
        'user-agent': 'phaseractions-studio',
      },
    });
    if (!userRes.ok) {
      res.status(502).json({ error: 'github_user_fetch_failed' });
      return;
    }
    const ghUser = (await userRes.json()) as { id?: number };
    if (typeof ghUser.id !== 'number') {
      res.status(502).json({ error: 'github_user_fetch_failed' });
      return;
    }

    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${accessToken}`,
        'user-agent': 'phaseractions-studio',
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

    const existingOAuth = await repositories.oauth.findByProviderAccount(provider, providerAccountId);
    let userId: string;
    if (existingOAuth) {
      userId = existingOAuth.userId;
    } else {
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await repositories.users.findByEmail(normalizedEmail);
      userId = existingUser?.id ?? newId('user');
      if (!existingUser) {
        await repositories.users.create({ id: userId, email: normalizedEmail, passwordHash: null, createdAt: new Date().toISOString() });
      }
      await repositories.oauth.create({
        id: newId('oa'),
        userId,
        provider,
        providerAccountId,
        createdAt: new Date().toISOString(),
      });
    }

    await createSession(userId, res);
    res.redirect(302, returnTo.startsWith('/') ? returnTo : '/');
  });

  router.post('/signup', authLimiter, async (req, res) => {
    const parsed = AuthSchemas.signup.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

    const result = await signupWithPassword(settings, repositories, res, parsed.data);
    if (!result.ok) {
      res.status(result.error === 'email_taken' ? 409 : 400).json({ error: result.error });
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
