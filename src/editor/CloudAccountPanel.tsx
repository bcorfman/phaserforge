import { type Dispatch, useEffect, useMemo, useRef, useState } from 'react';
import { checkGithubPagesTarget, createGame, disconnectGithub, fetchCsrfToken, getGame, getGithubPagesPublishInfo, listGames, login, logout, me, publishToGithubPages, signup, updateGame } from '../cloud/api';
import { serializeProjectToYaml } from '../model/serialization';
import { PROJECT_LAST_SAVED_AT_STORAGE_KEY, PROJECT_STORAGE_KEY, WORKSPACE_BACKUP_STORAGE_KEY, type EditorAction, type EditorState } from './EditorStore';
import { WorkspaceConflictModal } from './WorkspaceConflictModal';
import { summarizeYamlWorkspace } from './workspaceSummary';

type CloudAccountUser = { id: string; email: string } | null;
type CloudPublishInfo = { ok: true; login: string; pagesBaseUrl: string } | { ok: false; error: string };
type CloudAuthMode = 'login' | 'signup';
export const CLOUD_RETURN_TO_CLOUD_AFTER_AUTH_STORAGE_KEY = 'phaserforge.cloud.return_to_cloud_after_auth';
const CLOUD_ACCOUNT_CREATED_STORAGE_KEY = 'phaserforge.cloud.account_created_v1';
const GITHUB_AUTHORIZED_APPS_SETTINGS_URL = 'https://github.com/settings/connections/applications';

let cachedCloudAccountUser: CloudAccountUser | undefined;
let cachedCloudAccountUserPromise: Promise<CloudAccountUser> | null = null;
const cachedPublishInfoByUserId = new Map<string, CloudPublishInfo>();

export function getCachedCloudAccountUserSnapshot(): CloudAccountUser | undefined {
  return cachedCloudAccountUser;
}

export function resolveCachedCloudAccountUser(): Promise<CloudAccountUser> {
  if (cachedCloudAccountUser !== undefined) return Promise.resolve(cachedCloudAccountUser);
  if (cachedCloudAccountUserPromise) return cachedCloudAccountUserPromise;
  cachedCloudAccountUserPromise = me()
    .then((res) => res.user)
    .catch(() => null)
    .then((user) => {
      cachedCloudAccountUser = user;
      cachedCloudAccountUserPromise = null;
      return user;
    });
  return cachedCloudAccountUserPromise;
}

function setCachedCloudAccountUser(user: CloudAccountUser) {
  cachedCloudAccountUser = user;
  cachedCloudAccountUserPromise = null;
}

export function __resetCloudAccountPanelAuthCacheForTests() {
  cachedCloudAccountUser = undefined;
  cachedCloudAccountUserPromise = null;
  cachedPublishInfoByUserId.clear();
}

function hasCreatedCloudAccount(): boolean {
  try {
    return window.localStorage.getItem(CLOUD_ACCOUNT_CREATED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function getDefaultAuthMode(): CloudAuthMode {
  return hasCreatedCloudAccount() ? 'login' : 'signup';
}

function markCloudAccountCreated() {
  try {
    window.localStorage.setItem(CLOUD_ACCOUNT_CREATED_STORAGE_KEY, '1');
  } catch {
    // Ignore storage failures and fall back to first-time defaults next load.
  }
}

export function buildGithubStartHref(params: {
  apiBaseUrl: string;
  baseUrl: string;
  locationHref?: string;
  forceSwitch?: boolean;
}): string {
  const apiBase = params.apiBaseUrl.trim();
  const baseUrl = params.baseUrl.trim() || '/';
  if (!apiBase) return '/api/v1/auth/github/start?returnTo=/';

  const normalized = apiBase.replace(/\/+$/, '');
  const returnTo = (() => {
    const toPathOnly = (url: URL): string => `${url.pathname}${url.search}${url.hash}` || '/';

    if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
      try {
        return toPathOnly(new URL(baseUrl));
      } catch {
        return '/';
      }
    }

    if (!params.locationHref) {
      const path = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
      return path.startsWith('/') ? path : '/';
    }

    try {
      const resolved = new URL(baseUrl, params.locationHref);
      return toPathOnly(resolved);
    } catch {
      return '/';
    }
  })();

  const forceSwitch = params.forceSwitch ? '&forceSwitch=1' : '';
  return `${normalized}/api/v1/auth/github/start?returnTo=${encodeURIComponent(returnTo)}${forceSwitch}`;
}

function mapGithubAuthError(error: string): string {
  switch (error) {
    case 'github_account_in_use':
      return 'That GitHub account is already linked to a different PhaserForge account.';
    case 'github_already_linked_different_account':
      return 'A different GitHub account is already linked here. Use "Switch GitHub account" if you want to replace it.';
    case 'github_email_unavailable':
      return 'GitHub did not provide a verified primary email for this account.';
    default:
      return error;
  }
}

function mapPublishError(error: string): string {
  switch (error) {
    case 'github_repo_permission_required':
      return 'GitHub denied repository access. Reconnect GitHub and ensure this account can create repositories.';
    case 'github_workflow_permission_required':
      return 'GitHub denied workflow access. Reconnect GitHub to grant workflow permissions, then try again.';
    case 'github_pages_permission_required':
      return 'GitHub denied GitHub Pages management access. Reconnect GitHub and ensure this account can manage GitHub Pages.';
    case 'github_pages_build_failed':
      return 'GitHub Pages deployment failed. Open the target repository Actions tab for details.';
    case 'repo_unavailable':
      return 'That repository name is unavailable. Choose a different repository name.';
    case 'not_found':
      return 'The cloud game record was not found. Save again and retry.';
    default:
      return error;
  }
}

function markReturnToCloudAfterAuth() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CLOUD_RETURN_TO_CLOUD_AFTER_AUTH_STORAGE_KEY, '1');
  } catch {
    // ignore
  }
}

