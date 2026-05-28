import { useEffect, useMemo, useRef, useState } from 'react';
import { checkGithubPagesTarget, createGame, fetchCsrfToken, getGame, getGithubPagesPublishInfo, listGames, login, logout, me, publishToGithubPages, signup, updateGame } from '../cloud/api';
import { serializeProjectToYaml } from '../model/serialization';
import { PROJECT_LAST_SAVED_AT_STORAGE_KEY, PROJECT_STORAGE_KEY, WORKSPACE_BACKUP_STORAGE_KEY, type EditorState } from './EditorStore';
import { WorkspaceConflictModal } from './WorkspaceConflictModal';
import { summarizeYamlWorkspace } from './workspaceSummary';

export function CloudAccountPanel({
  state,
  onLoadYaml,
  onStatus,
  onError,
}: {
  state: Pick<EditorState, 'project'>;
  onLoadYaml: (yaml: string, sourceLabel: string) => void;
  onStatus: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [games, setGames] = useState<Array<{ id: string; title: string; updated_at: string }>>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [newTitle, setNewTitle] = useState<string>('My Game');
  const [busy, setBusy] = useState(false);
  const [publishRoute, setPublishRoute] = useState('');
  const [publishInfo, setPublishInfo] = useState<{ ok: true; login: string; pagesBaseUrl: string; repo: string } | { ok: false; error: string } | null>(null);
  const [publishCheck, setPublishCheck] = useState<{ url: string; exists: boolean; status: number | null } | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [workspaceConflict, setWorkspaceConflict] = useState<{
    cloud: { yaml: string; updatedAt: string; label: string };
    device: { yaml: string; savedAtMs: number | null; label: string };
  } | null>(null);
  const hasCheckedConflictRef = useRef(false);

  const githubEnabled = useMemo(() => true, []);
  const githubStartHref = useMemo(() => {
    const metaEnv = (import.meta as any)?.env as Record<string, unknown> | undefined;
    const apiBase = typeof metaEnv?.VITE_API_BASE_URL === 'string' ? metaEnv.VITE_API_BASE_URL.trim() : '';
    const baseUrl = typeof metaEnv?.BASE_URL === 'string' ? metaEnv.BASE_URL : '/';
    if (!apiBase) return '/api/v1/auth/github/start?returnTo=/';
    const normalized = apiBase.replace(/\/+$/, '');
    return `${normalized}/api/v1/auth/github/start?returnTo=${encodeURIComponent(baseUrl)}`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const csrf = await fetchCsrfToken();
        if (!cancelled) setCsrfToken(csrf);
      } catch {
        // ignore
      }

      try {
        const res = await me();
        if (!cancelled) setUser(res.user);
      } catch {
        // ignore
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

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
    const load = async () => {
      try {
        const res = await listGames();
        if (!cancelled) setGames(res.games.map((g) => ({ id: g.id, title: g.title, updated_at: g.updated_at })));
      } catch (err) {
        if (!cancelled) onError(err instanceof Error ? err.message : 'Failed to load cloud games');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, onError]);

  const ensurePublishInfo = async (): Promise<{ ok: true; login: string; pagesBaseUrl: string; repo: string } | { ok: false; error: string }> => {
    if (publishInfo) return publishInfo;
    const info = await getGithubPagesPublishInfo();
    setPublishInfo(info);
    return info;
  };

  const projectHasPathAssets = useMemo(() => {
    const assets = state.project.assets;
    const audio = state.project.audio;
    const anyPath =
      Object.values(assets.images).some((a) => (a as any)?.source?.kind === 'path') ||
      Object.values(assets.spriteSheets).some((a) => (a as any)?.source?.kind === 'path') ||
      Object.values(assets.fonts).some((a) => (a as any)?.source?.kind === 'path') ||
      Object.values(audio.sounds).some((a) => (a as any)?.source?.kind === 'path');
    return anyPath;
  }, [state.project]);

  const ensureCsrf = async () => {
    if (csrfToken) return csrfToken;
    const csrf = await fetchCsrfToken();
    setCsrfToken(csrf);
    return csrf;
  };

  const handleSignup = async () => {
    setBusy(true);
    try {
      const csrf = await ensureCsrf();
      const res = await signup(email, password, csrf, inviteToken.trim() || undefined);
      setUser(res.user);
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
      const csrf = await ensureCsrf();
      const res = await login(email, password, csrf);
      setUser(res.user);
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
      const csrf = await ensureCsrf();
      await logout(csrf);
      setUser(null);
      setGames([]);
      setSelectedGameId('');
      setPublishInfo(null);
      setPublishCheck(null);
      setShowPublishConfirm(false);
      setWorkspaceConflict(null);
      hasCheckedConflictRef.current = false;
      onStatus('Signed out');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Logout failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshGames = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const res = await listGames();
      setGames(res.games.map((g) => ({ id: g.id, title: g.title, updated_at: g.updated_at })));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to refresh games');
    } finally {
      setBusy(false);
    }
  };

  const handleLoadSelected = async () => {
    if (!selectedGameId) return;
    setBusy(true);
    try {
      const res = await getGame(selectedGameId);
      onLoadYaml(res.game.yaml, `cloud:${res.game.title}`);
      onStatus(`Loaded ${res.game.title}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const yaml = serializeProjectToYaml(state.project);
      const csrf = await ensureCsrf();
      if (selectedGameId) {
        await updateGame(selectedGameId, { title: newTitle.trim() || undefined, yaml }, csrf);
        onStatus('Saved to cloud');
      } else {
        const created = await createGame(newTitle.trim() || 'Untitled', yaml, csrf);
        setSelectedGameId(created.game.id);
        onStatus('Created in cloud');
      }
      await handleRefreshGames();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save game');
    } finally {
      setBusy(false);
    }
  };

  const handlePublishCheck = async () => {
    if (!selectedGameId) return;
    if (!publishRoute.trim()) {
      onError('Enter a route to publish (example: mygame)');
      return;
    }
    const info = await ensurePublishInfo();
    if (!info.ok) {
      onError('Requires GitHub login to publish.');
      return;
    }
    const check = await checkGithubPagesTarget(publishRoute.trim());
    if (!check.ok) {
      onError(check.error);
      return;
    }
    setPublishCheck({ url: check.url, exists: check.exists, status: check.status });
    if (check.exists) setShowPublishConfirm(true);
    else setShowPublishConfirm(true);
  };

  const handlePublish = async (allowOverwrite: boolean) => {
    if (!user) return;
    if (!selectedGameId) return;
    setBusy(true);
    try {
      const csrf = await ensureCsrf();
      const result = await publishToGithubPages(selectedGameId, publishRoute.trim(), csrf, { ...(allowOverwrite ? { allowOverwrite: true } : {}) });
      if (!result.ok) {
        if (result.error === 'target_exists') {
          onError('That GitHub Pages URL already exists. Choose a different route or confirm overwrite.');
        } else if (result.error === 'path_assets_unsupported') {
          onError('Publishing requires embedded assets only. Convert path assets to embedded before publishing.');
        } else {
          onError(result.error);
        }
        return;
      }
      onStatus(`Published to ${result.url}`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } finally {
      setBusy(false);
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
      {!user ? (
        <div className="cloud-auth">
          <label className="field">
            <span>Email</span>
            <input value={email} autoComplete="email" inputMode="email" onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <span className="cloud-password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                autoComplete="current-password"
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
          <label className="field">
            <span>Invite code</span>
            <input value={inviteToken} autoComplete="off" onChange={(e) => setInviteToken(e.target.value)} />
          </label>
          <div className="cloud-auth-actions">
            <button className="button" type="button" disabled={busy} onClick={handleSignup}>
              Sign up
            </button>
            <button className="button" type="button" disabled={busy} onClick={handleLogin}>
              Log in
            </button>
          </div>
          {githubEnabled && (
            <a className="button cloud-github-button" href={githubStartHref} aria-label="Log in with GitHub">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2.5C6.75 2.5 2.5 6.75 2.5 12C2.5 16.3 5.37 19.92 9.33 21.22C9.8 21.31 9.98 21.02 9.98 20.78V19.1C7.33 19.68 6.77 18.03 6.77 18.03C6.33 16.93 5.68 16.64 5.68 16.64C4.8 16.05 5.75 16.06 5.75 16.06C6.72 16.13 7.23 17.06 7.23 17.06C8.08 18.52 9.49 18.1 10.05 17.85C10.14 17.22 10.39 16.79 10.67 16.54C8.55 16.3 6.33 15.48 6.33 11.5C6.33 10.36 6.73 9.43 7.4 8.7C7.29 8.46 6.94 7.5 7.5 6.2C7.5 6.2 8.35 5.93 9.98 7.03C10.78 6.81 11.64 6.7 12.5 6.7C13.36 6.7 14.22 6.81 15.02 7.03C16.65 5.93 17.5 6.2 17.5 6.2C18.06 7.5 17.71 8.46 17.6 8.7C18.27 9.43 18.67 10.36 18.67 11.5C18.67 15.49 16.44 16.29 14.31 16.53C14.67 16.85 15 17.48 15 18.45V20.78C15 21.02 15.18 21.32 15.66 21.22C19.63 19.92 22.5 16.3 22.5 12C22.5 6.75 18.25 2.5 13 2.5H12Z"
                  fill="currentColor"
                />
              </svg>
              Login with GitHub
            </a>
          )}
        </div>
      ) : (
        <div className="cloud-signed-in">
          <div className="cloud-row">
            <span className="cloud-user">Signed in: {user.email}</span>
            <button className="button button-compact" type="button" disabled={busy} onClick={handleLogout}>
              Log out
            </button>
          </div>
          <div className="cloud-row">
            <label className="field">
              <span>Game</span>
              <select value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}>
                <option value="">(New)</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-compact" type="button" disabled={busy || !selectedGameId} onClick={handleLoadSelected}>
              Load
            </button>
            <a
              className={`button button-compact ${!selectedGameId ? 'disabled' : ''}`}
              data-testid="cloud-launch-button"
              href={selectedGameId ? `?playGameId=${encodeURIComponent(selectedGameId)}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!selectedGameId}
              onClick={(e) => {
                if (!selectedGameId) e.preventDefault();
              }}
            >
              Launch
            </a>
          </div>
          <div className="cloud-row">
            <label className="field">
              <span>Title</span>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </label>
            <button className="button button-compact" type="button" disabled={busy} onClick={handleSave}>
              Save
            </button>
          </div>

          <div className="cloud-row">
            <label className="field">
              <span>Publish route</span>
              <input
                value={publishRoute}
                placeholder="mygame"
                onChange={(e) => setPublishRoute(e.target.value)}
                aria-label="Publish route"
              />
            </label>
            <button
              className="button button-compact"
              type="button"
              data-testid="cloud-publish-pages-button"
              disabled={
                busy ||
                !selectedGameId ||
                !publishRoute.trim() ||
                !publishInfo ||
                !publishInfo.ok ||
                projectHasPathAssets
              }
              onClick={() => void handlePublishCheck()}
            >
              Publish to GitHub Pages
            </button>
          </div>
          <div className="cloud-row">
            <div className="cloud-help" data-testid="cloud-publish-pages-help">
              {publishInfo?.ok
                ? `Publishes to https://${publishInfo.login}.github.io/<route>/ (public repo: ${publishInfo.repo}). Embedded assets only.`
                : 'Publishes to https://<username>.github.io/<route>/ (public repo: username/username.github.io). Requires GitHub login. Embedded assets only.'}
              {projectHasPathAssets ? ' Path assets detected; publishing is disabled.' : ''}
            </div>
          </div>
        </div>
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
              {publishCheck.exists
                ? `A page already exists at this URL (HTTP ${publishCheck.status ?? 'unknown'}). Publishing may overwrite it.`
                : 'No existing page detected at this URL.'}
            </div>
            <div className="cloud-row">
              <button className="button" type="button" onClick={() => setShowPublishConfirm(false)}>
                Cancel
              </button>
              <button className="button primary" type="button" data-testid="publish-confirm-submit" disabled={busy} onClick={() => void handlePublish(Boolean(publishCheck.exists))}>
                {publishCheck.exists ? 'Publish anyway' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
