#!/usr/bin/env node

// Node 26 emits DEP0205 when Playwright registers its ESM loader via `module.register()`.
// Suppress deprecation warnings for the Playwright runner process and its worker subprocesses.
process.noDeprecation = true;

const DISABLE_WARN = '--disable-warning=DEP0205';
const existingNodeOptions = process.env.NODE_OPTIONS ?? '';
if (!existingNodeOptions.includes(DISABLE_WARN)) {
  process.env.NODE_OPTIONS = `${existingNodeOptions} ${DISABLE_WARN}`.trim();
}

// Mirror `@playwright/test/cli.js` behavior.
const { program } = require('playwright/lib/program');
program.parse(process.argv);
