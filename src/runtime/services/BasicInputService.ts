import type { InputActionMapSpec, InputBindingSpec } from '../../model/types';
import type { InputService } from './RuntimeServices';

export type InputActionState = { pressed: boolean; held: boolean; released: boolean };

function cloneState(state: InputActionState): InputActionState {
  return { pressed: state.pressed, held: state.held, released: state.released };
}

function normalizeKeyboardToken(token: string): string {
  const raw = token.trim();
  if (!raw) return raw;
  if (raw === ' ') return 'Space';
  if (raw.length === 1) return raw.toUpperCase();
  if (raw.startsWith('Key') && raw.length === 4) return raw.slice(3).toUpperCase();
  return raw;
}

function keyboardMatches(bindingKey: string, eventCode: string, eventKey?: string): boolean {
  const b = normalizeKeyboardToken(bindingKey);
  const code = normalizeKeyboardToken(eventCode);
  const key = eventKey ? normalizeKeyboardToken(eventKey) : '';
  if (!b) return false;
  return b === code || (key ? b === key : false);
}

function mouseButtonMatches(bindingButton: 'left' | 'middle' | 'right', eventButton: number): boolean {
  switch (bindingButton) {
    case 'left':
      return eventButton === 0;
    case 'middle':
      return eventButton === 1;
    case 'right':
      return eventButton === 2;
    default:
      return false;
  }
}

function gamepadButtonPressed(pad: Gamepad, index: number): boolean {
  const btn = pad.buttons[index];
  return Boolean(btn && (btn.pressed || btn.value > 0.5));
}

function parseGamepadControl(control: string): { kind: 'button'; index: number } | { kind: 'axis'; index: number; direction: -1 | 1 } | null {
  const trimmed = (control ?? '').trim();
  const buttonMatch = /^button\.(\d+)$/i.exec(trimmed);
  if (buttonMatch) return { kind: 'button', index: Number(buttonMatch[1]) };

  // Common aliases in mockups: "A", "Start"
  const alias = trimmed.toUpperCase();
  const aliasButton: Record<string, number> = {
    A: 0,
    B: 1,
    X: 2,
    Y: 3,
    LB: 4,
    RB: 5,
    BACK: 8,
    SELECT: 8,
    START: 9,
  };
  if (aliasButton[alias] !== undefined) return { kind: 'button', index: aliasButton[alias] };

  // Axis: "LX<0" / "LX>0" / "axis.0<0"
  const axisMatch = /^(?:axis\.)?(\d+|LX|LY|RX|RY)\s*([<>])\s*0$/i.exec(trimmed);
  if (axisMatch) {
    const axisToken = axisMatch[1].toUpperCase();
    const axisIndex: Record<string, number> = { LX: 0, LY: 1, RX: 2, RY: 3 };
    const index = axisIndex[axisToken] ?? Number(axisToken);
    const direction = axisMatch[2] === '<' ? -1 : 1;
    return { kind: 'axis', index, direction };
  }

  return null;
}

export class BasicInputService implements InputService {
  private activeMaps: InputActionMapSpec[] = [];
  private readonly downKeys = new Set<string>();
  private readonly downMouseButtons = new Set<number>();
  private frame = 0;
  private lastPointer?: { x: number; y: number; worldX: number; worldY: number };
  private pointerDelta?: { dx: number; dy: number; dWorldX: number; dWorldY: number };

  private readonly prevHeldByAction = new Map<string, boolean>();
  private readonly stateByAction = new Map<string, InputActionState>();
  private readonly pressedCountByAction = new Map<string, number>();
  private readonly releasedCountByAction = new Map<string, number>();

  constructor(
    private readonly opts: {
      getGamepads?: () => Array<Gamepad | null>;
      getPointer?: () => { x: number; y: number; worldX: number; worldY: number } | null;
    } = {}
  ) {}

  public setActiveMaps(maps: InputActionMapSpec[]): void {
    this.activeMaps = maps.slice();
  }

  public handleKeyDown(event: { code: string; key?: string }): void {
    const code = event.code || '';
    const key = event.key || '';
    if (code) this.downKeys.add(code);
    if (key) this.downKeys.add(key);
  }

  public handleKeyUp(event: { code: string; key?: string }): void {
    const code = event.code || '';
    const key = event.key || '';
    if (code) this.downKeys.delete(code);
    if (key) this.downKeys.delete(key);
  }

  public handleMouseDown(button: number): void {
    this.downMouseButtons.add(button);
  }

  public handleMouseUp(button: number): void {
    this.downMouseButtons.delete(button);
  }

