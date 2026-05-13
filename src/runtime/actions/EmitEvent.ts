import { ActionBase } from '../Action';

type Payload = Record<string, number | string | boolean | null>;

export class EmitEvent extends ActionBase {
  private eventName: string;
  private payload: Payload;
  private emit: (eventName: string, payload: Payload) => void;

  constructor(eventName: string, payload: Payload, emit: (eventName: string, payload: Payload) => void) {
    super();
    this.eventName = eventName;
    this.payload = payload;
    this.emit = emit;
  }

  start(): void {
    if (this.started) return;
    super.start();
    this.emit(this.eventName, this.payload);
    this.complete = true;
  }
}

