import { http, HttpResponse } from 'msw';
import { createEmptyProject } from '../../model/emptyProject';

export type ApiStubResponse = {
  status: number;
  body: unknown;
};

export type MockCloudUser = { id: string; email: string } | null;
export type MockPublishInfo =
  | { ok: true; login: string; pagesBaseUrl: string }
  | { ok: false; error: string };

const EMPTY_PROJECT = createEmptyProject();
EMPTY_PROJECT.id = 'p1';
EMPTY_PROJECT.initialSceneId = 's1';
const initialScene = structuredClone(EMPTY_PROJECT.scenes[EMPTY_PROJECT.initialSceneId]);
delete EMPTY_PROJECT.scenes[EMPTY_PROJECT.initialSceneId];
EMPTY_PROJECT.scenes.s1 = { ...initialScene, id: 's1' };

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
        game: { id, title: 'E2E Stub Game', project: EMPTY_PROJECT, created_at: 'c', updated_at: 'u' },
      },
    };
  }
  if (normalizedMethod === 'POST' && pathname === '/api/v1/assets') {
    return { status: 201, body: { asset: { kind: 'cloud', assetId: 'asset-stub', originalName: 'asset.bin', mimeType: 'application/octet-stream' } } };
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
    | {
        ok: true;
        url: string;
        exists: boolean;
        routeExists: boolean;
        pagesConfigured: boolean;
        deploymentStatus: string | null;
        currentPublishLive?: boolean | null;
      }
    | { ok: false; error: string };
  publishResult?:
    | {
        ok: true;
        url: string;
        repo: string;
        repoCreated: boolean;
        deploymentStatus: 'built' | 'building' | 'queued' | 'configured';
        publishMarker?: string;
      }
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
    http.post(/.*\/api\/v1\/assets/, async () => {
      return HttpResponse.json({ asset: { kind: 'cloud', assetId: 'asset-storybook', originalName: 'asset.bin', mimeType: 'application/octet-stream' } }, { status: 201 });
    }),
    http.get(/.*\/api\/v1\/assets\/[^/]+\/content/, () => {
      return new HttpResponse(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'application/octet-stream' } });
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
