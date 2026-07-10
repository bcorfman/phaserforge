import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { serializeProjectToYaml } from '../../../../src/model/serialization';
import type { AssetFileSource, ProjectSpec } from '../../../../src/model/types';
import type { Repositories } from '../types';

type Ok<T> = T & { ok: true };
type Err<E extends string> = { ok: false; error: E; url?: string };

type PublishInfoOk = Ok<{ login: string; pagesBaseUrl: string }>;
type PublishError =
  | 'github_not_linked'
  | 'github_token_missing'
  | 'github_repo_permission_required'
  | 'github_workflow_permission_required'
  | 'github_pages_permission_required'
  | 'github_pages_build_failed'
  | 'repo_unavailable'
  | 'not_found'
  | 'cloud_asset_missing'
  | 'dist_missing'
  | 'github_failed';

type GitHubRepoRecord = {
  name: string;
  full_name: string;
  private?: boolean;
  default_branch?: string;
  owner?: { login?: string };
};

type GitRefRecord = { object?: { sha?: string } };
type GitCommitRecord = { sha?: string; tree?: { sha?: string } };
type WorkflowRunsResponse = {
  workflow_runs?: Array<{
    head_sha?: string;
    status?: string | null;
    conclusion?: string | null;
  }>;
};

const GITHUB_API_VERSION = '2022-11-28';
const PAGES_WORKFLOW_PATH = '.github/workflows/deploy-phaserforge-pages.yml';
const PAGES_PUBLISH_PROBE_PATH = 'phaserforge-publish.json';

function normalizeRepoName(repo: string): string {
  return repo.trim();
}

function pagesUrlFor(login: string, repo: string): string {
  const base = `https://${login}.github.io/`;
  const normalizedRepo = normalizeRepoName(repo).replace(/^\/+/, '').replace(/\/+$/, '');
  return normalizedRepo ? new URL(`${normalizedRepo}/`, base).toString() : base;
}

async function routeExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

