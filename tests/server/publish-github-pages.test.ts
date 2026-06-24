import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { createApp } from '../../server/src/server/app';
import { createMemoryRepositories } from '../../server/src/server/repositories/memory';
import { createEmptyProject } from '../../src/model/emptyProject';

function makeApp() {
  const repositories = createMemoryRepositories();
  const app = createApp({
    settings: {
      corsAllowOrigins: ['http://localhost:5173'],
      cookieName: 'pa_session',
      csrfCookieName: 'pa_csrf',
      cookieSecure: false,
      cookieSameSite: 'lax',
      sessionTtlMs: 1000 * 60 * 60,
      trustProxy: false,
      publicBaseUrl: 'http://localhost:8787',
      frontendBaseUrl: 'http://localhost:5173',
      inviteOnly: false,
      inviteTtlMs: 1000 * 60 * 60,
    },
    repositories,
  });
  return { app, repositories };
}

async function signup(agent: request.SuperTest<request.Test>) {
  const csrfRes = await agent.get('/api/v1/auth/csrf').expect(200);
  const csrf = csrfRes.body.csrfToken as string;

  const res = await agent
    .post('/api/v1/auth/signup')
    .set('x-csrf-token', csrf)
    .send({ email: 'alice@example.com', password: 'password123' })
    .expect(200);

  return { csrf, userId: res.body.user.id as string };
}

async function linkGithub(repositories: ReturnType<typeof createMemoryRepositories>, userId: string) {
  await repositories.oauth.create({
    id: 'oa1',
    userId,
    provider: 'github',
    providerAccountId: '123',
    providerLogin: 'alice',
    accessToken: 't',
    createdAt: new Date().toISOString(),
  } as any);
}

async function addGame(repositories: ReturnType<typeof createMemoryRepositories>, userId: string) {
  const project = createEmptyProject();
  project.id = 'p1';
  project.initialSceneId = 's1';
  const initialScene = structuredClone(project.scenes[project.initialSceneId]);
  delete project.scenes[project.initialSceneId];
  project.scenes.s1 = { ...initialScene, id: 's1' };

  await repositories.games.create({
    id: 'g1',
    userId,
    title: 'Game One',
    project,
    createdAt: '2026-06-04T00:00:00.000Z',
    updatedAt: '2026-06-04T00:00:00.000Z',
  } as any);
}

