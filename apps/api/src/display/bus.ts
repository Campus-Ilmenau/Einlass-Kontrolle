import { EventEmitter } from 'node:events';
import type { DisplayNextEvent, DisplayScanEvent } from '@einlass/shared';

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

  /** Kontrolleur:in hat das Ergebnis weggetippt → "Nächster bitte" auf dem Display */
  publishNext(event: DisplayNextEvent): void {
    this.emitter.emit('next', event);
  }

  subscribeNext(listener: (event: DisplayNextEvent) => void): () => void {
    this.emitter.on('next', listener);
    return () => this.emitter.off('next', listener);
  }

  get listeners(): number {
    return this.emitter.listenerCount('scan');
  }
}
