export type ApiStubResponse = {
  status: number;
  body: unknown;
};

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
