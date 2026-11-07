import { EventEmitter } from 'node:events';
import type { DisplayScanEvent } from '@einlass/shared';

/** Verteilt Scan-Ergebnisse live an verbundene Displays (ein API-Prozess → In-Memory reicht). */
export class DisplayBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Mehrere Displays/Browser-Tabs sind erlaubt
    this.emitter.setMaxListeners(50);
  }

  publish(event: DisplayScanEvent): void {
    this.emitter.emit('scan', event);
  }

  subscribe(listener: (event: DisplayScanEvent) => void): () => void {
    this.emitter.on('scan', listener);
    return () => this.emitter.off('scan', listener);
  }

  get listeners(): number {
    return this.emitter.listenerCount('scan');
  }
}
