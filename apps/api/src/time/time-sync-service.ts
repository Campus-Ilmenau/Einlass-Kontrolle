import { decideTimeSync, type TimeSyncResult } from '@einlass/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { DataSource } from 'typeorm';
import { EventSchema, TimeSyncLogSchema, type TimeSyncSource } from '../db/entities.js';
import type { HostClient } from '../host/hostd-client.js';

export interface TimeSyncDeps {
  dataSource: DataSource;
  host: HostClient;
  now: () => Date;
  log: FastifyBaseLogger;
}

/**
 * Automatischer Zeitabgleich mit der Uhr eines angemeldeten Clients.
 * Entscheidung: `decideTimeSync` (packages/shared). Ausführung: einlass-hostd.
 */
export class TimeSyncService {
  constructor(private readonly deps: TimeSyncDeps) {}

  async isEventActive(at: Date): Promise<boolean> {
    return this.deps.dataSource
      .getRepository(EventSchema)
      .createQueryBuilder('e')
      .where('e.starts_at <= :at AND e.ends_at > :at', { at })
      .getExists();
  }

  private async lastAdjustmentAt(): Promise<Date | null> {
    const last = await this.deps.dataSource.getRepository(TimeSyncLogSchema).findOne({
      where: { action: 'adjusted' },
      order: { createdAt: 'DESC' },
    });
    return last?.createdAt ?? null;
  }

  async sync(input: {
    clientTime: Date;
    source: TimeSyncSource;
    userId: string | null;
  }): Promise<TimeSyncResult> {
    const { dataSource, host, now, log } = this.deps;
    const serverNow = now();

    const hostTime = await host.getTime().catch((err: unknown) => {
      log.warn({ err }, 'Zeitstatus von hostd nicht abrufbar');
      return null;
    });

    const decision = decideTimeSync({
      serverNow,
      clientTime: input.clientTime,
      lastKnownTime: hostTime?.lastKnownTime ? new Date(hostTime.lastKnownTime) : null,
      lastAdjustmentAt: await this.lastAdjustmentAt(),
      eventActive: await this.isEventActive(serverNow),
    });

    let action = decision.action;
    let reason: string | undefined = decision.reason;

    if (action === 'adjusted') {
      if (!host.available) {
        action = 'warning';
        reason = 'HOST_UNAVAILABLE';
      } else {
        try {
          await host.setTime(decision.targetTime!, input.source.toLowerCase());
          log.info(
            { driftSeconds: decision.driftSeconds, large: decision.largeCorrection },
            'Systemzeit per Client-Abgleich korrigiert',
          );
          if (decision.largeCorrection) reason = 'LARGE_CORRECTION';
        } catch (err) {
          log.error({ err }, 'Systemzeit konnte nicht gesetzt werden');
          action = 'warning';
          reason = 'HOST_UNAVAILABLE';
        }
      }
    }

    if (action !== 'none') {
      await dataSource.getRepository(TimeSyncLogSchema).insert({
        source: input.source,
        userId: input.userId,
        serverTimeBefore: serverNow,
        clientTime: input.clientTime,
        driftSeconds: decision.driftSeconds,
        action,
        reason: reason ?? null,
        // createdAt bewusst nach der Korrektur: Basis für die Sperrzeit
        createdAt: now(),
      });
    }

    return {
      action,
      driftSeconds: decision.driftSeconds,
      ...(reason && action !== 'none' ? { reason } : {}),
      serverTime: now().toISOString(),
    };
  }
}
