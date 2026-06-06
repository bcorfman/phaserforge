export type AuthUser = { id: string; email: string };
export type CloudGameMeta = { id: string; title: string; created_at: string; updated_at: string };
export type CloudGame = CloudGameMeta & { yaml: string };

type Json = Record<string, unknown>;

function getApiBaseUrl(): string | undefined {
  const metaEnv = (import.meta as any)?.env as Record<string, unknown> | undefined;
  const fromMeta = typeof metaEnv?.VITE_API_BASE_URL === 'string' ? metaEnv.VITE_API_BASE_URL : undefined;
  const fromProcess =
    typeof process !== 'undefined' && typeof process.env?.VITE_API_BASE_URL === 'string' ? process.env.VITE_API_BASE_URL : undefined;
  const url = (fromMeta ?? fromProcess)?.trim();
  return url ? url.replace(/\/+$/, '') : undefined;
}

function resolveApiUrl(path: string): string {
  const base = getApiBaseUrl();
  return base ? new URL(path, `${base}/`).toString() : path;
}

async function readJson(res: Response): Promise<Json> {
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as Json) : {};
  } catch {
    return {};
  }
}

async function api<T extends Json>(path: string, init: RequestInit = {}): Promise<T> {
  const url = resolveApiUrl(path);
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
  });

  const json = (await readJson(res)) as T;
  if (!res.ok) {
    const errorVal = (json as unknown as { error?: unknown })?.error;
    const error = typeof errorVal === 'string' ? errorVal : `http_${res.status}`;
    throw new Error(error);
  }
  return json;
}

export async function fetchCsrfToken(): Promise<string> {
  const json = await api<{ csrfToken: string }>('/api/v1/auth/csrf');
  if (typeof json.csrfToken !== 'string') throw new Error('invalid_csrf_response');
  return json.csrfToken;
}

export async function signup(
  email: string,
  password: string,
  csrfToken: string,
  inviteToken?: string,
): Promise<{ user: AuthUser }> {
  const json = await api<{ user: AuthUser }>('/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify({ email, password, ...(inviteToken ? { inviteToken } : {}) }),
  });
  return json;
}

export async function login(email: string, password: string, csrfToken: string): Promise<{ user: AuthUser }> {
  const json = await api<{ user: AuthUser }>('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify({ email, password }),
  });
  return json;
}

export async function logout(csrfToken: string): Promise<void> {
  await api('/api/v1/auth/logout', { method: 'POST', headers: { 'x-csrf-token': csrfToken } });
}

export async function me(): Promise<{ user: AuthUser }> {
  const json = await api<{ user: AuthUser }>('/api/v1/auth/me');
  return json;
}

export async function listGames(): Promise<{ games: CloudGameMeta[] }> {
  const json = await api<{ games: CloudGameMeta[] }>('/api/v1/games');
  return json;
}

export async function createGame(title: string, yaml: string, csrfToken: string): Promise<{ game: CloudGameMeta }> {
  const json = await api<{ game: CloudGameMeta }>('/api/v1/games', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify({ title, yaml }),
  });
  return json;
}

export async function getGame(id: string): Promise<{ game: CloudGame }> {
  const json = await api<{ game: CloudGame }>(`/api/v1/games/${encodeURIComponent(id)}`);
  return json;
}

export async function updateGame(
  id: string,
  patch: { title?: string; yaml?: string },
  csrfToken: string,
): Promise<{ updated_at: string }> {
  const json = await api<{ updated_at: string }>(`/api/v1/games/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify(patch),
  });
  return json;
}

export async function getGithubPagesPublishInfo(): Promise<{ ok: true; login: string; pagesBaseUrl: string } | { ok: false; error: string }> {
  try {
    const json = await api<{ ok: true; login: string; pagesBaseUrl: string }>('/api/v1/publish/github-pages/info');
    return json;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'publish_info_failed' };
  }
}

export async function checkGithubPagesTarget(
  repo: string,
  csrfToken: string,
): Promise<
  | { ok: true; url: string; exists: boolean; routeExists: boolean; pagesConfigured: boolean; deploymentStatus: string | null }
  | { ok: false; error: string }
> {
  try {
    const json = await api<{ ok: true; url: string; exists: boolean; routeExists: boolean; pagesConfigured: boolean; deploymentStatus: string | null }>(
      '/api/v1/publish/github-pages/check',
      {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken },
      body: JSON.stringify({ repo }),
    },
    );
    return json;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'publish_check_failed' };
  }
}

export async function publishToGithubPages(
  gameId: string,
  repo: string,
  csrfToken: string,
): Promise<
  | { ok: true; url: string; repo: string; repoCreated: boolean; deploymentStatus: 'built' | 'building' | 'queued' | 'configured' }
  | { ok: false; error: string; url?: string }
> {
  try {
    const json = await api<{ ok: true; url: string; repo: string; repoCreated: boolean; deploymentStatus: 'built' | 'building' | 'queued' | 'configured' }>(
      '/api/v1/publish/github-pages',
      {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken },
      body: JSON.stringify({ gameId, repo }),
    },
    );
    return json;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'publish_failed';
    return { ok: false, error: msg };
  }
}

export async function disconnectGithub(csrfToken: string): Promise<void> {
  await api('/api/v1/auth/github/disconnect', { method: 'POST', headers: { 'x-csrf-token': csrfToken } });
}
