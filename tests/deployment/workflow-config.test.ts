import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pagesWorkflow = readFileSync('.github/workflows/deploy-frontend-pages.yml', 'utf8');
const railwayWorkflow = readFileSync('.github/workflows/deploy-backend-railway.yml', 'utf8');

describe('deployment workflow contract', () => {
  it('builds each Pages channel from its own API variable', () => {
    expect(pagesWorkflow).toContain('VITE_API_BASE_URL_DEV');
    expect(pagesWorkflow).toContain('VITE_API_BASE_URL_STABLE');
    expect(pagesWorkflow).not.toContain('vars.VITE_API_BASE_URL }}');
  });

  it('keeps stable backend deployment manual and protected by a stable environment', () => {
    expect(railwayWorkflow).toContain('workflow_dispatch:');
    expect(railwayWorkflow).toContain("inputs.channel == 'stable'");
    expect(railwayWorkflow).toContain("&& 'stable' || 'development'");
    expect(railwayWorkflow).toContain('railway up');
    expect(railwayWorkflow).toContain('/api/v1/health');
    expect(railwayWorkflow).toContain('/api/v1/version');
  });
});
