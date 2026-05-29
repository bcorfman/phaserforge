import { describe, expect, it } from 'vitest';
import { isLocalHostname } from '../../src/util/isLocalHostname';

describe('isLocalHostname', () => {
  it('treats localhost as local', () => {
    expect(isLocalHostname('localhost')).toBe(true);
    expect(isLocalHostname('LOCALHOST')).toBe(true);
  });

  it('treats loopback IPs as local', () => {
    expect(isLocalHostname('127.0.0.1')).toBe(true);
    expect(isLocalHostname('127.10.0.1')).toBe(true);
    expect(isLocalHostname('::1')).toBe(true);
  });

  it('does not treat non-local hostnames as local', () => {
    expect(isLocalHostname(undefined)).toBe(false);
    expect(isLocalHostname(null)).toBe(false);
    expect(isLocalHostname('')).toBe(false);
    expect(isLocalHostname('phaserforge.app')).toBe(false);
    expect(isLocalHostname('192.168.0.10')).toBe(false);
  });
});

