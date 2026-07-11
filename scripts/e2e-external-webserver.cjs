const net = require('net');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const E2E_VITE_COMMAND = 'npx vite --config vite/config.dev.mjs --host 127.0.0.1 --port 4173';
const E2E_PREVIEW_COMMAND =
  'VITE_E2E_TEST_BRIDGE=1 npm run build-nolog && VITE_E2E_TEST_BRIDGE=1 npx vite preview --config vite/config.prod.mjs --host 127.0.0.1 --port 4173 --strictPort';
const E2E_VITE_HOST = '127.0.0.1';
const E2E_VITE_PORT = 4173;
const E2E_VITE_TIMEOUT_MS = process.env.CI ? 180000 : 120000;
const E2E_PREVIEW_TIMEOUT_MS = process.env.CI ? 240000 : 180000;
const HEALTHCHECK_INTERVAL_MS = 1000;
const HEALTHCHECK_FAILURE_THRESHOLD = 3;

function hasFlag(argv, flag) {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === flag) return true;
    if (arg.startsWith(`${flag}=`)) return true;
  }
  return false;
}

function shouldUseManagedExternalWebServer(argv, env) {
  if (env.PW_EXTERNAL_WEBSERVER === '1') return false;
  if (argv[0] !== 'test') return false;
  if (hasFlag(argv, '--list')) return false;
  return true;
}

function resolveManagedExternalWebServerOptions(argv, env) {
  const mode = env.PW_E2E_SERVER_MODE === 'dev' || hasFlag(argv, '--ui') ? 'dev' : 'preview';
  const logDir =
    env.PW_E2E_SERVER_LOG_DIR || path.join(process.cwd(), '.playwright-e2e-server', `${mode}-latest`);
  return {
    mode,
    command: mode === 'dev' ? E2E_VITE_COMMAND : E2E_PREVIEW_COMMAND,
    host: E2E_VITE_HOST,
    port: E2E_VITE_PORT,
    timeoutMs: mode === 'dev' ? E2E_VITE_TIMEOUT_MS : E2E_PREVIEW_TIMEOUT_MS,
    logDir,
  };
}

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(host, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(host, port)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
}

