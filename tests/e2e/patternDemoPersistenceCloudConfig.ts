export function getPatternDemoCloudLiveConfigError(env: {
  persistenceTarget?: string;
  baseUrl?: string;
}): string | null {
  if (env.persistenceTarget !== 'cloud-live') return null;

  const baseUrl = env.baseUrl?.trim() ?? '';
  if (!baseUrl) {
    return [
      'Cloud-live persistence tests require `PW_BASE_URL` to point at the deployed app.',
      'Example: `PW_BASE_URL=https://bcorfman.github.io/phaserforge/`.',
      'Without that, Playwright defaults to the local preview server and cloud autosave requests fail before the project becomes cloud-backed.',
    ].join(' ');
  }

  if (/^https?:\/\/(?:127\.0\.0\.1|localhost)(?:[:/]|$)/i.test(baseUrl)) {
    return [
      `Cloud-live persistence tests cannot target a local base URL (\`${baseUrl}\`).`,
      'Use the deployed GitHub Pages app instead, for example `PW_BASE_URL=https://bcorfman.github.io/phaserforge/`.',
    ].join(' ');
  }

  return null;
}
