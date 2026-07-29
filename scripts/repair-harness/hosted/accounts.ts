import type { HostedAccount } from './browser';

export interface HostedIsolationAccounts {
  dev: HostedAccount;
  stable: HostedAccount;
}

/** Credentials are intentionally accepted only in memory and are never serialized. */
export function assertSeparateHostedAccounts(accounts: HostedIsolationAccounts): void {
  if (!accounts.dev.email.trim() || !accounts.dev.password) throw new Error('A development hosted test account is required.');
  if (!accounts.stable.email.trim() || !accounts.stable.password) throw new Error('A stable hosted test account is required.');
  if (accounts.dev.email.trim().toLowerCase() === accounts.stable.email.trim().toLowerCase()) {
    throw new Error('Development and stable hosted test accounts must be distinct.');
  }
}