function createPublishToken(): string {
  return `pf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildPublishProbeJson(publishToken: string): string {
  return JSON.stringify({ publishToken, generatedAt: new Date().toISOString() }, null, 2);
}

async function fetchPublishedToken(url: string): Promise<string | null> {
  try {
    const probeUrl = new URL(PAGES_PUBLISH_PROBE_PATH, url);
    probeUrl.searchParams.set('pf_check', String(Date.now()));
    const res = await fetch(probeUrl.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache, no-store, max-age=0', pragma: 'no-cache' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { publishToken?: unknown };
    return typeof json.publishToken === 'string' && json.publishToken.trim() ? json.publishToken : null;
  } catch {
    return null;
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+/, '').replace(/-+$/, '') || 'asset';
}

function extensionFromMimeType(mimeType: string | null | undefined): string {
  switch (mimeType) {
    case 'audio/mpeg':
      return '.mp3';
    case 'audio/ogg':
      return '.ogg';
    case 'audio/wav':
      return '.wav';
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'font/woff2':
      return '.woff2';
    case 'font/woff':
      return '.woff';
    case 'font/otf':
      return '.otf';
    case 'font/ttf':
      return '.ttf';
    default:
      return '';
  }
}

function decodeEmbeddedDataUrl(dataUrl: string): Uint8Array | null {
  const match = /^data:[^;,]+(?:;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  try {
    return new Uint8Array(Buffer.from(match[1] ?? '', 'base64'));
  } catch {
    return null;
  }
}

async function materializeProjectForPublish(
  repositories: Repositories,
  userId: string,
  project: ProjectSpec,
): Promise<{ project: ProjectSpec; files: Array<{ path: string; bytes: Uint8Array }> } | null> {
  const nextProject = structuredClone(project);
  const files: Array<{ path: string; bytes: Uint8Array }> = [];
  const usedPaths = new Set<string>();
  const copiedPathSources = new Set<string>();

  const allocatePath = (source: AssetFileSource, fallbackBase: string): string => {
    const preferred = sanitizeFilename(source.originalName?.trim() || `${fallbackBase}${extensionFromMimeType(source.mimeType)}`);
    let relPath = `assets/cloud/${preferred}`;
    let index = 2;
    while (usedPaths.has(relPath)) {
      const ext = path.extname(preferred);
      const stem = ext ? preferred.slice(0, -ext.length) : preferred;
      relPath = `assets/cloud/${stem}-${index}${ext}`;
      index += 1;
    }
    usedPaths.add(relPath);
    return relPath;
  };

  const materializeSource = async (source: AssetFileSource, fallbackBase: string): Promise<AssetFileSource | null> => {
    if (source.kind === 'path') {
      const relPath = source.path.replace(/^\/+/, '');
      const absPath = path.resolve(process.cwd(), relPath);
      const relativeToRepo = path.relative(process.cwd(), absPath);
      if (relativeToRepo.startsWith('..') || path.isAbsolute(relativeToRepo)) {
        return source;
      }
      if (!copiedPathSources.has(relPath)) {
        try {
          const bytes = new Uint8Array(await fs.readFile(absPath));
          files.push({ path: relPath, bytes });
          copiedPathSources.add(relPath);
        } catch {
          return null;
        }
      }
      return source;
    }
    if (source.kind === 'embedded') {
      const bytes = decodeEmbeddedDataUrl(source.dataUrl);
      if (!bytes) return null;
      const relPath = allocatePath(source, fallbackBase);
      files.push({ path: relPath, bytes });
      return { kind: 'path', path: relPath, ...(source.originalName ? { originalName: source.originalName } : {}), ...(source.mimeType ? { mimeType: source.mimeType } : {}) };
    }
    const asset = await repositories.assets.findByIdForUser(source.assetId, userId);
    if (!asset) return null;
    const relPath = allocatePath(
      { kind: 'cloud', assetId: source.assetId, originalName: source.originalName ?? asset.originalName ?? undefined, mimeType: source.mimeType ?? asset.mimeType ?? undefined },
      fallbackBase,
    );
    files.push({ path: relPath, bytes: asset.bytes });
    return {
      kind: 'path',
      path: relPath,
      ...(source.originalName ?? asset.originalName ? { originalName: source.originalName ?? asset.originalName ?? undefined } : {}),
      ...(source.mimeType ?? asset.mimeType ? { mimeType: source.mimeType ?? asset.mimeType ?? undefined } : {}),
    };
  };

  for (const [assetId, asset] of Object.entries(nextProject.assets.images ?? {})) {
    const source = await materializeSource(asset.source, assetId);
    if (!source) return null;
    asset.source = source;
  }
  for (const [assetId, asset] of Object.entries(nextProject.assets.spriteSheets ?? {})) {
    const source = await materializeSource(asset.source, assetId);
    if (!source) return null;
    asset.source = source;
  }
  for (const [assetId, asset] of Object.entries(nextProject.assets.fonts ?? {})) {
    const source = await materializeSource(asset.source, assetId);
    if (!source) return null;
    asset.source = source;
  }
  for (const [assetId, asset] of Object.entries(nextProject.audio.sounds ?? {})) {
    const source = await materializeSource(asset.source, assetId);
    if (!source) return null;
    asset.source = source;
  }

  return { project: nextProject, files };
}

async function readPublishableDistFiles(): Promise<Array<{ relPath: string; bytes: Uint8Array }>> {
  const distRoot = path.resolve(process.cwd(), 'dist');
  const allowTop = new Set(['index.html', 'favicon.png', 'style.css', 'editor-config.yaml', 'editor-registry.yaml']);
  const files: Array<{ relPath: string; bytes: Uint8Array }> = [];

  const addFile = async (relPath: string) => {
    const abs = path.join(distRoot, relPath);
    const bytes = await fs.readFile(abs);
    files.push({ relPath, bytes });
  };

  for (const name of allowTop) {
    await addFile(name).catch(() => {});
  }

  const assetsDir = path.join(distRoot, 'assets');
  const walk = async (dir: string, prefix: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      const rel = `${prefix}${entry.name}`;
      if (entry.isDirectory()) {
        await walk(abs, `${rel}/`);
      } else if (entry.isFile()) {
        const bytes = await fs.readFile(abs);
        files.push({ relPath: `assets/${rel}`, bytes });
      }
    }
  };

  await walk(assetsDir, '').catch(() => {});
  return files;
}

function buildPlayIndexHtml(distIndexHtml: string): string {
  const meta = `<meta name="phaserforge-mode" content="play" />`;
  const boot = `<script>window.__PHASER_FORGE_PLAY_YAML_URL = './game.yaml';</script>`;
  if (distIndexHtml.includes('name="phaserforge-mode"')) return distIndexHtml;
  return distIndexHtml.replace('</title>', `</title>\n  ${meta}\n  ${boot}`);
}

function buildPagesWorkflowYaml(): string {
  return [
    'name: Deploy PhaserForge game to GitHub Pages',
    '',
    'on:',
    '  push:',
    '    branches: ["main"]',
    '  workflow_dispatch:',
    '',
    'permissions:',
    '  contents: read',
    '  pages: write',
    '  id-token: write',
    '',
    'concurrency:',
    '  group: "pages"',
    '  cancel-in-progress: true',
    '',
    'jobs:',
    '  build:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Checkout',
    '        uses: actions/checkout@v6',
    '      - name: Setup Pages',
    '        uses: actions/configure-pages@v6',
    '      - name: Collect site files',
    '        shell: bash',
    '        run: |',
    '          mkdir -p .pages-artifact',
    '          shopt -s dotglob nullglob',
    '          for entry in *; do',
    '            if [ "$entry" != ".github" ] && [ "$entry" != ".pages-artifact" ]; then',
    '              cp -R "$entry" .pages-artifact/',
    '            fi',
    '          done',
    '      - name: Upload artifact',
    '        uses: actions/upload-pages-artifact@v5',
    '        with:',
    '          path: .pages-artifact',
    '  deploy:',
    '    needs: build',
    '    runs-on: ubuntu-latest',
    '    environment:',
    '      name: github-pages',
    '      url: ${{ steps.deployment.outputs.page_url }}',
    '    steps:',
      '      - name: Deploy to GitHub Pages',
      '        id: deployment',
    '        uses: actions/deploy-pages@v5',
    '',
  ].join('\n');
}

function parseGithubMessage(text: string): string {
  try {
    const parsed = JSON.parse(text) as { message?: unknown };
    return typeof parsed.message === 'string' ? parsed.message : text;
  } catch {
    return text;
  }
}

async function githubApi<T>(
  accessToken: string,
  url: string,
  init: RequestInit = {},
): Promise<{ ok: true; json: T; status: number } | { ok: false; status: number; text: string }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'phaserforge',
      'x-github-api-version': GITHUB_API_VERSION,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, text };
  try {
    return { ok: true, status: res.status, json: (text ? (JSON.parse(text) as T) : ({} as T)) };
  } catch {
    return { ok: false, status: 502, text: 'invalid_json' };
  }
}

async function resolveGithubToken(
  repositories: Repositories,
  userId: string,
): Promise<PublishInfoOk | Err<'github_not_linked' | 'github_token_missing'>> {
  const oauth = await repositories.oauth.findByUserIdProvider(userId, 'github');
  if (!oauth) return { ok: false, error: 'github_not_linked' };
  const login = oauth.providerLogin ?? '';
  if (!login) return { ok: false, error: 'github_not_linked' };
  const token = oauth.accessToken ?? '';
  if (!token) return { ok: false, error: 'github_token_missing' };
  return { ok: true, login, pagesBaseUrl: `https://${login}.github.io/` };
}

