import { describe, expect, it } from 'vitest';

import { waitForCompletedGithubRun } from '../../scripts/repair-harness/github';

describe('repair harness GitHub run polling', () => {
  it('waits for the matching commit and returns only after it completes', async () => {
    const snapshots = [
      [{ databaseId: 10, headSha: 'older', status: 'completed', conclusion: 'failure' }],
      [{ databaseId: 11, headSha: 'candidate', status: 'in_progress', conclusion: null }],
      [{ databaseId: 11, headSha: 'candidate', status: 'completed', conclusion: 'success' }],
    ];
    let index = 0;
    const result = await waitForCompletedGithubRun({
      repo: process.cwd(),
      branch: 'agent/timing',
      headSha: 'candidate',
      timeoutMs: 100,
      pollIntervalMs: 0,
      listRuns: () => snapshots[index++] ?? [],
      sleep: async () => {},
    });

    expect(result).toMatchObject({ runId: '11', conclusion: 'success' });
    expect(index).toBe(3);
  });

  it('times out when GitHub never exposes a completed matching run', async () => {
    await expect(waitForCompletedGithubRun({
      repo: process.cwd(), branch: 'agent/timing', headSha: 'candidate', timeoutMs: 0, pollIntervalMs: 0,
      listRuns: () => [], sleep: async () => {},
    })).rejects.toThrow('Timed out waiting');
  });

  it('accepts a newly dispatched run when the branch tip advanced after the source run', async () => {
    const snapshots = [
      [{ databaseId: 20, headSha: 'newer-tip', status: 'in_progress', conclusion: null }],
      [{ databaseId: 20, headSha: 'newer-tip', status: 'completed', conclusion: 'success' }],
    ];
    let index = 0;
    const result = await waitForCompletedGithubRun({
      repo: process.cwd(),
      branch: 'main',
      headSha: 'source-sha',
      knownRunIds: new Set(['19']),
      timeoutMs: 100,
      pollIntervalMs: 0,
      listRuns: () => snapshots[index++] ?? [],
      sleep: async () => {},
    });

    expect(result).toMatchObject({ runId: '20', conclusion: 'success' });
    expect(index).toBe(2);
  });
});
