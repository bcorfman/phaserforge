import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import path from 'node:path';
import { analyzeE2ETiming, analyzeE2ETimingReports, type E2ETimingAnalysis } from './e2eTiming';

export interface E2ETimingRun { runId: string; runDirectory: string; analysis: E2ETimingAnalysis; }

export function runE2ETiming(options: { repo: string; reportPath: string; runId?: string }): E2ETimingRun {
  const runId = options.runId ?? `e2e-timing-${Date.now()}`;
  const runDirectory = path.resolve(options.repo, '.repair-harness', 'runs', runId);
  mkdirSync(runDirectory, { recursive: true });
  const reportPaths = discoverReportPaths(options.reportPath);
  const analysis = reportPaths.length === 1
    ? analyzeE2ETiming(readPlaywrightReport(reportPaths[0]))
    : analyzeE2ETimingReports(reportPaths.map(readPlaywrightReport));
  writeFileSync(path.join(runDirectory, 'e2e-timing-evidence.json'), `${JSON.stringify({ version: 1, kind: 'e2e-timing-diagnostic', reportPath: path.relative(options.repo, options.reportPath), ...analysis }, null, 2)}\n`);
  writeFileSync(path.join(runDirectory, 'e2e-timing-events.jsonl'), analysis.entries.map((entry) => `${JSON.stringify({ event: 'e2e-test-timing', title: entry.title, project: entry.project, file: entry.file, retry: entry.retry, durationMs: entry.durationMs, outcome: entry.outcome, category: entry.category })}\n`).join(''));
  writeFileSync(path.join(runDirectory, 'e2e-timing-summary.md'), renderSummary(analysis));
  return { runId, runDirectory, analysis };
}

function discoverReportPaths(reportPath: string): string[] {
  if (!statSync(reportPath).isDirectory()) return [reportPath];
  const paths: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.name === 'index.html' && fullPath.includes(`${path.sep}playwright-report${path.sep}`)) paths.push(fullPath);
      else if (entry.name.endsWith('.json') && entry.name === 'report.json') paths.push(fullPath);
    }
  };
  visit(reportPath);
  if (!paths.length) throw new Error(`No Playwright index.html or report.json files found under ${reportPath}.`);
  return paths.sort();
}

function readPlaywrightReport(reportPath: string): unknown {
  const contents = readFileSync(reportPath);
  if (path.extname(reportPath).toLowerCase() !== '.html') return JSON.parse(contents.toString('utf8'));

  const html = contents.toString('utf8');
  const match = html.match(/data:application\/zip;base64,([^<]+)/);
  if (!match) throw new Error('Playwright HTML report does not contain an embedded results archive.');
  const reportJson = readZipEntry(Buffer.from(match[1], 'base64'), 'report.json');
  if (!reportJson) throw new Error('Playwright HTML report does not contain report.json.');
  return JSON.parse(reportJson.toString('utf8'));
}

function readZipEntry(archive: Buffer, wantedName: string): Buffer | undefined {
  const endOffset = findSignatureFromEnd(archive, 0x06054b50);
  if (endOffset < 0) throw new Error('Embedded Playwright results archive is not a valid ZIP.');
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) throw new Error('Embedded Playwright results archive has an invalid directory.');
    const compression = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (name === wantedName) {
      if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`ZIP entry ${wantedName} has an invalid local header.`);
      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const data = archive.subarray(dataStart, dataStart + compressedSize);
      if (compression === 0) return data;
      if (compression === 8) return inflateRawSync(data);
      throw new Error(`ZIP entry ${wantedName} uses unsupported compression.`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return undefined;
}

function findSignatureFromEnd(buffer: Buffer, signature: number): number {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  return -1;
}

function renderSummary(analysis: E2ETimingAnalysis): string {
  const lines = [
    '# E2E timing diagnostic',
    '',
    `Status: ${analysis.status}`,
    `Target: ${analysis.targetMs}ms; hard ceiling: ${analysis.hardCeilingMs}ms`,
    '',
    `Normal: ${analysis.counts.normal}; warnings: ${analysis.counts.warning}; slow: ${analysis.counts.slow}; invalid: ${analysis.counts['missing-duration'] + analysis.counts['invalid-duration']}`,
    '',
    '## Slow and warning tests',
    '',
    ...analysis.entries.filter((entry) => entry.category !== 'normal').map((entry) => `- ${entry.category}: ${entry.title} — ${entry.project} — ${entry.file} — ${entry.durationMs ?? 'missing'}ms (retry ${entry.retry})`),
  ];
  return `${lines.join('\n')}\n`;
}