async function waitForManagedServerReadiness({ host, port, timeoutMs, child, logDir }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode != null || child.signalCode != null) {
      throw createManagedServerError(
        `Managed E2E web server exited before ready (code=${child.exitCode ?? 'null'}, signal=${child.signalCode ?? 'null'})`,
        logDir,
      );
    }
    if (await isPortOpen(host, port)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (child.exitCode != null || child.signalCode != null) {
    throw createManagedServerError(
      `Managed E2E web server exited before ready (code=${child.exitCode ?? 'null'}, signal=${child.signalCode ?? 'null'})`,
      logDir,
    );
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
}

async function ensureCleanLogDir(logDir) {
  await fsp.rm(logDir, { recursive: true, force: true });
  await fsp.mkdir(logDir, { recursive: true });
}

function createLifecycleTracker({ command, host, port, logDir }) {
  const lifecyclePath = path.join(logDir, 'lifecycle.json');
  let persistChain = Promise.resolve();
  const state = {
    command,
    host,
    port,
    startedAt: new Date().toISOString(),
    pid: null,
    readyAt: null,
    exit: null,
    healthcheck: {
      intervalMs: HEALTHCHECK_INTERVAL_MS,
      failureThreshold: HEALTHCHECK_FAILURE_THRESHOLD,
      failures: [],
      status: 'starting',
    },
  };

  const persist = async () => {
    const nextPersist = persistChain.then(async () => {
      const tempPath = `${lifecyclePath}.tmp`;
      await fsp.writeFile(tempPath, JSON.stringify(state, null, 2));
      await fsp.rename(tempPath, lifecyclePath);
    });
    persistChain = nextPersist.catch(() => {});
    await nextPersist;
  };

  return {
    lifecyclePath,
    state,
    async init() {
      await persist();
    },
    async markPid(pid) {
      state.pid = pid;
      await persist();
    },
    async markReady() {
      state.readyAt = new Date().toISOString();
      state.healthcheck.status = 'healthy';
      await persist();
    },
    async markProbeFailure(message) {
      state.healthcheck.failures.push({ at: new Date().toISOString(), message });
      state.healthcheck.status = 'degraded';
      await persist();
    },
    async markHealthy() {
      state.healthcheck.status = 'healthy';
      await persist();
    },
    async markExit(code, signal) {
      state.exit = {
        at: new Date().toISOString(),
        code,
        signal,
      };
      state.healthcheck.status = state.healthcheck.status === 'failed' ? 'failed' : 'stopped';
      await persist();
    },
    async markFailed(message) {
      state.healthcheck.status = 'failed';
      state.healthcheck.failureMessage = message;
      await persist();
    },
    waitForPendingWrites() {
      return persistChain;
    },
  };
}

function createManagedServerError(message, logDir) {
  return new Error(`${message}. Managed server logs: ${logDir}`);
}

async function startManagedExternalWebServer({
  command = E2E_VITE_COMMAND,
  host = E2E_VITE_HOST,
  port = E2E_VITE_PORT,
  timeoutMs = E2E_VITE_TIMEOUT_MS,
  logDir = path.join(process.cwd(), '.playwright-e2e-server', 'preview-latest'),
} = {}) {
  await ensureCleanLogDir(logDir);
  const stdoutPath = path.join(logDir, 'stdout.log');
  const stderrPath = path.join(logDir, 'stderr.log');
  const stdout = fs.createWriteStream(stdoutPath, { flags: 'a' });
  const stderr = fs.createWriteStream(stderrPath, { flags: 'a' });
  const lifecycle = createLifecycleTracker({ command, host, port, logDir });
  await lifecycle.init();

  const child = spawn(command, {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  await lifecycle.markPid(child.pid ?? null);
  child.stdout?.pipe(stdout);
  child.stderr?.pipe(stderr);

  let settled = false;
  let healthcheckTimer;
  let consecutiveProbeFailures = 0;
  let rejectUnexpectedExit;
  let exitPersistPromise = Promise.resolve();
  let exitRecorded = false;
  const unexpectedExit = new Promise((_, reject) => {
    rejectUnexpectedExit = reject;
  });

  const recordExit = (code, signal) => {
    if (exitRecorded) return exitPersistPromise;
    exitRecorded = true;
    exitPersistPromise = lifecycle.markExit(code ?? null, signal ?? null);
    return exitPersistPromise;
  };

  const cleanup = () => {
    settled = true;
    if (healthcheckTimer) clearInterval(healthcheckTimer);
    if (child.exitCode != null || child.signalCode != null) return;
    try {
      if (process.platform === 'win32') {
        child.kill('SIGTERM');
      } else {
        process.kill(-child.pid, 'SIGTERM');
      }
    } catch {
      // Ignore cleanup errors.
    }
  };

  child.once('exit', (code, signal) => {
    const phase = lifecycle.state.readyAt ? 'during the Playwright run' : 'before ready';
    const exitError = createManagedServerError(
      `Managed E2E web server exited ${phase} (code=${code ?? 'null'}, signal=${signal ?? 'null'})`,
      logDir,
    );
    recordExit(code, signal);
    rejectUnexpectedExit(exitError);
    stdout.end();
    stderr.end();
  });

  try {
    await Promise.race([
      waitForManagedServerReadiness({ host, port, timeoutMs, child, logDir }),
      unexpectedExit,
    ]);
  } catch (error) {
    if (child.exitCode != null || child.signalCode != null) {
      await recordExit(child.exitCode, child.signalCode);
    }
    cleanup();
    await exitPersistPromise;
    await lifecycle.waitForPendingWrites();
    throw error;
  }

  await lifecycle.markReady();
  console.error(`[e2e-server] mode ready at http://${host}:${port} | logs: ${logDir}`);

  healthcheckTimer = setInterval(async () => {
    if (settled) return;
    const isOpen = await isPortOpen(host, port);
    if (isOpen) {
      consecutiveProbeFailures = 0;
      if (lifecycle.state.healthcheck.status !== 'healthy') {
        await lifecycle.markHealthy();
      }
      return;
    }
    consecutiveProbeFailures += 1;
    await lifecycle.markProbeFailure(`Health probe failed (${consecutiveProbeFailures}/${HEALTHCHECK_FAILURE_THRESHOLD})`);
    if (consecutiveProbeFailures < HEALTHCHECK_FAILURE_THRESHOLD) return;
    settled = true;
    const error = createManagedServerError(
      `Managed E2E web server became unreachable after readiness on ${host}:${port}`,
      logDir,
    );
    await lifecycle.markFailed(error.message);
    cleanup();
    rejectUnexpectedExit(error);
  }, HEALTHCHECK_INTERVAL_MS);

  return {
    cleanup,
    logDir,
    onUnexpectedExit: unexpectedExit,
  };
}

module.exports = {
  E2E_VITE_COMMAND,
  E2E_PREVIEW_COMMAND,
  E2E_VITE_HOST,
  E2E_VITE_PORT,
  shouldUseManagedExternalWebServer,
  resolveManagedExternalWebServerOptions,
  startManagedExternalWebServer,
};
