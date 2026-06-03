const net = require('net');
const { spawn } = require('child_process');

const E2E_VITE_COMMAND = 'npx vite --config vite/config.dev.mjs --host 127.0.0.1 --port 4173';
const E2E_VITE_HOST = '127.0.0.1';
const E2E_VITE_PORT = 4173;
const E2E_VITE_TIMEOUT_MS = process.env.CI ? 180000 : 120000;

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

async function startManagedExternalWebServer({
  command = E2E_VITE_COMMAND,
  host = E2E_VITE_HOST,
  port = E2E_VITE_PORT,
  timeoutMs = E2E_VITE_TIMEOUT_MS,
} = {}) {
  const child = spawn(command, {
    shell: true,
    stdio: 'ignore',
    detached: process.platform !== 'win32',
  });

  const cleanup = () => {
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

  const earlyExit = new Promise((_, reject) => {
    child.once('exit', (code, signal) => {
      reject(new Error(`Managed E2E web server exited before ready (code=${code ?? 'null'}, signal=${signal ?? 'null'})`));
    });
  });

  try {
    await Promise.race([waitForPort(host, port, timeoutMs), earlyExit]);
  } catch (error) {
    cleanup();
    throw error;
  }

  return { cleanup };
}

module.exports = {
  E2E_VITE_COMMAND,
  E2E_VITE_HOST,
  E2E_VITE_PORT,
  shouldUseManagedExternalWebServer,
  startManagedExternalWebServer,
};
