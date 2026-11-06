import { existsSync } from 'node:fs';
import { request } from 'node:http';
import type { FastifyBaseLogger } from 'fastify';

/** Zeitstatus, wie ihn einlass-hostd liefert (siehe infra/pi/files/einlass-hostd). */
export interface HostTimeStatus {
  systemTime: string;
  ntpSynchronized: boolean;
  rtcPresent: boolean;
  rtcTime: string | null;
  lastKnownTime: string | null;
  lastSetAt: string | null;
  lastRtcWrite: string | null;
}

export interface HostSetTimeResult {
  previous: string;
  now: string;
  driftSeconds: number;
  rtcWritten: boolean;
}

/** Zugriff auf Host-Funktionen, die der Container selbst nicht ausführen darf. */
export interface HostClient {
  readonly available: boolean;
  getTime(): Promise<HostTimeStatus | null>;
  setTime(time: Date, source: string): Promise<HostSetTimeResult>;
  shutdown(): Promise<void>;
  reboot(): Promise<void>;
}

export class HostUnavailableError extends Error {
  constructor(message = 'Host-Dienst nicht erreichbar') {
    super(message);
    this.name = 'HostUnavailableError';
  }
}

/** HTTP über den Unix-Socket von einlass-hostd. */
export class UnixSocketHostClient implements HostClient {
  readonly available = true;

  constructor(
    private readonly socketPath: string,
    private readonly timeoutMs = 5000,
  ) {}

  private call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = request(
        {
          socketPath: this.socketPath,
          path,
          method,
          headers: payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {},
          timeout: this.timeoutMs,
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            const status = res.statusCode ?? 0;
            let parsed: unknown;
            try {
              parsed = data ? JSON.parse(data) : {};
            } catch {
              reject(new HostUnavailableError(`Ungültige Antwort von hostd (${status})`));
              return;
            }
            if (status >= 200 && status < 300) resolve(parsed as T);
            else reject(new HostUnavailableError(`hostd ${method} ${path} → ${status}: ${data}`));
          });
        },
      );
      req.on('timeout', () =>
        req.destroy(new HostUnavailableError('Zeitüberschreitung bei hostd')),
      );
      req.on('error', (err) =>
        reject(err instanceof HostUnavailableError ? err : new HostUnavailableError(err.message)),
      );
      if (payload) req.write(payload);
      req.end();
    });
  }

  getTime() {
    return this.call<HostTimeStatus>('GET', '/time');
  }

  setTime(time: Date, source: string) {
    return this.call<HostSetTimeResult>('POST', '/time', { time: time.toISOString(), source });
  }

  async shutdown() {
    await this.call('POST', '/shutdown');
  }

  async reboot() {
    await this.call('POST', '/reboot');
  }
}

/** Ersatz in der Entwicklung (kein Pi): verändert nichts, meldet "nicht verfügbar". */
export class NoopHostClient implements HostClient {
  readonly available = false;

  async getTime() {
    return null;
  }

  async setTime(): Promise<HostSetTimeResult> {
    throw new HostUnavailableError('Kein Host-Dienst (Entwicklungsmodus)');
  }

  async shutdown() {
    throw new HostUnavailableError('Kein Host-Dienst (Entwicklungsmodus)');
  }

  async reboot() {
    throw new HostUnavailableError('Kein Host-Dienst (Entwicklungsmodus)');
  }
}

export function createHostClient(socketPath: string, log: FastifyBaseLogger): HostClient {
  if (existsSync(socketPath)) return new UnixSocketHostClient(socketPath);
  log.warn(
    { socketPath },
    'einlass-hostd nicht gefunden – Zeitabgleich und Herunterfahren deaktiviert',
  );
  return new NoopHostClient();
}
