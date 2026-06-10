import React from 'react';

export type LayoutUnits = 'grid' | 'pixels';

type LayoutPopoverContentProps = {
  layoutUnits: LayoutUnits;
  setLayoutUnits: (units: LayoutUnits) => void;

  layoutSpacingX: string;
  setLayoutSpacingX: (value: string) => void;
  layoutSpacingY: string;
  setLayoutSpacingY: (value: string) => void;

  layoutSetX: string;
  setLayoutSetX: (value: string) => void;
  layoutSetY: string;
  setLayoutSetY: (value: string) => void;

  onDistributeX: () => void;
  onDistributeY: () => void;
  onApplySpacingX: () => void;
  onApplySpacingY: () => void;

  onApplySetX: () => void;
  onApplySetY: () => void;
  onApplySetXY: () => void;

  onAlignLeft: () => void;
  onAlignCenterX: () => void;
  onAlignRight: () => void;
  onAlignTop: () => void;
  onAlignCenterY: () => void;
  onAlignBottom: () => void;

  onStackCenterX: () => void;
  onStackCenterY: () => void;
  onMatchLeftEdges: () => void;
  onMatchTopEdges: () => void;

  onClose: () => void;
};

export function LayoutPopoverContent(props: LayoutPopoverContentProps) {
  const {
    layoutUnits,
    setLayoutUnits,
    layoutSpacingX,
    setLayoutSpacingX,
    layoutSpacingY,
    setLayoutSpacingY,
    layoutSetX,
    setLayoutSetX,
    layoutSetY,
    setLayoutSetY,
    onDistributeX,
    onDistributeY,
    onApplySpacingX,
    onApplySpacingY,
    onApplySetX,
    onApplySetY,
    onApplySetXY,
    onAlignLeft,
    onAlignCenterX,
    onAlignRight,
    onAlignTop,
    onAlignCenterY,
    onAlignBottom,
    onStackCenterX,
    onStackCenterY,
    onMatchLeftEdges,
    onMatchTopEdges,
    onClose,
  } = props;
  const actionButtonClassName = 'button button-compact';

  return (
    <div className="canvas-layout-popover-content">
      <div className="canvas-layout-popover-header">
        <div className="canvas-selection-menu-heading" style={{ padding: 0 }}>
          Layout
        </div>
        <div className="canvas-layout-popover-header-hint">All actions visible</div>
      </div>

      <div className="canvas-layout-grid">
        <div className="canvas-layout-col">
          <div className="canvas-layout-card">
            <div className="canvas-selection-menu-heading" style={{ padding: 0 }}>
              Arrange
            </div>

            <div className="canvas-layout-grid-2">
              <button className={actionButtonClassName} data-testid="layout-distribute-x" type="button" onClick={onDistributeX}>
                Distribute X
              </button>
              <button className={actionButtonClassName} data-testid="layout-distribute-y" type="button" onClick={onDistributeY}>
                Distribute Y
              </button>
            </div>

            <div className="canvas-layout-subheading">Spacing</div>

            <div className="canvas-layout-row">
              <button
                className={`button button-compact ${layoutUnits === 'grid' ? 'active' : ''}`}
                type="button"
                data-testid="layout-units-grid"
                onClick={() => setLayoutUnits('grid')}
              >
                Grid
              </button>
              <button
                className={`button button-compact ${layoutUnits === 'pixels' ? 'active' : ''}`}
                type="button"
                data-testid="layout-units-pixels"
                onClick={() => setLayoutUnits('pixels')}
              >
                Pixels
              </button>
            </div>

            <div className="canvas-layout-grid-2">
              <label className="field" style={{ margin: 0 }}>
                <span>Spacing X</span>
                <input className="text-input" data-testid="layout-spacing-x" type="number" value={layoutSpacingX} onChange={(e) => setLayoutSpacingX(e.target.value)} />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span>Spacing Y</span>
                <input className="text-input" data-testid="layout-spacing-y" type="number" value={layoutSpacingY} onChange={(e) => setLayoutSpacingY(e.target.value)} />
              </label>
            </div>

            <div className="canvas-layout-grid-2">
              <button className={actionButtonClassName} data-testid="layout-apply-spacing-x" type="button" onClick={onApplySpacingX}>
                Apply X
              </button>
              <button className={actionButtonClassName} data-testid="layout-apply-spacing-y" type="button" onClick={onApplySpacingY}>
                Apply Y
              </button>
            </div>
          </div>

          <div className="canvas-layout-card">
            <div className="canvas-selection-menu-heading" style={{ padding: 0 }}>
              Position
            </div>

            <div className="canvas-layout-grid-2">
              <label className="field" style={{ margin: 0 }}>
                <span>X</span>
                <input className="text-input" data-testid="layout-set-x" type="number" value={layoutSetX} onChange={(e) => setLayoutSetX(e.target.value)} />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span>Y</span>
                <input className="text-input" data-testid="layout-set-y" type="number" value={layoutSetY} onChange={(e) => setLayoutSetY(e.target.value)} />
              </label>
            </div>

            <div className="canvas-layout-grid-3">
              <button className={actionButtonClassName} data-testid="layout-apply-set-x" type="button" onClick={onApplySetX}>
                Set X
              </button>
              <button className={actionButtonClassName} data-testid="layout-apply-set-y" type="button" onClick={onApplySetY}>
                Set Y
              </button>
              <button className={actionButtonClassName} data-testid="layout-apply-set-xy" type="button" onClick={onApplySetXY}>
                Set X+Y
              </button>
            </div>
          </div>
        </div>

        <div className="canvas-layout-col">
          <div className="canvas-layout-card">
            <div className="canvas-selection-menu-heading" style={{ padding: 0 }}>
              Align
            </div>

            <div className="canvas-layout-grid-3">
              <button className={actionButtonClassName} data-testid="layout-align-left" type="button" onClick={onAlignLeft}>
                Left
              </button>
              <button className={actionButtonClassName} data-testid="layout-align-center-x" type="button" onClick={onAlignCenterX}>
                Center X
              </button>
              <button className={actionButtonClassName} data-testid="layout-align-right" type="button" onClick={onAlignRight}>
                Right
              </button>
              <button className={actionButtonClassName} data-testid="layout-align-top" type="button" onClick={onAlignTop}>
                Top
              </button>
              <button className={actionButtonClassName} data-testid="layout-align-center-y" type="button" onClick={onAlignCenterY}>
                Center Y
              </button>
              <button className={actionButtonClassName} data-testid="layout-align-bottom" type="button" onClick={onAlignBottom}>
                Bottom
              </button>
            </div>

            <div className="canvas-layout-muted">Center aligns to world center.</div>
          </div>

          <div className="canvas-layout-card">
            <div className="canvas-selection-menu-heading" style={{ padding: 0 }}>
              Advanced
            </div>

            <div className="canvas-layout-grid-2">
              <button className={actionButtonClassName} data-testid="layout-stack-center-x" type="button" onClick={onStackCenterX}>
                Stack X centers
              </button>
              <button className={actionButtonClassName} data-testid="layout-stack-center-y" type="button" onClick={onStackCenterY}>
                Stack Y centers
              </button>
              <button className={actionButtonClassName} data-testid="layout-match-left-edges" type="button" onClick={onMatchLeftEdges}>
                Match left edges
              </button>
              <button className={actionButtonClassName} data-testid="layout-match-top-edges" type="button" onClick={onMatchTopEdges}>
                Match top edges
              </button>
            </div>
          </div>
        </div>
      </div>

      <button className="button button-compact canvas-layout-close" type="button" data-testid="layout-close" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