  public update(): void {
    this.frame += 1;
    const pointer = this.opts.getPointer?.() ?? null;
    if (pointer) {
      if (this.lastPointer) {
        this.pointerDelta = {
          dx: pointer.x - this.lastPointer.x,
          dy: pointer.y - this.lastPointer.y,
          dWorldX: pointer.worldX - this.lastPointer.worldX,
          dWorldY: pointer.worldY - this.lastPointer.worldY,
        };
      } else {
        this.pointerDelta = { dx: 0, dy: 0, dWorldX: 0, dWorldY: 0 };
      }
      this.lastPointer = { ...pointer };
    } else {
      this.lastPointer = undefined;
      this.pointerDelta = undefined;
    }

    const actions = this.computeActionsHeld();
    for (const [actionId, held] of actions) {
      const prevHeld = this.prevHeldByAction.get(actionId) ?? false;
      const pressed = held && !prevHeld;
      const released = !held && prevHeld;
      this.prevHeldByAction.set(actionId, held);
      this.stateByAction.set(actionId, { pressed, held, released });
      if (pressed) this.pressedCountByAction.set(actionId, (this.pressedCountByAction.get(actionId) ?? 0) + 1);
      if (released) this.releasedCountByAction.set(actionId, (this.releasedCountByAction.get(actionId) ?? 0) + 1);
    }

    // Ensure actions missing in this frame get cleared.
    for (const [actionId, prevHeld] of Array.from(this.prevHeldByAction.entries())) {
      if (actions.has(actionId)) continue;
      const held = false;
      const pressed = false;
      const released = prevHeld;
      this.prevHeldByAction.set(actionId, false);
      this.stateByAction.set(actionId, { pressed, held, released });
      if (released) this.releasedCountByAction.set(actionId, (this.releasedCountByAction.get(actionId) ?? 0) + 1);
    }
  }

  public getActionState(actionId: string): InputActionState {
    return cloneState(this.stateByAction.get(actionId) ?? { pressed: false, held: false, released: false });
  }

  public getSnapshot(): {
    frame: number;
    actions: Record<string, InputActionState>;
    pressedCounts: Record<string, number>;
    releasedCounts: Record<string, number>;
    pointer?: { x: number; y: number; worldX: number; worldY: number };
    pointerDelta?: { dx: number; dy: number; dWorldX: number; dWorldY: number };
  } {
    const actions: Record<string, InputActionState> = {};
    for (const [id, state] of this.stateByAction.entries()) actions[id] = cloneState(state);
    const pressedCounts: Record<string, number> = {};
    for (const [id, count] of this.pressedCountByAction.entries()) pressedCounts[id] = count;
    const releasedCounts: Record<string, number> = {};
    for (const [id, count] of this.releasedCountByAction.entries()) releasedCounts[id] = count;
    return {
      frame: this.frame,
      actions,
      pressedCounts,
      releasedCounts,
      ...(this.lastPointer ? { pointer: { ...this.lastPointer } } : {}),
      ...(this.pointerDelta ? { pointerDelta: { ...this.pointerDelta } } : {}),
    };
  }

  private computeActionsHeld(): Map<string, boolean> {
    const heldByAction = new Map<string, boolean>();
    const pads = this.opts.getGamepads?.() ?? [];

    for (const map of this.activeMaps) {
      for (const [actionId, bindings] of Object.entries(map.actions ?? {})) {
        if (!Array.isArray(bindings) || bindings.length === 0) continue;
        let held = false;
        for (const binding of bindings) {
          if (this.bindingHeld(binding, pads)) {
            held = true;
            break;
          }
        }
        if (held) heldByAction.set(actionId, true);
        else if (!heldByAction.has(actionId)) heldByAction.set(actionId, false);
      }
    }

    return heldByAction;
  }

  private bindingHeld(binding: InputBindingSpec, pads: Array<Gamepad | null>): boolean {
    switch (binding.device) {
      case 'keyboard': {
        for (const token of this.downKeys) {
          if (keyboardMatches(binding.key, token)) return true;
        }
        return false;
      }
      case 'mouse': {
        if (binding.event === 'up') return false;
        const targetButton =
          binding.button === 'left' ? 0 : binding.button === 'middle' ? 1 : 2;
        return this.downMouseButtons.has(targetButton);
      }
      case 'gamepad': {
        const parsed = parseGamepadControl(binding.control);
        if (!parsed) return false;
        for (const pad of pads) {
          if (!pad) continue;
          if (parsed.kind === 'button') {
            if (gamepadButtonPressed(pad, parsed.index)) return true;
          } else {
            const axis = pad.axes[parsed.index] ?? 0;
            const threshold = binding.threshold ?? 0.35;
            if (parsed.direction < 0 && axis < -threshold) return true;
            if (parsed.direction > 0 && axis > threshold) return true;
          }
        }
        return false;
      }
      case 'pointer':
        return false;
      default:
        return false;
    }
  }
}
