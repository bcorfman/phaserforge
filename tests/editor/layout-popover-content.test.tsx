import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LayoutPopoverContent } from '../../src/editor/LayoutPopoverContent';

describe('LayoutPopoverContent', () => {
  it('renders a compact two-column layout with all existing action test ids', () => {
    const markup = renderToStaticMarkup(
      <LayoutPopoverContent
        layoutUnits="pixels"
        setLayoutUnits={() => {}}
        layoutSpacingX="64"
        setLayoutSpacingX={() => {}}
        layoutSpacingY="32"
        setLayoutSpacingY={() => {}}
        layoutSetX="0"
        setLayoutSetX={() => {}}
        layoutSetY="0"
        setLayoutSetY={() => {}}
        onDistributeX={() => {}}
        onDistributeY={() => {}}
        onApplySpacingX={() => {}}
        onApplySpacingY={() => {}}
        onApplySetX={() => {}}
        onApplySetY={() => {}}
        onApplySetXY={() => {}}
        onAlignLeft={() => {}}
        onAlignCenterX={() => {}}
        onAlignRight={() => {}}
        onAlignTop={() => {}}
        onAlignCenterY={() => {}}
        onAlignBottom={() => {}}
        onStackCenterX={() => {}}
        onStackCenterY={() => {}}
        onMatchLeftEdges={() => {}}
        onMatchTopEdges={() => {}}
        onClose={() => {}}
      />
    );

    expect(markup).toContain('class="canvas-layout-grid"');
    expect(markup).toContain('data-testid="layout-distribute-x"');
    expect(markup).toContain('data-testid="layout-distribute-y"');
    expect(markup).toContain('data-testid="layout-units-grid"');
    expect(markup).toContain('data-testid="layout-units-pixels"');
    expect(markup).toContain('data-testid="layout-spacing-x"');
    expect(markup).toContain('data-testid="layout-spacing-y"');
    expect(markup).toContain('data-testid="layout-apply-spacing-x"');
    expect(markup).toContain('data-testid="layout-apply-spacing-y"');
    expect(markup).toContain('data-testid="layout-set-x"');
    expect(markup).toContain('data-testid="layout-set-y"');
    expect(markup).toContain('data-testid="layout-apply-set-x"');
    expect(markup).toContain('data-testid="layout-apply-set-y"');
    expect(markup).toContain('data-testid="layout-apply-set-xy"');
    expect(markup).toContain('data-testid="layout-align-left"');
    expect(markup).toContain('data-testid="layout-align-center-x"');
    expect(markup).toContain('data-testid="layout-align-right"');
    expect(markup).toContain('data-testid="layout-align-top"');
    expect(markup).toContain('data-testid="layout-align-center-y"');
    expect(markup).toContain('data-testid="layout-align-bottom"');
    expect(markup).toContain('data-testid="layout-stack-center-x"');
    expect(markup).toContain('data-testid="layout-stack-center-y"');
    expect(markup).toContain('data-testid="layout-match-left-edges"');
    expect(markup).toContain('data-testid="layout-match-top-edges"');
    expect(markup).toContain('data-testid="layout-close"');
  });
});

