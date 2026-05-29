export function isLocalHostname(hostname: string | undefined | null): boolean {
  if (!hostname) return false;

  const normalized = hostname.trim().toLowerCase();
  if (normalized === 'localhost') return true;
  if (normalized === '::1') return true;
  if (normalized.startsWith('127.')) return true;

  return false;
}

