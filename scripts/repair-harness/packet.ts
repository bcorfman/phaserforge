import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { redactSecrets } from './artifacts';
import type { EvidenceEnvelope, RepairDiagnosis } from './types';

export interface PacketOptions {
  repo: string;
  evidence: EvidenceEnvelope;
  diff?: string;
  targetedFiles?: string[];
  diagnosis?: RepairDiagnosis;
  maxDiffChars?: number;
}

function readIfPresent(repo: string, file: string): string {
  try { return readFileSync(path.join(repo, file), 'utf8'); } catch { return ''; }
}

function stableGuidance(repo: string): string {
  return ['AGENTS.md', '.repo-memory/product-memory.md', '.repo-memory/regression-playbook.md']
    .map((file) => `## ${file}\n${readIfPresent(repo, file).trim()}`)
    .join('\n\n');
}

function evidenceSection(evidence: EvidenceEnvelope): string {
  return [
    `- Workflow: ${evidence.workflow}`,
    `- Job: ${evidence.job}`,
    `- Scope: ${evidence.scope}`,
    `- Failure class: ${evidence.failure.class}`,
    `- Test: ${evidence.failure.testFile ?? 'not identified'}${evidence.failure.testTitle ? ` — ${evidence.failure.testTitle}` : ''}`,
    `- Message: ${evidence.failure.message}`,
    `- Reproduction: \`${evidence.reproduction.command}\``,
    `- Stack excerpt:\n\n${evidence.failure.stackExcerpt}`,
  ].join('\n');
}

export function createDiagnosisPacket(options: PacketOptions): string {
  const files = options.targetedFiles ?? [options.evidence.failure.testFile].filter((file): file is string => Boolean(file));
  return redactSecrets([
    '# PhaserForge CI repair diagnosis',
    'Return JSON only with keys: failureClass, likelyCause, files, symbols, reproductionCommand, confidence.',
    'Do not edit files, run commands, change CI, skip tests, or propose infrastructure repair.',
    '', '## Stable repository guidance', stableGuidance(options.repo),
    '', '## Failure evidence', evidenceSection(options.evidence),
    '', `## Targeted files\n${files.length ? files.map((file) => `- ${file}`).join('\n') : '- None identified'}`,
  ].join('\n'));
}

export function createImplementationPacket(options: PacketOptions): string {
  if (!options.diagnosis) throw new Error('Implementation packets require a diagnosis.');
  const files = options.targetedFiles ?? options.diagnosis.files;
  // Keep the packet within the implementation input budget after adding
  // repository guidance and timing evidence.
  const diff = (options.diff ?? '').slice(0, options.maxDiffChars ?? 16_000);
  return redactSecrets([
    '# PhaserForge CI repair implementation',
    'Implement only the approved diagnosis. Do not commit, push, merge, deploy, edit workflows, weaken tests, or change secrets/configuration.',
    '', '## Stable repository guidance', stableGuidance(options.repo),
    '', '## Failure evidence', evidenceSection(options.evidence),
    '', '## Approved diagnosis', JSON.stringify(options.diagnosis, null, 2),
    '', `## Allowed targeted files\n${files.length ? files.map((file) => `- ${file}`).join('\n') : '- None'}`,
    '', '## Current diff', diff || '(no current diff)',
  ].join('\n'));
}

export function writePacket(directory: string, name: string, content: string): string {
  mkdirSync(path.join(directory, 'packets'), { recursive: true });
  const file = path.join(directory, 'packets', name);
  writeFileSync(file, `${content}\n`);
  return file;
}
