import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { Repositories } from '../types';

type Ok<T> = T & { ok: true };
type Err<E extends string> = { ok: false; error: E; url?: string };

function normalizeRoute(route: string): string {
  return route.replace(/^\/+/, '').replace(/\/+$/, '');
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

function pagesUrlFor(login: string, route: string): string {
  const base = `https://${login}.github.io/`;
  const r = normalizeRoute(route);
  return r ? new URL(`${r.replace(/\/+$/, '')}/`, base).toString() : base;
}

function projectHasPathAssets(yamlText: string): boolean {
  try {
    const parsed = parseYaml(yamlText) as any;
    const images = parsed?.assets?.images ?? {};
    const spriteSheets = parsed?.assets?.spriteSheets ?? {};
    const fonts = parsed?.assets?.fonts ?? {};
    const sounds = parsed?.audio?.sounds ?? {};
    const all = [images, spriteSheets, fonts, sounds];
    for (const bucket of all) {
      if (!bucket || typeof bucket !== 'object') continue;
      for (const spec of Object.values(bucket as Record<string, any>)) {
        const source = (spec as any)?.source;
        if (source && typeof source === 'object' && (source as any).kind === 'path') return true;
      }
    }
    return false;
  } catch {
    // If YAML is malformed, publishing should fail earlier anyway; treat as unsafe.
    return true;
  }
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
  // Ensure PlayApp loads without query params on GH Pages.
  const meta = `<meta name="phaserforge-mode" content="play" />`;
  const boot = `<script>window.__PHASER_FORGE_PLAY_YAML_URL = './game.yaml';</script>`;
  if (distIndexHtml.includes('name="phaserforge-mode"')) return distIndexHtml;
  return distIndexHtml.replace('</title>', `</title>\n  ${meta}\n  ${boot}`);
}

async function putContentFile(params: {
  accessToken: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  message: string;
  bytes: Uint8Array;
}) {
  const url = `https://api.github.com/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/contents/${params.path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

  // Fetch sha if file exists
  const existing = await githubApi<{ sha?: string }>(params.accessToken, `${url}?ref=${encodeURIComponent(params.branch)}`);
  const sha = existing.ok ? existing.json.sha : undefined;

  const body = {
    message: params.message,
    content: Buffer.from(params.bytes).toString('base64'),
    branch: params.branch,
    ...(sha ? { sha } : {}),
  };

  const res = await githubApi<any>(params.accessToken, url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`github_put_failed_${res.status}`);
}

export async function publishInfo(
  repositories: Repositories,
  userId: string,
): Promise<Ok<{ login: string; pagesBaseUrl: string; repo: string }> | Err<'github_not_linked' | 'github_token_missing'>> {
  const oauth = await repositories.oauth.findByUserIdProvider(userId, 'github');
  if (!oauth) return { ok: false, error: 'github_not_linked' };
  const login = oauth.providerLogin ?? '';
  if (!login) return { ok: false, error: 'github_not_linked' };
  const token = oauth.accessToken ?? '';
  if (!token) return { ok: false, error: 'github_token_missing' };
  return { ok: true, login, pagesBaseUrl: `https://${login}.github.io/`, repo: `${login}/${login}.github.io` };
}

export async function checkGithubPagesTarget(
  repositories: Repositories,
  userId: string,
  route: string,
): Promise<Ok<{ url: string; exists: boolean; status: number | null }> | Err<'github_not_linked' | 'github_token_missing'>> {
  const info = await publishInfo(repositories, userId);
  if (!info.ok) return info;
  const url = pagesUrlFor(info.login, route);
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (res.status === 404) return { ok: true, url, exists: false, status: 404 };
    return { ok: true, url, exists: true, status: res.status };
  } catch {
    return { ok: true, url, exists: false, status: null };
  }
}

export async function publishGameToGithubPages(
  repositories: Repositories,
  userId: string,
  input: { gameId: string; route: string; allowOverwrite?: boolean },
): Promise<Ok<{ url: string }> | Err<'github_not_linked' | 'github_token_missing' | 'target_exists' | 'not_found' | 'path_assets_unsupported' | 'dist_missing' | 'github_failed'>> {
  const info = await publishInfo(repositories, userId);
  if (!info.ok) return info;
  const route = normalizeRoute(input.route);
  const url = pagesUrlFor(info.login, route);

  const check = await checkGithubPagesTarget(repositories, userId, route);
  if (!check.ok) return check;
  if (check.exists && !input.allowOverwrite) return { ok: false, error: 'target_exists', url };

  const game = await repositories.games.findByIdForUser(input.gameId, userId);
  if (!game) return { ok: false, error: 'not_found' };
  if (projectHasPathAssets(game.yaml)) return { ok: false, error: 'path_assets_unsupported' };

  const token = info.ok ? (await repositories.oauth.findByUserIdProvider(userId, 'github'))?.accessToken ?? '' : '';
  if (!token) return { ok: false, error: 'github_token_missing' };

  const owner = info.login;
  const repo = `${info.login}.github.io`;
  const branch = 'main';

  // Ensure repo exists (create if missing)
  try {
    const repoRes = await githubApi<any>(token, `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    if (!repoRes.ok && repoRes.status === 404) {
      const created = await githubApi<any>(token, 'https://api.github.com/user/repos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: repo, private: false, auto_init: true }),
      });
      if (!created.ok) return { ok: false, error: 'github_failed', url };
    } else if (!repoRes.ok) {
      return { ok: false, error: 'github_failed', url };
    }
  } catch {
    return { ok: false, error: 'github_failed', url };
  }

  let distFiles: Array<{ relPath: string; bytes: Uint8Array }>;
  try {
    distFiles = await readPublishableDistFiles();
  } catch {
    return { ok: false, error: 'dist_missing' };
  }
  if (distFiles.length === 0) return { ok: false, error: 'dist_missing' };

  const indexEntry = distFiles.find((f) => f.relPath === 'index.html');
  if (!indexEntry) return { ok: false, error: 'dist_missing' };
  const distIndexHtml = Buffer.from(indexEntry.bytes).toString('utf8');
  const playIndex = buildPlayIndexHtml(distIndexHtml);

  const publishPrefix = route ? `${route}/` : '';
  const message = `Publish PhaserForge game ${input.gameId} to ${route || '/'} (play-only)`;

  try {
    // index.html (play-only wrapper)
    await putContentFile({
      accessToken: token,
      owner,
      repo,
      branch,
      path: `${publishPrefix}index.html`,
      message,
      bytes: Buffer.from(playIndex, 'utf8'),
    });

    // game.yaml
    const yamlNormalized = stringifyYaml(parseYaml(game.yaml));
    await putContentFile({
      accessToken: token,
      owner,
      repo,
      branch,
      path: `${publishPrefix}game.yaml`,
      message,
      bytes: Buffer.from(yamlNormalized, 'utf8'),
    });

    // assets + static support files
    for (const file of distFiles) {
      if (file.relPath === 'index.html') continue;
      const outPath = `${publishPrefix}${file.relPath}`;
      await putContentFile({
        accessToken: token,
        owner,
        repo,
        branch,
        path: outPath,
        message,
        bytes: file.bytes,
      });
    }
  } catch {
    return { ok: false, error: 'github_failed', url };
  }

  return { ok: true, url };
}

