import { ActionBase } from '../Action';
import type { VarsService } from '../services/RuntimeServices';
import type { RuntimeEntity, RuntimeTarget } from '../targets/types';
import { flattenTarget } from '../targets/resolveTarget';

export class AddSelfToCollection extends ActionBase {
  private fired = false;

  constructor(
    private readonly vars: VarsService,
    private readonly collectionId: string,
    private readonly targets: RuntimeTarget | RuntimeEntity[]
  ) {
    super();
  }

  start(): void {
    if (this.started) return;
    super.start();
    if (this.fired) return;
    const flat = Array.isArray(this.targets) ? this.targets : flattenTarget(this.targets);
    for (const t of flat) {
      this.vars.addToCollection(this.collectionId, { type: 'entity', entityId: (t as any).id });
    }
    this.fired = true;
    this.complete = true;
  }

  reset(): void {
    super.reset();
    this.fired = false;
  }
}

