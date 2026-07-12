import { describe, expect, it } from 'vitest';

import {
  formatClearDbDiagnostics,
  getDriverErrorCode,
  isPostgresOutOfSpaceError,
} from '../../scripts/clear-cloud-db';

describe('clear-cloud-db helpers', () => {
  it('extracts the postgres driver code from prisma raw query errors', () => {
    const error = {
      meta: {
        driverAdapterError: {
          cause: {
            code: '53100',
          },
        },
      },
    };

    expect(getDriverErrorCode(error)).toBe('53100');
    expect(isPostgresOutOfSpaceError(error)).toBe(true);
  });

  it('returns false when the error is not a postgres out-of-space failure', () => {
    expect(isPostgresOutOfSpaceError(new Error('boom'))).toBe(false);
    expect(isPostgresOutOfSpaceError({ meta: { driverAdapterError: { cause: { code: '22001' } } } })).toBe(false);
  });

  it('formats actionable diagnostics for no-space failures', () => {
    const message = formatClearDbDiagnostics('content', {
      databaseSize: '3550 MB',
      largestTables: [
        { tableName: 'public.CloudAsset', totalSize: '3541 MB' },
        { tableName: 'public.Game', totalSize: '464 kB' },
      ],
      cloudAsset: {
        rows: 4591,
        totalBytes: '3397 MB',
        maxAssetBytes: '9711 kB',
      },
    });

    expect(message).toContain('scope "content"');
    expect(message).toContain('SQLSTATE 53100');
    expect(message).toContain('public.CloudAsset: 3541 MB');
    expect(message).toContain('4591 rows, 3397 MB logical bytes, max asset 9711 kB');
    expect(message).toContain('Railway Postgres storage volume');
  });
});
