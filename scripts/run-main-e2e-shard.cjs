#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const [, , shardArg, separator, ...extraArgs] = process.argv;

if (!shardArg) {
  console.error('Usage: node scripts/run-main-e2e-shard.cjs <shard> [-- <playwright args...>]');
  process.exit(1);
}

if (separator !== '--') {
  console.error('Expected `--` before additional Playwright args.');
  process.exit(1);
}

const manifestPath = path.join(__dirname, 'main-e2e-shards.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const shardRefs = manifest.shards?.[shardArg];

if (!Array.isArray(shardRefs) || shardRefs.length === 0) {
  console.error(`No shard definition found for shard ${shardArg}.`);
  process.exit(1);
}

const runner = path.join(__dirname, 'playwright-no-deprecation.cjs');
const args = [runner, 'test', '--project=chromium', ...extraArgs, ...shardRefs];

const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
