export type AuthUser = { id: string; email: string };
export type CloudGameMeta = { id: string; title: string; created_at: string; updated_at: string };
export type CloudGame = CloudGameMeta & { yaml: string };

type Json = Record<string, unknown>;

async function readJson(res: Response): Promise<Json> {
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as Json) : {};
  } catch {
    return {};
  }
}

async function api<T extends Json>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
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

export async function signup(email: string, password: string, csrfToken: string): Promise<{ user: AuthUser }> {
  const json = await api<{ user: AuthUser }>('/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
    body: JSON.stringify({ email, password }),
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
