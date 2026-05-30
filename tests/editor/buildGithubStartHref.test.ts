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
    expect(url.searchParams.get('returnTo')).toBe('https://phaseractions.studio/editor/');
  });

  it('keeps returnTo relative when no locationHref is provided', () => {
    const href = buildGithubStartHref({
      apiBaseUrl: 'https://phaseractions-studio-production.up.railway.app/',
      baseUrl: '/app/',
    });
    const url = new URL(href);
    expect(url.searchParams.get('returnTo')).toBe('/app/');
  });
});

