import { ActionBase } from '../Action';
import type { Condition } from '../conditions/Condition';
import { coerceTarget, flattenTarget } from '../targets/resolveTarget';
import type { RuntimeEntity, RuntimeTarget } from '../targets/types';

type State = {
  centerX: number;
  centerY: number;
  startAngle: number;
  accumulated: number;
  prevX: number;
  prevY: number;
  prevRotationDeg?: number;
};

export class OrbitPattern extends ActionBase {
  private readonly target: RuntimeTarget;
  private readonly condition: Condition;
  private readonly radius: number;
  private readonly velocity: number;
  private readonly clockwise: boolean;
  private readonly rotateWithPath: boolean;
  private readonly rotationOffsetDeg: number;

  private readonly states = new Map<string, State>();

  constructor(
    targets: RuntimeTarget | RuntimeEntity[],
    opts: {
      radius: number;
      velocity: number;
      clockwise: boolean;
      condition: Condition;
      rotateWithPath?: boolean;
      rotationOffsetDeg?: number;
      centerMode?: 'current' | 'home';
    }
  ) {
    super();
    this.target = coerceTarget(targets);
    this.radius = Number(opts.radius ?? 0);
    this.velocity = Number(opts.velocity ?? 0);
    this.clockwise = Boolean(opts.clockwise);
    this.condition = opts.condition;
    this.rotateWithPath = Boolean(opts.rotateWithPath);
    this.rotationOffsetDeg = Number.isFinite(Number(opts.rotationOffsetDeg)) ? Number(opts.rotationOffsetDeg) : 0;
    this.centerMode = opts.centerMode === 'home' ? 'home' : 'current';
  }

  private readonly centerMode: 'current' | 'home';

  start(): void {
    if (this.started) return;
    super.start();
    this.states.clear();
    this.condition.reset();

    const members = flattenTarget(this.target);
    for (const member of members) {
      const cx = this.centerMode === 'home' ? (member.homeX ?? member.x) : member.x;
      const cy = this.centerMode === 'home' ? (member.homeY ?? member.y) : member.y;

      let dx = member.x - cx;
      let dy = member.y - cy;
      if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
        // If centered, start at right edge of the orbit.
        member.x = cx + this.radius;
        member.y = cy;
        dx = this.radius;
        dy = 0;
      }

      const startAngle = Math.atan2(dy, dx);
      this.states.set(member.id, {
        centerX: cx,
        centerY: cy,
        startAngle,
        accumulated: 0,
        prevX: member.x,
        prevY: member.y,
        prevRotationDeg: member.rotationDeg,
      });
    }
  }

  update(dtMs: number): void {
    if (this.complete || this.cancelled) return;
    const dtSeconds = dtMs / 1000;
    this.condition.update(dtMs);

    const dir = this.clockwise ? 1 : -1;
    const angularVelocity = this.radius !== 0 ? this.velocity / this.radius : 0; // rad/sec

    const members = flattenTarget(this.target);
    for (const member of members) {
      const state = this.states.get(member.id);
      if (!state) continue;
      const deltaAngle = angularVelocity * dtSeconds * dir;
      state.accumulated += Math.abs(deltaAngle);
      const angleNow = state.startAngle + dir * state.accumulated;

      const nextX = state.centerX + this.radius * Math.cos(angleNow);
      const nextY = state.centerY + this.radius * Math.sin(angleNow);

      const moveDx = nextX - state.prevX;
      const moveDy = nextY - state.prevY;
      member.x = nextX;
      member.y = nextY;
      state.prevX = nextX;
      state.prevY = nextY;

      if (this.rotateWithPath && (Math.abs(moveDx) > 1e-6 || Math.abs(moveDy) > 1e-6)) {
        const ang = (Math.atan2(moveDy, moveDx) * 180) / Math.PI + this.rotationOffsetDeg;
        member.rotationDeg = ang;
        state.prevRotationDeg = ang;
      }
    }

    const done = members.length > 0 && members.every((m) => (this.states.get(m.id)?.accumulated ?? 0) >= Math.PI * 2 * 0.999);
    if (done || this.condition.isMet(this.target)) {
      // Snap to exact start point for seamless repeat.
      for (const member of members) {
        const state = this.states.get(member.id);
        if (!state) continue;
        member.x = state.centerX + this.radius * Math.cos(state.startAngle);
        member.y = state.centerY + this.radius * Math.sin(state.startAngle);
      }
      this.stop();
    }
  }
}

