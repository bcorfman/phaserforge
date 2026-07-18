import { describe, expect, it } from 'vitest';
import {
  BOUNDS_EVENT_DEFINITIONS,
  BOUNDS_SIDE_LABELS,
  boundsEventDebugName,
  boundsOutcomeIsCompatible,
  type BoundsRuntimeEventEnvelope,
} from '../../src/runtime/events';

describe('runtime event model', () => {
  it('defines a finite bounds outcome family with stable behavior compatibility', () => {
    expect(BOUNDS_EVENT_DEFINITIONS.map((definition) => definition.value)).toEqual([
      'contact-entered',
      'contact-exited',
      'wrapped',
      'bounced',
      'clamped',
      'stopped',
    ]);
    expect(boundsOutcomeIsCompatible('contact-entered', 'wrap')).toBe(true);
    expect(boundsOutcomeIsCompatible('contact-exited', 'bounce')).toBe(true);
    expect(boundsOutcomeIsCompatible('wrapped', 'wrap')).toBe(true);
    expect(boundsOutcomeIsCompatible('wrapped', 'bounce')).toBe(false);
    expect(boundsOutcomeIsCompatible('bounced', 'bounce')).toBe(true);
    expect(boundsOutcomeIsCompatible('clamped', 'limit')).toBe(true);
    expect(boundsOutcomeIsCompatible('stopped', 'stop')).toBe(true);
  });

  it('keeps bounds side terminology aligned with runtime coordinates', () => {
    expect(BOUNDS_SIDE_LABELS.left).toBe('Left / Min X');
    expect(BOUNDS_SIDE_LABELS.right).toBe('Right / Max X');
    expect(BOUNDS_SIDE_LABELS.bottom).toBe('Bottom / Min Y');
    expect(BOUNDS_SIDE_LABELS.top).toBe('Top / Max Y');
  });

  it('describes runtime event envelopes with source, owner, payload, and deterministic occurrence identity', () => {
    const envelope: BoundsRuntimeEventEnvelope = {
      family: 'bounds',
      type: 'wrapped',
      phase: 'outcome',
      source: { targetKey: 'entity:star-1', entityId: 'star-1' },
      owner: { targetKey: 'group:stars', eventBlockId: 'wrap' },
      payload: { axis: 'y', side: 'bottom' },
      occurrence: { id: 'evt-000001', order: 1 },
      details: { axis: 'y', side: 'bottom', priorPosition: { x: 1, y: -2 }, position: { x: 1, y: 1275 } },
    };

    expect(envelope.family).toBe('bounds');
    expect(envelope.source?.entityId).toBe('star-1');
    expect(envelope.owner?.eventBlockId).toBe('wrap');
    expect(envelope.occurrence).toEqual({ id: 'evt-000001', order: 1 });
    expect(boundsEventDebugName(envelope.type, envelope.details.axis, envelope.details.side)).toBe('bounds:wrapped:y:bottom');
  });
});
