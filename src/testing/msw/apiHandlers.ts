import { http, HttpResponse } from 'msw';

export type ApiStubResponse = {
  status: number;
  body: unknown;
};

export type MockCloudUser = { id: string; email: string } | null;
export type MockPublishInfo =
  | { ok: true; login: string; pagesBaseUrl: string }
  | { ok: false; error: string };

const EMPTY_PROJECT_YAML = [
  'id: p1',
  'assets:',
  '  images: {}',
  '  spriteSheets: {}',
  '  fonts: {}',
  'audio:',
  '  sounds: {}',
  'inputMaps: {}',
  'scenes:',
  '  s1:',
  '    id: s1',
  '    entities: {}',
  '    groups: {}',
  '    attachments: {}',
  '    behaviors: {}',
  '    actions: {}',
  '    conditions: {}',
  'initialSceneId: s1',
].join('\n');

export function getDefaultApiStubResponse(urlString: string, method: string): ApiStubResponse {
  const url = new URL(urlString);
  const pathname = url.pathname;
  const normalizedMethod = method.toUpperCase();

  if (normalizedMethod === 'GET' && pathname === '/api/v1/auth/csrf') {
    return { status: 200, body: { csrfToken: 'e2e-csrf' } };
  }
  if (normalizedMethod === 'GET' && pathname === '/api/v1/auth/me') {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  if (normalizedMethod === 'GET' && pathname === '/api/v1/games') {
    return { status: 200, body: { games: [] } };
  }
  if (normalizedMethod === 'GET' && pathname.startsWith('/api/v1/games/')) {
    const id = pathname.split('/').pop() || 'g';
    return {
      status: 200,
      body: {
        game: { id, title: 'E2E Stub Game', yaml: EMPTY_PROJECT_YAML, created_at: 'c', updated_at: 'u' },
      },
    };
  }
  if (normalizedMethod === 'GET' && pathname === '/api/v1/publish/github-pages/info') {
    return { status: 400, body: { error: 'github_not_linked' } };
  }
  if (normalizedMethod === 'POST' && pathname === '/api/v1/publish/github-pages/check') {
    return { status: 400, body: { error: 'github_not_linked' } };
  }
  if (normalizedMethod === 'POST' && pathname === '/api/v1/publish/github-pages') {
    return { status: 400, body: { error: 'github_not_linked' } };
  }

  return { status: 503, body: { error: 'e2e_api_stub_unhandled' } };
}

export const defaultApiHandlers = [
  http.all(/.*\/api\/.*/, ({ request }) => {
    const response = getDefaultApiStubResponse(request.url, request.method);
    return HttpResponse.json(response.body, { status: response.status });
  }),
];

export function createCloudAuthHandlers(options: {
  user: MockCloudUser;
  publishInfo?: MockPublishInfo;
  loginUser?: { id: string; email: string };
  games?: Array<{ id: string; title: string; created_at: string; updated_at: string }>;
  publishCheck?:
    | { ok: true; url: string; exists: boolean; routeExists: boolean; pagesConfigured: boolean; deploymentStatus: string | null }
    | { ok: false; error: string };
  publishResult?:
    | { ok: true; url: string; repo: string; repoCreated: boolean; deploymentStatus: 'built' | 'building' | 'queued' | 'configured' }
    | { ok: false; error: string; url?: string };
}) {
  const publishInfo = options.publishInfo ?? { ok: false as const, error: 'github_not_linked' };
  const games = options.games ?? [];
  const publishCheck = options.publishCheck ?? { ok: false as const, error: 'github_not_linked' };
  const publishResult = options.publishResult ?? { ok: false as const, error: 'github_not_linked' };
  return [
    http.get(/.*\/api\/v1\/auth\/me/, () => {
      if (!options.user) {
        return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
      return HttpResponse.json({ user: options.user }, { status: 200 });
    }),
    http.post(/.*\/api\/v1\/auth\/login/, () => {
      if (!options.loginUser) {
        return HttpResponse.json({ error: 'invalid_credentials' }, { status: 401 });
      }
      return HttpResponse.json({ user: options.loginUser }, { status: 200 });
    }),
    http.get(/.*\/api\/v1\/games/, () => {
      return HttpResponse.json({ games }, { status: 200 });
    }),
    http.post(/.*\/api\/v1\/games/, async () => {
      return HttpResponse.json({ game: { id: 'g1', title: 'Storybook Game', created_at: 'c', updated_at: 'u' } }, { status: 201 });
    }),
    http.put(/.*\/api\/v1\/games\/[^/]+/, async () => {
      return HttpResponse.json({ updated_at: 'u' }, { status: 200 });
    }),
    http.get(/.*\/api\/v1\/publish\/github-pages\/info/, () => {
      return HttpResponse.json(publishInfo, { status: publishInfo.ok ? 200 : 400 });
    }),
    http.post(/.*\/api\/v1\/publish\/github-pages\/check/, () => {
      return HttpResponse.json(publishCheck, { status: publishCheck.ok ? 200 : 400 });
    }),
    http.post(/.*\/api\/v1\/publish\/github-pages/, () => {
      return HttpResponse.json(publishResult, { status: publishResult.ok ? 200 : 400 });
    }),
  ];
}
