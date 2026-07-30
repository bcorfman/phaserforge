import { describe, expect, it } from 'vitest';

import { evaluatePlaywrightTimingBenchmark, evaluateTimingBenchmark } from '../../scripts/e2e-timing-benchmark';

describe('E2E WebKit timing benchmark', () => {
  it('uses the p95 of repeated successful samples as its gate', () => {
    const result = evaluateTimingBenchmark([...Array.from({ length: 18 }, (_, index) => 4_000 + index * 10), 4_400, 12_000], 10_000);

    expect(result).toMatchObject({ status: 'passed', samples: 20, medianMs: 4_090, p95Ms: 4_400 });
  });

  it('fails when the p95 sample exceeds the configured ceiling', () => {
    const result = evaluateTimingBenchmark([...Array.from({ length: 18 }, (_, index) => 4_000 + index * 10), 12_000, 13_000], 10_000);

    expect(result).toMatchObject({ status: 'failed', p95Ms: 12_000 });
  });

  it('rejects an insufficient sample set', () => {
    expect(() => evaluateTimingBenchmark([4_000, 4_100], 10_000)).toThrow('at least 3');
  });

  it('gates each repeated Playwright test independently', () => {
    const result = evaluatePlaywrightTimingBenchmark({
      suites: [{
        file: 'tests/e2e/representative.spec.ts',
        specs: [
          { title: 'stable path', tests: [{ projectName: 'webkit', results: Array.from({ length: 20 }, () => ({ status: 'passed', duration: 4_000 })) }] },
          { title: 'regressed path', tests: [{ projectName: 'webkit', results: Array.from({ length: 20 }, (_, index) => ({ status: 'passed', duration: index >= 18 ? 12_000 : 4_000 })) }] },
        ],
      }],
    });

    expect(result).toMatchObject({ status: 'failed', p95Ms: 12_000, groups: [{ title: 'stable path', status: 'passed' }, { title: 'regressed path', status: 'failed' }] });
  });
});
