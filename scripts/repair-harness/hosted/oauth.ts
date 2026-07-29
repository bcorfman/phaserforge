import type { HostedConfig } from './config';

export interface HostedOAuthPreflightResult {
  status: 'passed';
  callbackHost: string;
  devRedirect: string;
  stableRedirect: string;
  reasons: string[];
}

export function runHostedOAuthPreflight(config: HostedConfig, explicitFlag: boolean): HostedOAuthPreflightResult {
  if (!explicitFlag) throw new Error('Hosted OAuth preflight requires an explicit opt-in flag.');
  if (!config.allowOAuth) throw new Error('Hosted OAuth preflight requires HOSTED_ALLOW_OAUTH=true in the validated config.');
  if (!config.oauthCallbackHost || !config.expectedDevOAuthRedirectUri || !config.expectedStableOAuthRedirectUri) {
    throw new Error('Hosted OAuth preflight requires the callback host and both expected dev/stable redirect URIs.');
  }
  const dev = new URL(config.expectedDevOAuthRedirectUri);
  const stable = new URL(config.expectedStableOAuthRedirectUri);
  if (dev.protocol !== 'https:' || stable.protocol !== 'https:') throw new Error('Hosted OAuth redirect URIs must use HTTPS.');
  if (dev.host !== config.oauthCallbackHost || stable.host !== config.oauthCallbackHost) throw new Error('OAuth redirect URI callback host does not match the configured callback host.');
  if (dev.href === stable.href) throw new Error('Development and stable OAuth redirect URIs must be distinct.');
  return { status: 'passed', callbackHost: config.oauthCallbackHost, devRedirect: `${dev.pathname}${dev.search}`, stableRedirect: `${stable.pathname}${stable.search}`, reasons: [] };
}

export function assertManualOAuthCheckpoint(checkpoint: string | undefined): void {
  if (!checkpoint?.trim()) throw new Error('A human-provided manual OAuth checkpoint is required before any live OAuth login.');
}
