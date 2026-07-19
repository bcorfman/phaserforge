import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pagesWorkflow = readFileSync('.github/workflows/deploy-frontend-pages.yml', 'utf8');
const railwayWorkflow = readFileSync('.github/workflows/deploy-backend-railway.yml', 'utf8');
const railwayIgnore = readFileSync('.railwayignore', 'utf8');

describe('deployment workflow contract', () => {
  it('builds each Pages channel from its own API variable', () => {
    expect(pagesWorkflow).toContain('VITE_API_BASE_URL_DEV');
    expect(pagesWorkflow).toContain('VITE_API_BASE_URL_STABLE');
    expect(pagesWorkflow).not.toContain('vars.VITE_API_BASE_URL }}');
  });

  it('keeps stable backend deployment manual and protected by a stable environment', () => {
    expect(railwayWorkflow).toContain('workflow_dispatch:');
    expect(railwayWorkflow).toContain("inputs.channel == 'stable'");
    expect(railwayWorkflow).toContain("&& 'phaserforge / production' || 'phaserforge / development'");
    expect(railwayWorkflow).toContain('railway up');
    expect(railwayWorkflow).toContain('/api/v1/health');
    expect(railwayWorkflow).toContain('/api/v1/version');
  });

  it('reads non-sensitive Railway IDs from the selected GitHub environment', () => {
    expect(railwayWorkflow).toContain('RAILWAY_PROJECT_ID: ${{ vars.RAILWAY_PROJECT_ID }}');
    expect(railwayWorkflow).toContain('RAILWAY_ENVIRONMENT_ID: ${{ vars.RAILWAY_ENVIRONMENT_ID }}');
    expect(railwayWorkflow).toContain('RAILWAY_SERVICE_ID: ${{ vars.RAILWAY_SERVICE_ID }}');
    expect(railwayWorkflow).toContain('RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}');
  });

  it('excludes local-only broken compatibility links from Railway uploads', () => {
    expect(railwayIgnore).toContain('.playwright-lib-compat/');
  });
});
