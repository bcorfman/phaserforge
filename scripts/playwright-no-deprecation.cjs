#!/usr/bin/env node

// Node 26 emits DEP0205 when Playwright registers its ESM loader via `module.register()`.
// Suppress deprecation warnings for the Playwright runner process and its worker subprocesses.
process.noDeprecation = true;

const DISABLE_WARN = '--disable-warning=DEP0205';
const existingNodeOptions = process.env.NODE_OPTIONS ?? '';
if (!existingNodeOptions.includes(DISABLE_WARN)) {
  process.env.NODE_OPTIONS = `${existingNodeOptions} ${DISABLE_WARN}`.trim();
}

function hasFlag(flag) {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === flag) return true;
    if (arg.startsWith(`${flag}=`)) return true;
  }
  return false;
}

// Default to running all projects serially to avoid cross-project contention flaking out
// long-running boots/timeouts. Keep per-project runs fast with the default worker count (3).
// Override order:
// - explicit `--workers` wins
// - explicit `--project/--projects` keeps default workers
// - explicit `PW_WORKERS` wins
if (!process.env.PW_WORKERS && !hasFlag('--workers') && !hasFlag('--project') && !hasFlag('--projects')) {
  process.env.PW_WORKERS = '1';
}

// Mirror `@playwright/test/cli.js` behavior.
const { program } = require('playwright/lib/program');
program.parse(process.argv);
