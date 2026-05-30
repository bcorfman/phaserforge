import { describe, expect, it } from 'vitest';

import { buildGithubStartHref } from '../../src/editor/CloudAccountPanel';

describe('buildGithubStartHref', () => {
  it('uses an absolute returnTo when BASE_URL is relative (e.g. "./")', () => {
    const href = buildGithubStartHref({
      apiBaseUrl: 'https://phaseractions-studio-production.up.railway.app',
      baseUrl: './',
      locationHref: 'https://phaseractions.studio/editor/index.html',
    });

    const url = new URL(href);
    expect(url.origin).toBe('https://phaseractions-studio-production.up.railway.app');
    expect(url.pathname).toBe('/api/v1/auth/github/start');
    expect(url.searchParams.get('returnTo')).toBe('/editor/');
  });

  it('keeps returnTo relative when no locationHref is provided', () => {
    const href = buildGithubStartHref({
      apiBaseUrl: 'https://phaseractions-studio-production.up.railway.app/',
      baseUrl: '/app/',
    });
    const url = new URL(href);
    expect(url.searchParams.get('returnTo')).toBe('/app/');
  });

  it('strips origin when BASE_URL is absolute', () => {
    const href = buildGithubStartHref({
      apiBaseUrl: 'https://phaseractions-studio-production.up.railway.app/',
      baseUrl: 'https://bcorfman.github.io/phaserforge/?x=1#hash',
    });
    const url = new URL(href);
    expect(url.searchParams.get('returnTo')).toBe('/phaserforge/?x=1#hash');
  });
});
