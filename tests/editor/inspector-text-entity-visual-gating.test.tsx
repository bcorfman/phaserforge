// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { renderEntityInspector } from '../../src/editor/Inspector';

describe('Inspector text entity gating', () => {
  it('does not show sprite Visual controls for non-rasterized text entities', () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    (window as any).localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const entity = {
      id: 't1',
      x: 10,
      y: 10,
      width: 100,
      height: 40,
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      originX: 0.5,
      originY: 0.5,
      text: { value: 'Hello', fontSize: 18, color: '#fff', align: 'left' } as any,
      asset: undefined,
    } as any;

    React.act(() => {
      root.render(renderEntityInspector(entity, vi.fn()));
    });

    expect(container.textContent).toContain('Text');
    expect(container.textContent).toContain('Rasterize to Sprite');
    expect(container.querySelector('[data-testid="entity-asset-select"]')).toBeNull();
    expect(container.textContent).not.toContain('Visual');
    expect(container.textContent).not.toContain('Hitbox (Bounds)');
    expect(container.textContent).not.toContain('Physics');
    expect(container.textContent).not.toContain('Actions/Events');
  });
});
