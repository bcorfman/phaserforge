import { describe, expect, it } from 'vitest';

import {
  aggregateRepairOutcomes,
  createRepairOutcome,
  formatRepairMetrics,
  type RepairOutcome,
} from '../../scripts/repair-harness/metrics';
import { classifyFailure } from '../../scripts/repair-harness/triage';
import { evaluatePolicy } from '../../scripts/repair-harness/policy';

const outcome = (overrides: Partial<RepairOutcome> = {}): RepairOutcome => createRepairOutcome({
  runId: 'fixture-01',
  failureClass: 'assertion',
  reproduction: { matched: true, durationMs: 120 },
  focusedVerification: { status: 'passed', durationMs: 80 },
  requiredVerification: { status: 'passed', durationMs: 900 },
  attempts: 1,
  packetBytes: 2048,
  tokenUsage: { input: 1200, output: 300 },
  humanAcceptance: 'pending',
  status: 'verified',
  ...overrides,
});

describe('repair harness phase 4 metrics', () => {
  it('aggregates bounded operational measures without retaining evidence text', () => {
    const metrics = aggregateRepairOutcomes([
      outcome(),
      outcome({ runId: 'fixture-02', failureClass: 'timeout', status: 'stopped', stopReason: 'Repeated evidence fingerprint.', attempts: 2, tokenUsage: { input: 8000, output: 2000 } }),
    ]);
    expect(metrics).toMatchObject({ runs: 2, verified: 1, stopped: 1, byFailureClass: { assertion: 1, timeout: 1 }, reproduction: { matched: 2 }, attempts: { total: 3, max: 2 }, tokenUsage: { knownCalls: 2, input: 9200, output: 2300 } });
    expect(JSON.stringify(metrics)).not.toContain('stack');
  });

  it('reports incomplete token and human-acceptance data explicitly', () => {
    const metrics = aggregateRepairOutcomes([outcome({ tokenUsage: undefined, humanAcceptance: 'accepted' })]);
    expect(metrics.tokenUsage.unknownRuns).toBe(1);
    expect(metrics.humanAcceptance).toEqual({ accepted: 1, rejected: 0, pending: 0 });
    expect(formatRepairMetrics(metrics)).toContain('Token usage: unavailable for 1 run(s)');
  });
});

describe('repair harness phase 4 regression fixtures', () => {
  it('keeps browser launch and network failures classified as infrastructure', () => {
    expect(classifyFailure('browserType.launch: Executable doesn\'t exist').class).toBe('infrastructure');
    expect(classifyFailure('ECONNRESET while fetching artifact').class).toBe('infrastructure');
  });

  it('keeps unsafe proposed changes denied', () => {
    expect(evaluatePolicy(['M\t.github/workflows/e2e-pr.yml', '+ test.skip("repair")', '+ retries: 4'].join('\n')).allowed).toBe(false);
  });

  it('does not treat a passing model response as success', () => {
    expect(outcome({ status: 'failed', requiredVerification: { status: 'failed', durationMs: 50 }, stopReason: 'Required verification failed.' }).status).toBe('failed');
  });

  it('preserves the token-expensive repeated-attempt outcome for measurement', () => {
    const measured = outcome({ attempts: 2, tokenUsage: { input: 12000, output: 2800 }, status: 'stopped', stopReason: 'Token budget exceeded.' });
    expect(aggregateRepairOutcomes([measured]).attempts.total).toBe(2);
    expect(aggregateRepairOutcomes([measured]).tokenUsage.input).toBe(12000);
  });
});
