import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('input maps panel spacing', () => {
  test('gives the input maps section extra top spacing so its divider sits between sections', () => {
    const component = readText('src/editor/InputMapsPanel.tsx');
    const css = readText('src/app/layout.css');

    expect(component).toContain('className="panel-section input-maps-panel-section"');
    expect(css).toMatch(/\.panel-section\.input-maps-panel-section\s*\{/);
    expect(css).toMatch(/margin-top:\s*0\.2rem/);
  });
});