async function getRepo(accessToken: string, owner: string, repo: string) {
  return githubApi<GitHubRepoRecord>(accessToken, `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
}

async function ensureRepo(accessToken: string, owner: string, repo: string): Promise<Ok<{ defaultBranch: string; existed: boolean }> | Err<'github_repo_permission_required' | 'repo_unavailable' | 'github_failed'>> {
  const existing = await getRepo(accessToken, owner, repo);
  if (existing.ok) {
    return { ok: true, defaultBranch: existing.json.default_branch || 'main', existed: true };
  }

  if (existing.status !== 404) {
    if (existing.status === 401 || existing.status === 403) return { ok: false, error: 'github_repo_permission_required' };
    return { ok: false, error: 'github_failed' };
  }

  const created = await githubApi<GitHubRepoRecord>(accessToken, 'https://api.github.com/user/repos', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: repo,
      private: false,
      auto_init: true,
      homepage: pagesUrlFor(owner, repo),
    }),
  });
  if (!created.ok) {
    if (created.status === 401 || created.status === 403) return { ok: false, error: 'github_repo_permission_required' };
    if (created.status === 422) return { ok: false, error: 'repo_unavailable' };
    return { ok: false, error: 'github_failed' };
  }

  return { ok: true, defaultBranch: created.json.default_branch || 'main', existed: false };
}

async function ensurePagesConfigured(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<Ok<{ url: string }> | Err<'github_pages_permission_required' | 'github_failed'>> {
  const site = await githubApi<{ html_url?: string }>(accessToken, `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pages`);
  if (site.ok) {
    const updated = await githubApi<Record<string, never>>(
      accessToken,
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pages`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ build_type: 'workflow', source: { branch, path: '/' } }),
      },
    );
    if (!updated.ok) {
      if (updated.status === 401 || updated.status === 403) return { ok: false, error: 'github_pages_permission_required' };
      return { ok: false, error: 'github_failed' };
    }
    return { ok: true, url: site.json.html_url || pagesUrlFor(owner, repo).replace(/\/$/, '') };
  }

  if (site.status !== 404) {
    if (site.status === 401 || site.status === 403) return { ok: false, error: 'github_pages_permission_required' };
    return { ok: false, error: 'github_failed' };
  }

  const created = await githubApi<{ html_url?: string }>(
    accessToken,
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pages`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ build_type: 'workflow', source: { branch, path: '/' } }),
    },
  );
  if (!created.ok) {
    if (created.status === 401 || created.status === 403) return { ok: false, error: 'github_pages_permission_required' };
    return { ok: false, error: 'github_failed' };
  }
  return { ok: true, url: created.json.html_url || pagesUrlFor(owner, repo).replace(/\/$/, '') };
}

async function getHeadCommit(accessToken: string, owner: string, repo: string, branch: string): Promise<Ok<{ commitSha: string; treeSha: string }> | Err<'github_failed'>> {
  const ref = await githubApi<GitRefRecord>(
    accessToken,
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`,
  );
  if (!ref.ok || !ref.json.object?.sha) return { ok: false, error: 'github_failed' };

  const commit = await githubApi<GitCommitRecord>(
    accessToken,
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${encodeURIComponent(ref.json.object.sha)}`,
  );
  if (!commit.ok || !commit.json.tree?.sha || !commit.json.sha) return { ok: false, error: 'github_failed' };
  return { ok: true, commitSha: commit.json.sha, treeSha: commit.json.tree.sha };
}

async function commitFiles(params: {
  accessToken: string;
  owner: string;
  repo: string;
  branch: string;
  message: string;
  files: Array<{ path: string; bytes: Uint8Array }>;
}): Promise<Ok<{ commitSha: string }> | Err<'github_workflow_permission_required' | 'github_failed'>> {
  const head = await getHeadCommit(params.accessToken, params.owner, params.repo, params.branch);
  if (!head.ok) return head;

  const treeEntries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
  for (const file of params.files) {
    const blob = await githubApi<{ sha?: string }>(
      params.accessToken,
      `https://api.github.com/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/git/blobs`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: Buffer.from(file.bytes).toString('base64'), encoding: 'base64' }),
      },
    );
    if (!blob.ok || !blob.json.sha) {
      const message = parseGithubMessage(blob.text);
      if (blob.status === 401 || blob.status === 403 || /workflow/i.test(message)) {
        return { ok: false, error: 'github_workflow_permission_required' };
      }
      return { ok: false, error: 'github_failed' };
    }
    treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.json.sha });
  }

  const tree = await githubApi<{ sha?: string }>(
    params.accessToken,
    `https://api.github.com/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/git/trees`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ base_tree: head.treeSha, tree: treeEntries }),
    },
  );
  if (!tree.ok || !tree.json.sha) return { ok: false, error: 'github_failed' };

  const commit = await githubApi<{ sha?: string }>(
    params.accessToken,
    `https://api.github.com/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/git/commits`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: params.message, tree: tree.json.sha, parents: [head.commitSha] }),
    },
  );
  if (!commit.ok || !commit.json.sha) return { ok: false, error: 'github_failed' };

  const updatedRef = await githubApi<Record<string, never>>(
    params.accessToken,
    `https://api.github.com/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/git/refs/heads/${encodeURIComponent(params.branch)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sha: commit.json.sha, force: false }),
    },
  );
  if (!updatedRef.ok) return { ok: false, error: 'github_failed' };

  return { ok: true, commitSha: commit.json.sha };
}

async function waitForDeploymentAcceptance(
  accessToken: string,
  owner: string,
  repo: string,
  commitSha: string,
): Promise<Ok<{ deploymentStatus: 'built' | 'building' | 'queued' | 'configured' }> | Err<'github_pages_build_failed' | 'github_failed'>> {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const runs = await githubApi<WorkflowRunsResponse>(
      accessToken,
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?head_sha=${encodeURIComponent(commitSha)}&event=push&per_page=5`,
    );
    if (!runs.ok) {
      if (runs.status === 404) return { ok: true, deploymentStatus: 'configured' };
      return { ok: false, error: 'github_failed' };
    }
    const match = (runs.json.workflow_runs ?? []).find((run) => run.head_sha === commitSha);
    if (!match) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    if (match.status === 'completed') {
      if (match.conclusion === 'success') return { ok: true, deploymentStatus: 'built' };
      return { ok: false, error: 'github_pages_build_failed' };
    }
    if (match.status === 'in_progress') return { ok: true, deploymentStatus: 'building' };
    if (match.status === 'queued' || match.status === 'waiting' || match.status === 'requested' || match.status == null) {
      return { ok: true, deploymentStatus: 'queued' };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return { ok: true, deploymentStatus: 'configured' };
}