export function CloudAccountPanel({
  state,
  dispatch,
  onLoadYaml,
  onStatus,
  onError,
}: {
  state: Pick<EditorState, 'project'>;
  dispatch: Dispatch<EditorAction>;
  onLoadYaml: (yaml: string, sourceLabel: string) => void;
  onStatus: (message: string) => void;
  onError: (message: string) => void;
}) {
  const LAST_PUBLISH_STORAGE_KEY = 'phaserforge.cloud.last_github_pages_publish_v1';
  const CLOUD_GAME_MAP_STORAGE_KEY = 'phaserforge.cloud.project_game_id_map_v1';
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [user, setUser] = useState<CloudAccountUser>(cachedCloudAccountUser ?? null);
  const [authResolved, setAuthResolved] = useState(cachedCloudAccountUser !== undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [authMode, setAuthMode] = useState<CloudAuthMode>(() => getDefaultAuthMode());
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publishInfo, setPublishInfo] = useState<CloudPublishInfo | null>(
    cachedCloudAccountUser?.id ? cachedPublishInfoByUserId.get(cachedCloudAccountUser.id) ?? null : null,
  );
  const [publishCheck, setPublishCheck] = useState<{
    url: string;
    exists: boolean;
    routeExists: boolean;
    pagesConfigured: boolean;
    deploymentStatus: string | null;
  } | null>(
    null,
  );
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showGithubConfirm, setShowGithubConfirm] = useState<null | { mode: 'connect' | 'switch' }>(null);
  const [lastPublish, setLastPublish] = useState<{ url: string; publishedAtMs: number } | null>(null);
  const [publishBusyLabel, setPublishBusyLabel] = useState<string | null>(null);
  const [publishDeploymentNote, setPublishDeploymentNote] = useState('');
  const [publishInlineError, setPublishInlineError] = useState('');
  const [cloudGameId, setCloudGameId] = useState<string | null>(null);
  const [workspaceConflict, setWorkspaceConflict] = useState<{
    cloud: { yaml: string; updatedAt: string; label: string };
    device: { yaml: string; savedAtMs: number | null; label: string };
  } | null>(null);
  const hasCheckedConflictRef = useRef(false);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const githubEnabled = useMemo(() => true, []);
  const githubStartHref = useMemo(() => {
    const metaEnv = (import.meta as any)?.env as Record<string, unknown> | undefined;
    const apiBase = typeof metaEnv?.VITE_API_BASE_URL === 'string' ? metaEnv.VITE_API_BASE_URL.trim() : '';
    const baseUrl = typeof metaEnv?.BASE_URL === 'string' ? metaEnv.BASE_URL : '/';
    const locationHref = typeof window !== 'undefined' ? window.location.href : undefined;
    return buildGithubStartHref({ apiBaseUrl: apiBase, baseUrl, locationHref });
  }, []);
  const githubSwitchHref = useMemo(() => {
    const metaEnv = (import.meta as any)?.env as Record<string, unknown> | undefined;
    const apiBase = typeof metaEnv?.VITE_API_BASE_URL === 'string' ? metaEnv.VITE_API_BASE_URL.trim() : '';
    const baseUrl = typeof metaEnv?.BASE_URL === 'string' ? metaEnv.BASE_URL : '/';
    const locationHref = typeof window !== 'undefined' ? window.location.href : undefined;
    return buildGithubStartHref({ apiBaseUrl: apiBase, baseUrl, locationHref, forceSwitch: true });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let url: URL;
    try {
      url = new URL(window.location.href);
    } catch {
      return;
    }
    const githubAuthError = url.searchParams.get('githubAuthError');
    if (!githubAuthError) return;
    onError(mapGithubAuthError(githubAuthError));
    url.searchParams.delete('githubAuthError');
    const nextPath = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', nextPath || '/');
  }, [onError]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const raw = window.localStorage.getItem(LAST_PUBLISH_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { url?: unknown; publishedAtMs?: unknown };
          if (typeof parsed.url === 'string' && typeof parsed.publishedAtMs === 'number' && Number.isFinite(parsed.publishedAtMs) && !cancelled) {
            setLastPublish({ url: parsed.url, publishedAtMs: parsed.publishedAtMs });
          }
        }
      } catch {
        // ignore
      }

      try {
        const raw = window.localStorage.getItem(CLOUD_GAME_MAP_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const id = state.project?.id;
          if (id) {
            const mapped = parsed[id];
            if (typeof mapped === 'string' && mapped.length > 0 && !cancelled) setCloudGameId(mapped);
          }
        }
      } catch {
        // ignore
      }

      try {
        const [csrfResult, userResult] = await Promise.allSettled([fetchCsrfToken(), resolveCachedCloudAccountUser()]);
        if (!cancelled && csrfResult.status === 'fulfilled') setCsrfToken(csrfResult.value);
        if (!cancelled) {
          if (userResult.status === 'fulfilled') {
            setUser(userResult.value);
          } else {
            setCachedCloudAccountUser(null);
            setUser(null);
          }
          setAuthResolved(true);
        }
      } catch {
        // ignore
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [state.project?.id]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CLOUD_GAME_MAP_STORAGE_KEY);
      if (!raw) {
        setCloudGameId(null);
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const mapped = parsed[state.project.id];
      setCloudGameId(typeof mapped === 'string' && mapped.length > 0 ? mapped : null);
    } catch {
      setCloudGameId(null);
    }
  }, [state.project.id]);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    if (hasCheckedConflictRef.current) return;
    hasCheckedConflictRef.current = true;

    const readDeviceSnapshot = (): { yaml: string | null; savedAtMs: number | null } => {
      if (typeof window === 'undefined') return { yaml: null, savedAtMs: null };
      let storage: Storage | null = null;
      try {
        storage = window.localStorage;
      } catch {
        storage = null;
      }
      if (!storage) return { yaml: null, savedAtMs: null };
      const yaml = storage.getItem(PROJECT_STORAGE_KEY);
      const savedAtRaw = storage.getItem(PROJECT_LAST_SAVED_AT_STORAGE_KEY);
      const savedAtMs = savedAtRaw != null && savedAtRaw.length > 0 ? Number(savedAtRaw) : NaN;
      return { yaml, savedAtMs: Number.isFinite(savedAtMs) ? savedAtMs : null };
    };

    const formatDeviceLastSaved = (savedAtMs: number | null): string => {
      if (!savedAtMs) return 'Unknown';
      try {
        return new Date(savedAtMs).toLocaleString();
      } catch {
        return 'Unknown';
      }
    };

    const formatCloudLastSaved = (updatedAt: string): string => {
      try {
        const date = new Date(updatedAt);
        if (Number.isNaN(date.getTime())) return updatedAt || 'Unknown';
        return date.toLocaleString();
      } catch {
        return updatedAt || 'Unknown';
      }
    };

    const detectConflict = async () => {
      const device = readDeviceSnapshot();
      if (!device.yaml) return;

      try {
        const res = await listGames();
        const candidates = res.games ?? [];
        if (candidates.length === 0) return;
        const latest = candidates.reduce((best, cur) => {
          const bestMs = Date.parse(best.updated_at);
          const curMs = Date.parse(cur.updated_at);
          if (!Number.isFinite(bestMs)) return cur;
          if (!Number.isFinite(curMs)) return best;
          return curMs > bestMs ? cur : best;
        });
        const full = await getGame(latest.id);
        if (!full?.game?.yaml) return;

        const deviceParsed = summarizeYamlWorkspace(device.yaml);
        const cloudParsed = summarizeYamlWorkspace(full.game.yaml);
        const isEquivalent =
          deviceParsed.ok && cloudParsed.ok ? deviceParsed.canonicalYaml === cloudParsed.canonicalYaml : false;
        if (isEquivalent) return;
        if (cancelled) return;

        setWorkspaceConflict({
          cloud: {
            yaml: full.game.yaml,
            updatedAt: latest.updated_at,
            label: `Cloud (last game: ${latest.title})`,
          },
          device: {
            yaml: device.yaml,
            savedAtMs: device.savedAtMs,
            label: 'This device',
          },
        });
        onStatus(
          `Workspace conflict detected (Cloud: ${formatCloudLastSaved(latest.updated_at)}; Device: ${formatDeviceLastSaved(device.savedAtMs)})`,
        );
      } catch {
        // ignore: conflict UI is best-effort; users can still use manual load/save.
      }
    };

    void detectConflict();
    return () => {
      cancelled = true;
    };
  }, [user, onStatus]);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    const cached = cachedPublishInfoByUserId.get(user.id);
    if (cached) {
      setPublishInfo(cached);
      return;
    }
    const loadPublishInfo = async () => {
      try {
        const info = await getGithubPagesPublishInfo();
        cachedPublishInfoByUserId.set(user.id, info);
        if (!cancelled) setPublishInfo(info);
      } catch {
        const info = { ok: false, error: 'publish_info_failed' } satisfies CloudPublishInfo;
        cachedPublishInfoByUserId.set(user.id, info);
        if (!cancelled) setPublishInfo(info);
      }
    };
    void loadPublishInfo();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const ensurePublishInfo = async (): Promise<CloudPublishInfo> => {
    if (publishInfo) return publishInfo;
    const info = await getGithubPagesPublishInfo();
    if (user?.id) cachedPublishInfoByUserId.set(user.id, info);
    setPublishInfo(info);
    return info;
  };

  const projectTitle = state.project.title ?? '';
  const storedPublishTitle = typeof state.project.publishTitle === 'string' ? state.project.publishTitle : undefined;
  const storedPublishRepo = state.project.publishGithubPagesRepo ?? '';
  const [publishTitleDraft, setPublishTitleDraft] = useState(storedPublishTitle ?? projectTitle);
  const [publishRepoDraft, setPublishRepoDraft] = useState(storedPublishRepo);
  const titleValue = publishTitleDraft;
  const repoValue = publishRepoDraft;
  const publishRoutePreview = publishInfo?.ok ? `${publishInfo.pagesBaseUrl}${repoValue.trim() || '<repo>'}/` : null;
  const publishHelpText = [publishDeploymentNote, publishInlineError]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    setPublishTitleDraft(storedPublishTitle ?? projectTitle);
  }, [projectTitle, storedPublishTitle, state.project.id]);

  useEffect(() => {
    setPublishRepoDraft(storedPublishRepo);
  }, [storedPublishRepo, state.project.id]);

  const persistPublishTitleDraft = () => {
    if (publishTitleDraft === (storedPublishTitle ?? projectTitle)) return;
    dispatch({ type: 'set-project-metadata', publishTitle: publishTitleDraft });
  };

  const persistPublishRepoDraft = () => {
    if (publishRepoDraft === storedPublishRepo) return;
    dispatch({ type: 'set-project-metadata', publishGithubPagesRepo: publishRepoDraft });
  };

  const ensureCsrf = async (options?: { forceRefresh?: boolean }) => {
    if (!options?.forceRefresh && csrfToken) return csrfToken;
    const csrf = await fetchCsrfToken();
    setCsrfToken(csrf);
    return csrf;
  };

  const runWithCsrfRetry = async <T,>(fn: (csrf: string) => Promise<T>): Promise<T> => {
    try {
      return await fn(await ensureCsrf());
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message !== 'csrf_required') throw err;
      return await fn(await ensureCsrf({ forceRefresh: true }));
    }
  };

  const runWithCsrfResultRetry = async <T extends { ok: boolean; error?: string },>(fn: (csrf: string) => Promise<T>): Promise<T> => {
    const first = await fn(await ensureCsrf());
    if (first.ok || first.error !== 'csrf_required') return first;
    return await fn(await ensureCsrf({ forceRefresh: true }));
  };

  const handleSignup = async () => {
    setBusy(true);
    try {
      const res = await runWithCsrfRetry((csrf) => signup(email, password, csrf, inviteToken.trim() || undefined));
      markCloudAccountCreated();
      setCachedCloudAccountUser(res.user);
      setUser(res.user);
      setAuthResolved(true);
      onStatus(`Signed in as ${res.user.email}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Signup failed';
      if (msg === 'invite_required') onError('Invite required to sign up.');
      else if (msg === 'invite_invalid') onError('Invite code is invalid or expired.');
      else onError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async () => {
    setBusy(true);
    try {
      const res = await runWithCsrfRetry((csrf) => login(email, password, csrf));
      setCachedCloudAccountUser(res.user);
      setUser(res.user);
      setAuthResolved(true);
      onStatus(`Signed in as ${res.user.email}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await runWithCsrfRetry((csrf) => logout(csrf));
      setCachedCloudAccountUser(null);
      if (user?.id) cachedPublishInfoByUserId.delete(user.id);
      setUser(null);
      setAuthResolved(true);
      setPublishInfo(null);
      setPublishCheck(null);
      setShowPublishConfirm(false);
      setShowGithubConfirm(null);
      setWorkspaceConflict(null);
      setCloudGameId(null);
      setAuthMode(getDefaultAuthMode());
      hasCheckedConflictRef.current = false;
      onStatus('Signed out');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Logout failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnectGithub = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await runWithCsrfRetry((csrf) => disconnectGithub(csrf));
      const info = { ok: false, error: 'github_not_linked' } satisfies CloudPublishInfo;
      if (user?.id) cachedPublishInfoByUserId.set(user.id, info);
      setPublishInfo(info);
      setPublishCheck(null);
      setShowPublishConfirm(false);
      onStatus('Disconnected GitHub');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to disconnect GitHub');
    } finally {
      setBusy(false);
    }
  };

  const persistCloudGameId = (projectId: string, gameId: string) => {
    try {
      const raw = window.localStorage.getItem(CLOUD_GAME_MAP_STORAGE_KEY);
      const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const next = { ...existing, [projectId]: gameId };
      window.localStorage.setItem(CLOUD_GAME_MAP_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const ensureCloudGameSaved = async (): Promise<string | null> => {
    if (!user) return null;
    const yaml = serializeProjectToYaml(state.project);
    const title = publishTitleDraft.trim() || state.project.title?.trim() || 'Untitled';
    if (cloudGameId) {
      await runWithCsrfRetry((csrf) => updateGame(cloudGameId, { title, yaml }, csrf));
      return cloudGameId;
    }
    const created = await runWithCsrfRetry((csrf) => createGame(title, yaml, csrf));
    const id = created.game.id;
    setCloudGameId(id);
    persistCloudGameId(state.project.id, id);
    return id;
  };

  const handlePublishCheck = async () => {
    const repo = publishRepoDraft.trim();
    if (!repo) {
      const message = 'Enter a repository name to publish (example: zoof)';
      setPublishInlineError(message);
      onError(message);
      return;
    }
    setBusy(true);
    setPublishInlineError('');
    setPublishBusyLabel('Checking repository availability…');
    const info = await ensurePublishInfo();
    if (!info.ok) {
      setBusy(false);
      setPublishBusyLabel(null);
      const message = 'Requires GitHub login to publish.';
      setPublishInlineError(message);
      onError(message);
      return;
    }
    try {
      const check = await runWithCsrfResultRetry((csrf) => checkGithubPagesTarget(repo, csrf));
      if (!check.ok) {
        const message = mapPublishError(check.error);
        setPublishInlineError(message);
        onError(message);
        return;
      }
      setPublishCheck(check);
      setShowPublishConfirm(true);
    } finally {
      setBusy(false);
      setPublishBusyLabel(null);
    }
  };

  const handlePublish = async () => {
    if (!user) return;
    setBusy(true);
    setPublishBusyLabel('Saving project to cloud…');
    setPublishDeploymentNote('');
    setPublishInlineError('');
    try {
      const gameId = await ensureCloudGameSaved();
      if (!gameId) return;
      const repo = publishRepoDraft.trim();
      if (!repo) {
        const message = 'Enter a repository name to publish (example: zoof)';
        setPublishInlineError(message);
        onError(message);
        return;
      }
      setPublishBusyLabel('Uploading files and workflow to GitHub…');
      const result = await runWithCsrfResultRetry((csrf) => publishToGithubPages(gameId, repo, csrf));
      if (!result.ok) {
        const message = mapPublishError(result.error);
        setPublishInlineError(message);
        onError(message);
        return;
      }
      setPublishBusyLabel('Configuring GitHub Pages…');
      setPublishDeploymentNote(
        result.deploymentStatus === 'built'
          ? `Repository ${result.repo} is live at ${result.url}`
          : `GitHub Pages accepted the deployment for ${result.repo}. If the URL is not live yet, wait about a minute and reload.`,
      );
      try {
        const publishedAtMs = Date.now();
        window.localStorage.setItem(LAST_PUBLISH_STORAGE_KEY, JSON.stringify({ url: result.url, publishedAtMs }));
        setLastPublish({ url: result.url, publishedAtMs });
      } catch {
        // ignore
      }
      onStatus(
        result.deploymentStatus === 'built'
          ? `Published ${result.repo} to ${result.url}`
          : `Published ${result.repo} to ${result.url}. GitHub Pages may take about a minute to go live.`,
      );
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } finally {
      setBusy(false);
      setPublishBusyLabel(null);
      setShowPublishConfirm(false);
    }
  };

  return (
    <div className="panel cloud-panel" data-testid="cloud-panel">
      {workspaceConflict ? (
        <WorkspaceConflictModal
          cloud={{
            kind: 'cloud',
            label: workspaceConflict.cloud.label,
            lastSavedLabel: (() => {
              try {
                const date = new Date(workspaceConflict.cloud.updatedAt);
                return Number.isNaN(date.getTime()) ? workspaceConflict.cloud.updatedAt : date.toLocaleString();
              } catch {
                return workspaceConflict.cloud.updatedAt || 'Unknown';
              }
            })(),
            yamlText: workspaceConflict.cloud.yaml,
            parsed: summarizeYamlWorkspace(workspaceConflict.cloud.yaml),
          }}
          device={{
            kind: 'device',
            label: workspaceConflict.device.label,
            lastSavedLabel: (() => {
              const ms = workspaceConflict.device.savedAtMs;
              if (!ms) return 'Unknown';
              try {
                return new Date(ms).toLocaleString();
              } catch {
                return 'Unknown';
              }
            })(),
            yamlText: workspaceConflict.device.yaml,
            parsed: summarizeYamlWorkspace(workspaceConflict.device.yaml),
          }}
          onExportBoth={() => {
            const formatName = (kind: 'cloud' | 'device', time: string) => {
              const safe = time
                .replace(/[:.]/g, '-')
                .replace(/\s+/g, '-')
                .replace(/[^\w-]/g, '')
                .slice(0, 64);
              return `phaserforge-${kind}-${safe || 'workspace'}.yaml`;
            };

            const download = (name: string, text: string) => {
              const blob = new Blob([text], { type: 'application/x-yaml;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = name;
              a.style.display = 'none';
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.setTimeout(() => URL.revokeObjectURL(url), 2500);
            };

            const cloudTime = workspaceConflict.cloud.updatedAt || 'cloud';
            const deviceTime = workspaceConflict.device.savedAtMs ? new Date(workspaceConflict.device.savedAtMs).toISOString() : 'device';
            download(formatName('cloud', cloudTime), workspaceConflict.cloud.yaml);
            download(formatName('device', deviceTime), workspaceConflict.device.yaml);
            onStatus('Exported both YAML snapshots');
          }}
          onChooseCloud={() => {
            try {
              window.localStorage.setItem(WORKSPACE_BACKUP_STORAGE_KEY, workspaceConflict.device.yaml);
            } catch {
              // ignore
            }
            onLoadYaml(workspaceConflict.cloud.yaml, 'cloud:workspace');
            setWorkspaceConflict(null);
            onStatus('Loaded cloud workspace (device backup saved)');
          }}
          onChooseDevice={() => {
            try {
              window.localStorage.setItem(WORKSPACE_BACKUP_STORAGE_KEY, workspaceConflict.cloud.yaml);
            } catch {
              // ignore
            }
            onLoadYaml(workspaceConflict.device.yaml, 'device:workspace');
            setWorkspaceConflict(null);
            onStatus('Kept device workspace (cloud backup saved)');
          }}
          onClose={() => setWorkspaceConflict(null)}
        />
      ) : null}
      {!authResolved ? (
        <>
          <div className="cloud-section-card" data-testid="cloud-account-section">
            <div className="cloud-section-title">ACCOUNT</div>
            <div className="cloud-help" data-testid="cloud-account-loading">
              Checking account…
            </div>
          </div>
          <div className="cloud-section-card" data-testid="cloud-publish-pages-section">
            <div className="cloud-section-title">PUBLISH (GITHUB PAGES)</div>
            <div className="cloud-help">Checking account status before loading publish options.</div>
          </div>
        </>
      ) : !user ? (
        <>
          <div className="cloud-section-card" data-testid="cloud-account-section">
            <div className="cloud-section-title">ACCOUNT</div>
            <div className="cloud-auth">
              <div className="cloud-auth-tabs" role="tablist" aria-label="Cloud account mode">
                <button
                  className={`button ${authMode === 'login' ? 'active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'login'}
                  aria-label="Log in"
                  onClick={() => setAuthMode('login')}
                >
                  Log in
                </button>
                <button
                  className={`button ${authMode === 'signup' ? 'active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'signup'}
                  aria-label="Create"
                  onClick={() => setAuthMode('signup')}
                >
                  Create
                </button>
              </div>
              <div className="cloud-help">
                {authMode === 'login'
                  ? 'Log in to access your cloud projects and publishing tools.'
                  : 'Create your account with your invite code.'}
              </div>
              <label className="field">
                <span>Email</span>
                <input
                  ref={emailInputRef}
                  value={email}
                  aria-label="Email"
                  autoComplete="email"
                  inputMode="email"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Password</span>
                <span className="cloud-password-row">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    aria-label="Password"
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="cloud-password-toggle"
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M2.5 12C4.8 7.6 8.2 5.5 12 5.5C15.8 5.5 19.2 7.6 21.5 12C19.2 16.4 15.8 18.5 12 18.5C8.2 18.5 4.8 16.4 2.5 12Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  </button>
                </span>
              </label>
              {authMode === 'signup' ? (
                <>
                  <label className="field">
                    <span>Invite code</span>
                    <input
                      value={inviteToken}
                      aria-label="Invite code"
                      autoComplete="off"
                      onChange={(e) => setInviteToken(e.target.value)}
                    />
                  </label>
                  <div className="cloud-help">Invite codes are emailed separately and are only required for first-time signup.</div>
                </>
              ) : null}
              <div className="cloud-auth-actions">
                <button
                  className="button primary"
                  type="button"
                  data-testid="cloud-account-submit"
                  disabled={busy}
                  onClick={authMode === 'signup' ? handleSignup : handleLogin}
                >
                  {authMode === 'signup' ? 'Create account' : 'Log in'}
                </button>
              </div>
              <div className="cloud-help">
                {authMode === 'signup' ? (
                  <>
                    Already have an account?{' '}
                    <button className="button button-compact" type="button" disabled={busy} onClick={() => setAuthMode('login')}>
                      Log in
                    </button>
                  </>
                ) : (
                  <>
                    Need an account first?{' '}
                    <button className="button button-compact" type="button" disabled={busy} onClick={() => setAuthMode('signup')}>
                      Create account
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="cloud-section-card" data-testid="cloud-publish-pages-section">
            <div className="cloud-section-title">PUBLISH (GITHUB PAGES)</div>
            <div className="cloud-prereqs" aria-label="Publish prerequisites">
              <span className="cloud-badge">Signed in</span>
              <span className="cloud-badge">GitHub linked</span>
            </div>
            <div className="cloud-row">
              <label className="field">
                <span>Title</span>
                <input
                  value={titleValue}
                  placeholder="My Game"
                  onChange={(e) => setPublishTitleDraft(e.target.value)}
                  onBlur={persistPublishTitleDraft}
                />
              </label>
            </div>
            <div className="cloud-help">Sign in to enable publishing to GitHub Pages.</div>
            <div className="cloud-row">
              <button
                className="button primary"
                type="button"
                data-testid="cloud-publish-signin-cta"
                disabled={busy}
                onClick={() => {
                  const input = emailInputRef.current;
                  if (!input) return;
                  try {
                    input.scrollIntoView({ block: 'nearest' });
                  } catch {
                    // ignore
                  }
                  input.focus();
                }}
              >
                Sign in to publish
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="cloud-section-card" data-testid="cloud-account-section">
            <div className="cloud-section-title">ACCOUNT</div>
            <div className="cloud-signed-in">
              <div className="cloud-row">
                <span className="cloud-user">Signed in</span>
                <span className="mono">{user.email}</span>
                <button className="button button-compact" type="button" disabled={busy} onClick={handleLogout}>
                  Log out
                </button>
              </div>
              <div className="cloud-row">
                <div className="cloud-help" data-testid="cloud-github-connection">
                  {publishInfo == null
                    ? 'GitHub: checking connection…'
                    : publishInfo.ok
                      ? `GitHub: connected as ${publishInfo.login}.`
                      : 'Your account is ready. Connect GitHub to enable publishing.'}
                </div>
                {githubEnabled ? (
                  !publishInfo?.ok ? (
                    <button
                      className="button button-compact"
                      type="button"
                      disabled={busy}
                      aria-label="Connect GitHub"
                      onClick={() => setShowGithubConfirm({ mode: 'connect' })}
                    >
                      Connect GitHub
                    </button>
                  ) : (
                    <>
                      <button
                        className="button button-compact"
                        type="button"
                        disabled={busy}
                        aria-label="Switch GitHub account"
                        onClick={() => setShowGithubConfirm({ mode: 'switch' })}
                      >
                        Switch GitHub…
                      </button>
                      <button className="button button-compact" type="button" disabled={busy} onClick={handleDisconnectGithub}>
                        Disconnect
                      </button>
                    </>
                  )
                ) : null}
              </div>
              <div className="cloud-row">
                <div className="cloud-help">
                  {publishInfo?.ok ? (
                    <>
                      Disconnect only removes the GitHub link from PhaserForge. To revoke GitHub authorization entirely, remove PhaserForge from{' '}
                      <a
                        href={GITHUB_AUTHORIZED_APPS_SETTINGS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="github-authorized-apps-link"
                      >
                        GitHub authorized OAuth apps
                      </a>
                      .
                    </>
                  ) : (
                    'GitHub authorization is required for publishing to GitHub Pages.'
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="cloud-section-card" data-testid="cloud-publish-pages-section">
            <div className="cloud-section-title">PUBLISH (GITHUB PAGES)</div>
            <div className="cloud-prereqs" aria-label="Publish prerequisites">
              <span className="cloud-badge ok">Signed in</span>
              <span className={`cloud-badge ${publishInfo?.ok ? 'ok' : ''}`}>GitHub linked</span>
            </div>
            <div className="cloud-row">
              <label className="field">
                <span>Title</span>
                <input
                  value={titleValue}
                  placeholder="My Game"
                  onChange={(e) => setPublishTitleDraft(e.target.value)}
                  onBlur={persistPublishTitleDraft}
                />
              </label>
            </div>
            {!publishInfo?.ok ? (
              <>
                <div className="cloud-help">
                  {publishInfo == null ? 'Checking GitHub connection…' : 'Connect GitHub to enable publishing to GitHub Pages.'}
                </div>
                <div className="cloud-row">
                  <button
                    className="button primary"
                    type="button"
                    data-testid="cloud-publish-connect-github-cta"
                    disabled={busy || !githubEnabled}
                    onClick={() => setShowGithubConfirm({ mode: 'connect' })}
                  >
                    Connect GitHub to publish
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="cloud-row">
                  <label className="field">
                    <span>Repository</span>
                    <input
                      value={repoValue}
                      placeholder="zoof"
                      onChange={(e) => {
                        setPublishInlineError('');
                        setPublishRepoDraft(e.target.value);
                      }}
                      onBlur={persistPublishRepoDraft}
                      aria-label="Publish repository"
                    />
                  </label>
                  <button
                    className="button primary"
                    type="button"
                    data-testid="cloud-publish-pages-button"
                    disabled={busy || !repoValue.trim()}
                    onClick={() => void handlePublishCheck()}
                  >
                    Publish
                  </button>
                </div>
                <div className="cloud-row">
                  <div className="cloud-help" data-testid="cloud-publish-prereq">
                    Before first publish: your GitHub account must be allowed to create repositories and manage GitHub Pages.
                  </div>
                </div>
                <div className="cloud-row">
                  <div className="cloud-help" data-testid="cloud-publish-pages-target">
                    Publishes to <span className="mono">{publishRoutePreview}</span>
                  </div>
                </div>
                <div className="cloud-row">
                  <div className="cloud-help" data-testid="cloud-publish-pages-help">
                    {publishHelpText}
                  </div>
                </div>
                {publishBusyLabel ? (
                  <div className="cloud-row">
                    <div className="cloud-publish-status" data-testid="cloud-publish-progress" role="status" aria-live="polite">
                      <div className="cloud-publish-progress-bar" aria-hidden="true" />
                      <span>{publishBusyLabel}</span>
                    </div>
                  </div>
                ) : null}
                <div className="cloud-row">
                  <label className="field">
                    <span>Last publish</span>
                    <input
                      value={
                        lastPublish
                          ? (() => {
                              try {
                                return `${new Date(lastPublish.publishedAtMs).toLocaleString()} — ${lastPublish.url}`;
                              } catch {
                                return lastPublish.url;
                              }
                            })()
                          : 'Never published from this device.'
                      }
                      readOnly
                    />
                  </label>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {showPublishConfirm && publishCheck ? (
        <div className="modal-overlay" data-testid="publish-confirm-modal" role="dialog" aria-label="Confirm GitHub Pages publish">
          <div className="modal-card">
            <div className="workspace-conflict-header">
              <div className="workspace-conflict-title">Publish to GitHub Pages</div>
              <button className="button button-compact" type="button" onClick={() => setShowPublishConfirm(false)}>
                Close
              </button>
            </div>
            <div className="cloud-help">
              Target: <span className="mono">{publishCheck.url}</span>
            </div>
            <div className="cloud-help">
              {publishCheck.routeExists
                ? 'Content already exists at this GitHub Pages route. Publishing will overwrite the files currently served there.'
                : publishCheck.exists
                  ? 'This repository already exists. Publishing will update its PhaserForge Pages workflow and site files.'
                  : 'A new repository will be created and configured for GitHub Pages.'}
            </div>
            <div className="cloud-help">
              {publishCheck.pagesConfigured
                ? `GitHub Pages is already configured${publishCheck.deploymentStatus ? ` (${publishCheck.deploymentStatus})` : ''}.`
                : 'GitHub Pages will be configured automatically during publish.'}
            </div>
            {publishBusyLabel ? (
              <div className="cloud-publish-status" data-testid="cloud-publish-progress" role="status" aria-live="polite">
                <div className="cloud-publish-progress-bar" aria-hidden="true" />
                <span>{publishBusyLabel}</span>
              </div>
            ) : null}
            <div className="cloud-row">
              <button className="button" type="button" onClick={() => setShowPublishConfirm(false)}>
                Cancel
              </button>
              <button className="button primary" type="button" data-testid="publish-confirm-submit" disabled={busy} onClick={() => void handlePublish()}>
                {busy ? 'Publishing…' : publishCheck.routeExists ? 'Overwrite route and publish' : publishCheck.exists ? 'Update repository' : 'Create repo and publish'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showGithubConfirm ? (
        <div className="modal-overlay" data-testid="github-connect-modal" role="dialog" aria-label="Confirm GitHub connection">
          <div className="modal-card">
            <div className="workspace-conflict-header">
              <div className="workspace-conflict-title">
                {showGithubConfirm.mode === 'switch' ? 'Switch GitHub account' : 'Connect GitHub'}
              </div>
              <button className="button button-compact" type="button" onClick={() => setShowGithubConfirm(null)}>
                Close
              </button>
            </div>
            {showGithubConfirm.mode === 'switch' ? (
              <>
                <div className="cloud-help">Continue to GitHub to reconnect with the account you want PhaserForge to use for publishing.</div>
                <div className="cloud-help">
                  If you are already signed into the target GitHub account, the switch may complete immediately.
                </div>
                <div className="cloud-help">
                  To switch to a different GitHub account, sign into that account in GitHub first or use a private window.
                </div>
              </>
            ) : (
              <>
                <div className="cloud-help">Continue to GitHub to connect your account.</div>
                <div className="cloud-help">
                  If GitHub already recognizes this authorization, the connection may complete immediately.
                </div>
              </>
            )}
            <div className="cloud-row">
              <button className="button" type="button" onClick={() => setShowGithubConfirm(null)}>
                Cancel
              </button>
              <a
                className="button primary"
                data-testid="github-connect-confirm"
                href={showGithubConfirm.mode === 'switch' ? githubSwitchHref : githubStartHref}
                onClick={() => {
                  markReturnToCloudAfterAuth();
                  setShowGithubConfirm(null);
                }}
              >
                Continue to GitHub
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
