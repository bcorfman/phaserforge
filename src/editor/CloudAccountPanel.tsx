import { useEffect, useMemo, useState } from 'react';
import { createGame, fetchCsrfToken, getGame, listGames, login, logout, me, signup, updateGame } from '../cloud/api';
import { serializeProjectToYaml } from '../model/serialization';
import type { EditorState } from './EditorStore';

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
  const [showPassword, setShowPassword] = useState(false);
  const [games, setGames] = useState<Array<{ id: string; title: string; updated_at: string }>>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [newTitle, setNewTitle] = useState<string>('My Game');
  const [busy, setBusy] = useState(false);

  const githubEnabled = useMemo(() => true, []);

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
      const res = await signup(email, password, csrf);
      setUser(res.user);
      onStatus(`Signed in as ${res.user.email}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Signup failed');
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

  return (
    <div className="panel cloud-panel" data-testid="cloud-panel">
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
          <div className="cloud-auth-actions">
            <button className="button" type="button" disabled={busy} onClick={handleSignup}>
              Sign up
            </button>
            <button className="button" type="button" disabled={busy} onClick={handleLogin}>
              Log in
            </button>
          </div>
          {githubEnabled && (
            <a className="button cloud-github-button" href="/api/v1/auth/github/start?returnTo=/" aria-label="Log in with GitHub">
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
        </div>
      )}
    </div>
  );
}