describe('publish github pages', () => {
  let originalCwd = '';
  let tempDir = '';

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phaserforge-publish-test-'));
    const distDir = path.join(tempDir, 'dist');
    await fs.mkdir(path.join(distDir, 'assets'), { recursive: true });
    await fs.writeFile(path.join(distDir, 'index.html'), '<!doctype html><html><head></head><body><div id="root"></div></body></html>');
    await fs.writeFile(path.join(distDir, 'style.css'), 'body{margin:0;}');
    await fs.writeFile(path.join(distDir, 'assets', 'game.js'), 'console.log("game");');
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    vi.unstubAllGlobals();
  });

  it('requires auth', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.get('/api/v1/publish/github-pages/info').expect(401);
  });

  it('info returns github_not_linked without oauth', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await signup(agent);
    const res = await agent.get('/api/v1/publish/github-pages/info').expect(400);
    expect(res.body.error).toBe('github_not_linked');
  });

  it('check reports that a per-game repo is available to create', async () => {
    const { app, repositories } = makeApp();
    const agent = request.agent(app);
    const { userId, csrf } = await signup(agent);
    await linkGithub(repositories, userId);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe('https://api.github.com/repos/alice/mygame');
        return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
      }) as any,
    );

    const res = await agent
      .post('/api/v1/publish/github-pages/check')
      .set('x-csrf-token', csrf)
      .send({ repo: 'mygame' })
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      url: 'https://alice.github.io/mygame/',
      exists: false,
      routeExists: false,
      pagesConfigured: false,
      deploymentStatus: null,
    });
  });

  it('check reports when the target route already serves content', async () => {
    const { app, repositories } = makeApp();
    const agent = request.agent(app);
    const { userId, csrf } = await signup(agent);
    await linkGithub(repositories, userId);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === 'https://api.github.com/repos/alice/zoof') {
          expect(init?.method ?? 'GET').toBe('GET');
          return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
        }
        if (url === 'https://alice.github.io/zoof/') {
          expect(init?.method).toBe('HEAD');
          return new Response('', { status: 200 });
        }
        throw new Error(`Unhandled fetch ${url}`);
      }) as any,
    );

    const res = await agent
      .post('/api/v1/publish/github-pages/check')
      .set('x-csrf-token', csrf)
      .send({ repo: 'zoof' })
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      url: 'https://alice.github.io/zoof/',
      exists: false,
      routeExists: true,
      pagesConfigured: false,
      deploymentStatus: null,
    });
  });

  it('publish creates a repo, configures Pages, and commits the game in one commit', async () => {
    const { app, repositories } = makeApp();
    const agent = request.agent(app);
    const { userId, csrf } = await signup(agent);
    await linkGithub(repositories, userId);
    await addGame(repositories, userId);

    const treeBodies: any[] = [];
    const blobBodies: Array<{ content: string; encoding: string }> = [];
    let blobIndex = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === 'https://api.github.com/repos/alice/zoof') {
          if (!init?.method || init.method === 'GET') {
            return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
          }
        }
        if (url === 'https://api.github.com/user/repos') {
          expect(init?.method).toBe('POST');
          return new Response(JSON.stringify({ name: 'zoof', full_name: 'alice/zoof', default_branch: 'main' }), { status: 201 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/pages') {
          if (!init?.method || init.method === 'GET') return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
          expect(init?.method).toBe('POST');
          return new Response(JSON.stringify({ html_url: 'https://alice.github.io/zoof' }), { status: 201 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/ref/heads/main') {
          return new Response(JSON.stringify({ object: { sha: 'basecommit' } }), { status: 200 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/commits/basecommit') {
          return new Response(JSON.stringify({ sha: 'basecommit', tree: { sha: 'basetree' } }), { status: 200 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/blobs') {
          expect(init?.method).toBe('POST');
          blobBodies.push(JSON.parse(String(init?.body)));
          blobIndex += 1;
          return new Response(JSON.stringify({ sha: `blob-${blobIndex}` }), { status: 201 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/trees') {
          expect(init?.method).toBe('POST');
          treeBodies.push(JSON.parse(String(init?.body)));
          return new Response(JSON.stringify({ sha: 'newtree' }), { status: 201 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/commits') {
          return new Response(JSON.stringify({ sha: 'newcommit' }), { status: 201 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/refs/heads/main') {
          expect(init?.method).toBe('PATCH');
          return new Response(JSON.stringify({}), { status: 200 });
        }
        if (url.includes('https://api.github.com/repos/alice/zoof/actions/runs?')) {
          return new Response(
            JSON.stringify({
              workflow_runs: [{ head_sha: 'newcommit', status: 'queued', conclusion: null }],
            }),
            { status: 200 },
          );
        }
        throw new Error(`Unhandled fetch ${url}`);
      }) as any,
    );

    const res = await agent
      .post('/api/v1/publish/github-pages')
      .set('x-csrf-token', csrf)
      .send({ gameId: 'g1', repo: 'zoof' })
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      url: 'https://alice.github.io/zoof/',
      repo: 'zoof',
      repoCreated: true,
      deploymentStatus: 'queued',
    });
    expect(treeBodies).toHaveLength(1);
    expect(treeBodies[0].tree.some((entry: any) => entry.path === '.github/workflows/deploy-phaserforge-pages.yml')).toBe(true);
    expect(treeBodies[0].tree.some((entry: any) => entry.path === 'index.html')).toBe(true);
    expect(treeBodies[0].tree.some((entry: any) => entry.path === 'game.yaml')).toBe(true);
    const workflowBlob = blobBodies
      .map((blob) => Buffer.from(blob.content, 'base64').toString('utf8'))
      .find((content) => content.includes('Deploy PhaserForge game to GitHub Pages'));
    expect(workflowBlob).toContain('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true');
    expect(workflowBlob).toContain('[ "$entry" != ".pages-artifact" ]');
  });

  it('publish surfaces Pages permission failures distinctly', async () => {
    const { app, repositories } = makeApp();
    const agent = request.agent(app);
    const { userId, csrf } = await signup(agent);
    await linkGithub(repositories, userId);
    await addGame(repositories, userId);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === 'https://api.github.com/repos/alice/zoof') {
          if (!init?.method || init.method === 'GET') return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
        }
        if (url === 'https://api.github.com/user/repos') {
          return new Response(JSON.stringify({ name: 'zoof', full_name: 'alice/zoof', default_branch: 'main' }), { status: 201 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/pages') {
          if (!init?.method || init.method === 'GET') return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
          return new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
        }
        throw new Error(`Unhandled fetch ${url}`);
      }) as any,
    );

    const res = await agent
      .post('/api/v1/publish/github-pages')
      .set('x-csrf-token', csrf)
      .send({ gameId: 'g1', repo: 'zoof' })
      .expect(400);

    expect(res.body.error).toBe('github_pages_permission_required');
  });

  it('publish surfaces workflow scope failures distinctly', async () => {
    const { app, repositories } = makeApp();
    const agent = request.agent(app);
    const { userId, csrf } = await signup(agent);
    await linkGithub(repositories, userId);
    await addGame(repositories, userId);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === 'https://api.github.com/repos/alice/zoof') {
          if (!init?.method || init.method === 'GET') return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
        }
        if (url === 'https://api.github.com/user/repos') {
          return new Response(JSON.stringify({ name: 'zoof', full_name: 'alice/zoof', default_branch: 'main' }), { status: 201 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/pages') {
          if (!init?.method || init.method === 'GET') return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
          return new Response(JSON.stringify({ html_url: 'https://alice.github.io/zoof' }), { status: 201 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/ref/heads/main') {
          return new Response(JSON.stringify({ object: { sha: 'basecommit' } }), { status: 200 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/commits/basecommit') {
          return new Response(JSON.stringify({ sha: 'basecommit', tree: { sha: 'basetree' } }), { status: 200 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/blobs') {
          return new Response(JSON.stringify({ message: 'Workflow scope required' }), { status: 403 });
        }
        throw new Error(`Unhandled fetch ${url}`);
      }) as any,
    );

    const res = await agent
      .post('/api/v1/publish/github-pages')
      .set('x-csrf-token', csrf)
      .send({ gameId: 'g1', repo: 'zoof' })
      .expect(400);

    expect(res.body.error).toBe('github_workflow_permission_required');
  });

  it('publish materializes cloud assets into repo files and rewrites game.yaml paths', async () => {
    const { app, repositories } = makeApp();
    const agent = request.agent(app);
    const { userId, csrf } = await signup(agent);
    await linkGithub(repositories, userId);
    await addGame(repositories, userId);

    const upload = await agent
      .post('/api/v1/assets')
      .set('x-csrf-token', csrf)
      .send({
        dataUrl: 'data:audio/mpeg;base64,QUJDRA==',
        originalName: 'theme.mp3',
        mimeType: 'audio/mpeg',
      })
      .expect(201);

    const assetId = upload.body.asset.assetId as string;
    const game = await repositories.games.findByIdForUser('g1', userId);
    if (!game) throw new Error('expected game');
    game.project.audio.sounds.theme = {
      id: 'theme',
      source: {
        kind: 'cloud',
        assetId,
        originalName: 'theme.mp3',
        mimeType: 'audio/mpeg',
      },
    } as any;
    game.project.scenes.s1.music = { assetId: 'theme', loop: true, volume: 0.8 };
    await repositories.games.updateForUser('g1', userId, {
      project: game.project,
      updatedAt: '2026-06-04T01:00:00.000Z',
    });

    const blobBodies: Array<{ content: string; encoding: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === 'https://api.github.com/repos/alice/zoof') {
          if (!init?.method || init.method === 'GET') return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
        }
        if (url === 'https://api.github.com/user/repos') {
          return new Response(JSON.stringify({ name: 'zoof', full_name: 'alice/zoof', default_branch: 'main' }), { status: 201 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/pages') {
          if (!init?.method || init.method === 'GET') return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
          return new Response(JSON.stringify({ html_url: 'https://alice.github.io/zoof' }), { status: 201 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/ref/heads/main') {
          return new Response(JSON.stringify({ object: { sha: 'basecommit' } }), { status: 200 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/commits/basecommit') {
          return new Response(JSON.stringify({ sha: 'basecommit', tree: { sha: 'basetree' } }), { status: 200 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/blobs') {
          blobBodies.push(JSON.parse(String(init?.body)));
          return new Response(JSON.stringify({ sha: `blob-${blobBodies.length}` }), { status: 201 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/trees') {
          return new Response(JSON.stringify({ sha: 'newtree' }), { status: 201 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/commits') {
          return new Response(JSON.stringify({ sha: 'newcommit' }), { status: 201 });
        }
        if (url === 'https://api.github.com/repos/alice/zoof/git/refs/heads/main') {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        if (url.includes('https://api.github.com/repos/alice/zoof/actions/runs?')) {
          return new Response(
            JSON.stringify({
              workflow_runs: [{ head_sha: 'newcommit', status: 'queued', conclusion: null }],
            }),
            { status: 200 },
          );
        }
        throw new Error(`Unhandled fetch ${url}`);
      }) as any,
    );

    await agent
      .post('/api/v1/publish/github-pages')
      .set('x-csrf-token', csrf)
      .send({ gameId: 'g1', repo: 'zoof' })
      .expect(200);

    const decodedBlobs = blobBodies.map((blob) => Buffer.from(blob.content, 'base64'));
    const audioBlob = decodedBlobs.find((bytes) => bytes.toString('utf8') === 'ABCD');
    expect(audioBlob).toBeDefined();

    const yamlBlob = decodedBlobs
      .map((bytes) => bytes.toString('utf8'))
      .find((content) => content.includes('game.yaml') || content.includes('initialSceneId'));
    expect(yamlBlob).toContain('kind: path');
    expect(yamlBlob).toContain('path: assets/cloud/theme.mp3');
    expect(yamlBlob).not.toContain('kind: cloud');
  });
});
