import type { EvalTraceEvent, EvalTraceEventType } from "./types.ts";

export class EvalTrace {
  readonly events: EvalTraceEvent[] = [];

  add(type: EvalTraceEventType, data?: Record<string, unknown>): void {
    this.events.push({
      sequence: this.events.length + 1,
      timestamp: new Date().toISOString(),
      type,
      data,
    });
  }
}