export async function publishInfo(
  repositories: Repositories,
  userId: string,
): Promise<PublishInfoOk | Err<'github_not_linked' | 'github_token_missing'>> {
  return resolveGithubToken(repositories, userId);
}

export async function checkGithubPagesTarget(
  repositories: Repositories,
  userId: string,
  repo: string,
  publishToken?: string,
): Promise<
  Ok<{ url: string; exists: boolean; routeExists: boolean; pagesConfigured: boolean; deploymentStatus: string | null; currentPublishLive: boolean | null }>
  | Err<'github_not_linked' | 'github_token_missing' | 'github_repo_permission_required' | 'github_failed'>
> {
  const info = await resolveGithubToken(repositories, userId);
  if (!info.ok) return info;
  const oauth = await repositories.oauth.findByUserIdProvider(userId, 'github');
  const accessToken = oauth?.accessToken ?? '';
  if (!accessToken) return { ok: false, error: 'github_token_missing' };

  const normalizedRepo = normalizeRepoName(repo);
  const url = pagesUrlFor(info.login, normalizedRepo);
  const publicRouteExists = await routeExists(url);
  const currentPublishLive = publishToken ? (await fetchPublishedToken(url)) === publishToken : null;
  const repoRes = await getRepo(accessToken, info.login, normalizedRepo);
  if (!repoRes.ok) {
    if (repoRes.status === 404) {
      return { ok: true, url, exists: false, routeExists: publicRouteExists, pagesConfigured: false, deploymentStatus: null, currentPublishLive };
    }
    if (repoRes.status === 401 || repoRes.status === 403) return { ok: false, error: 'github_repo_permission_required' };
    return { ok: false, error: 'github_failed' };
  }

  const pageRes = await githubApi<{ status?: string }>(
    accessToken,
    `https://api.github.com/repos/${encodeURIComponent(info.login)}/${encodeURIComponent(normalizedRepo)}/pages`,
  );
  if (!pageRes.ok) {
    if (pageRes.status === 404) {
      return { ok: true, url, exists: true, routeExists: publicRouteExists, pagesConfigured: false, deploymentStatus: null, currentPublishLive };
    }
    return { ok: true, url, exists: true, routeExists: publicRouteExists, pagesConfigured: false, deploymentStatus: null, currentPublishLive };
  }

  return {
    ok: true,
    url,
    exists: true,
    routeExists: publicRouteExists,
    pagesConfigured: true,
    deploymentStatus: pageRes.json.status ?? null,
    currentPublishLive,
  };
}

