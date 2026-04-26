import { describe, expect, it } from 'vitest';
import type { InputActionMapSpec } from '../../src/model/types';
import { BasicInputService } from '../../src/runtime/services/BasicInputService';

describe('BasicInputService', () => {
  it('reports pressed/held/released across frames for a keyboard binding', () => {
    const map: InputActionMapSpec = {
      actions: {
        Jump: [{ device: 'keyboard', key: 'Space', event: 'held' }],
      },
    };

    const svc = new BasicInputService();
    svc.setActiveMaps([map]);

    svc.update();
    expect(svc.getActionState('Jump')).toEqual({ pressed: false, held: false, released: false });

    svc.handleKeyDown({ code: 'Space', key: ' ' });
    svc.update();
    expect(svc.getActionState('Jump')).toEqual({ pressed: true, held: true, released: false });

    svc.update();
    expect(svc.getActionState('Jump')).toEqual({ pressed: false, held: true, released: false });

    svc.handleKeyUp({ code: 'Space', key: ' ' });
    svc.update();
    expect(svc.getActionState('Jump')).toEqual({ pressed: false, held: false, released: true });

    svc.update();
    expect(svc.getActionState('Jump')).toEqual({ pressed: false, held: false, released: false });
  });

  it('supports gamepad button bindings (digital pads)', () => {
    const map: InputActionMapSpec = {
      actions: {
        Fire: [{ device: 'gamepad', control: 'button.0', event: 'down' }],
      },
    };

    const pad = {
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
      axes: [],
    } as any as Gamepad;

    const svc = new BasicInputService({
      getGamepads: () => [pad],
    });
    svc.setActiveMaps([map]);

    svc.update();
    expect(svc.getActionState('Fire')).toEqual({ pressed: false, held: false, released: false });

    pad.buttons[0] = { pressed: true, value: 1 } as any;
    svc.update();
    expect(svc.getActionState('Fire')).toEqual({ pressed: true, held: true, released: false });

    svc.update();
    expect(svc.getActionState('Fire')).toEqual({ pressed: false, held: true, released: false });

    pad.buttons[0] = { pressed: false, value: 0 } as any;
    svc.update();
    expect(svc.getActionState('Fire')).toEqual({ pressed: false, held: false, released: true });
  });
});