export async function publishGameToGithubPages(
  repositories: Repositories,
  userId: string,
  input: { gameId: string; repo: string },
): Promise<
  Ok<{ url: string; repo: string; deploymentStatus: 'built' | 'building' | 'queued' | 'configured'; repoCreated: boolean; publishToken: string }>
  | Err<PublishError>
> {
  const info = await resolveGithubToken(repositories, userId);
  if (!info.ok) return info;
  const normalizedRepo = normalizeRepoName(input.repo);
  const url = pagesUrlFor(info.login, normalizedRepo);

  const game = await repositories.games.findByIdForUser(input.gameId, userId);
  if (!game) return { ok: false, error: 'not_found' };

  const oauth = await repositories.oauth.findByUserIdProvider(userId, 'github');
  const accessToken = oauth?.accessToken ?? '';
  if (!accessToken) return { ok: false, error: 'github_token_missing' };

  const ensuredRepo = await ensureRepo(accessToken, info.login, normalizedRepo);
  if (!ensuredRepo.ok) return { ok: false, error: ensuredRepo.error, url };

  const pages = await ensurePagesConfigured(accessToken, info.login, normalizedRepo, ensuredRepo.defaultBranch);
  if (!pages.ok) return { ok: false, error: pages.error, url };

  let distFiles: Array<{ relPath: string; bytes: Uint8Array }>;
  try {
    distFiles = await readPublishableDistFiles();
  } catch {
    return { ok: false, error: 'dist_missing' };
  }
  if (distFiles.length === 0) return { ok: false, error: 'dist_missing' };

  const indexEntry = distFiles.find((file) => file.relPath === 'index.html');
  if (!indexEntry) return { ok: false, error: 'dist_missing' };

  const playIndex = buildPlayIndexHtml(Buffer.from(indexEntry.bytes).toString('utf8'));
  const publishableProject = await materializeProjectForPublish(repositories, userId, game.project);
  if (!publishableProject) return { ok: false, error: 'cloud_asset_missing' };
  const yamlNormalized = serializeProjectToYaml(publishableProject.project);
  const publishToken = createPublishToken();
  const files: Array<{ path: string; bytes: Uint8Array }> = [
    { path: PAGES_WORKFLOW_PATH, bytes: Buffer.from(buildPagesWorkflowYaml(), 'utf8') },
    { path: 'index.html', bytes: Buffer.from(playIndex, 'utf8') },
    { path: 'game.yaml', bytes: Buffer.from(yamlNormalized, 'utf8') },
    { path: PAGES_PUBLISH_PROBE_PATH, bytes: Buffer.from(buildPublishProbeJson(publishToken), 'utf8') },
  ];

  for (const file of distFiles) {
    if (file.relPath === 'index.html') continue;
    files.push({ path: file.relPath, bytes: file.bytes });
  }
  files.push(...publishableProject.files);

  const commit = await commitFiles({
    accessToken,
    owner: info.login,
    repo: normalizedRepo,
    branch: ensuredRepo.defaultBranch,
    message: `Publish PhaserForge game ${input.gameId} to ${normalizedRepo}`,
    files,
  });
  if (!commit.ok) return { ok: false, error: commit.error, url };

  const deployment = await waitForDeploymentAcceptance(accessToken, info.login, normalizedRepo, commit.commitSha);
  if (!deployment.ok) return { ok: false, error: deployment.error, url };

  return {
    ok: true,
    url,
    repo: normalizedRepo,
    repoCreated: !ensuredRepo.existed,
    deploymentStatus: deployment.deploymentStatus,
    publishToken,
  };
}
