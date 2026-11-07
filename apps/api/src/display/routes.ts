import { timingSafeEqual } from 'node:crypto';
import {
  DISPLAY_TIMELINE_MINUTES,
  type DisplayInfo,
  DisplayInfoSchema,
  type DisplayStats,
  DisplayStatsSchema,
} from '@einlass/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { findActiveEvent } from '../events/active-event.js';
import { ApiError } from '../http/errors.js';
import { computeEventStats } from '../stats/event-stats.js';

const HEARTBEAT_MS = 25_000;

function tokenMatches(expected: string, given: unknown): boolean {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Endpunkte für das Touch-Display am Pi. Geschützt durch DISPLAY_TOKEN (Query `token` oder
 * Header `X-Display-Token`), das nur der Kiosk kennt. Enthält keine Matrikelnummern.
 */
export const displayApiRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const expected = app.config.DISPLAY_TOKEN;
    if (!expected) throw new ApiError(404, 'DISPLAY_DISABLED', 'Display ist nicht eingerichtet');
    const given =
      (request.query as Record<string, unknown>)?.token ?? request.headers['x-display-token'];
    if (!tokenMatches(expected, given)) {
      return reply.code(401).send({ error: 'INVALID_TOKEN', message: 'Ungültiges Display-Token' });
    }
  });

  app.get(
    '/info',
    { schema: { response: { 200: DisplayInfoSchema } } },
    async (): Promise<DisplayInfo> => {
      const now = app.now();
      const event = await findActiveEvent(app.dataSource, now);
      const { WIFI_SSID, WIFI_PASSWORD, APP_URL } = app.config;
      return {
        serverTime: now.toISOString(),
        appUrl: APP_URL,
        wifi: WIFI_SSID ? { ssid: WIFI_SSID, password: WIFI_PASSWORD ?? '' } : null,
        event: event
          ? {
              name: event.name,
              startsAt: event.startsAt.toISOString(),
              endsAt: event.endsAt.toISOString(),
            }
          : null,
      };
    },
  );

  app.get(
    '/stats',
    { schema: { response: { 200: DisplayStatsSchema } } },
    async (): Promise<DisplayStats> => {
      const now = app.now();
      const event = await findActiveEvent(app.dataSource, now);
      if (!event) {
        return {
          event: null,
          persons: 0,
          scans: 0,
          freePersons: 0,
          perList: [],
          ageGroups: { U16: 0, U18: 0, ADULT: 0 },
          timeline: [],
        };
      }
      const stats = await computeEventStats(app.dataSource, event.id);

      // Scans je Abschnitt seit Beginn, lückenlos aufgefüllt
      const step = DISPLAY_TIMELINE_MINUTES * 60_000;
      const rows: { bucket: Date; scans: string }[] = await app.dataSource.query(
        `SELECT date_bin(make_interval(mins => $3), created_at, $2) AS bucket, count(*) AS scans
       FROM check_logs WHERE event_id = $1 GROUP BY 1 ORDER BY 1`,
        [event.id, event.startsAt, DISPLAY_TIMELINE_MINUTES],
      );
      const counts = new Map(rows.map((r) => [new Date(r.bucket).getTime(), Number(r.scans)]));
      const timeline: DisplayStats['timeline'] = [];
      const end = Math.min(now.getTime(), event.endsAt.getTime());
      for (let t = event.startsAt.getTime(); t <= end; t += step) {
        timeline.push({ at: new Date(t).toISOString(), scans: counts.get(t) ?? 0 });
      }

      return {
        event: {
          name: event.name,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
        },
        persons: stats.persons,
        scans: stats.scans,
        freePersons: stats.freePersons,
        perList: stats.perList.map((l) => ({ name: l.name, persons: l.persons })),
        ageGroups: stats.ageGroups,
        timeline,
      };
    },
  );

  /** Live-Stream (Server-Sent Events): Ereignis `scan` nach jeder Kontrolle. */
  app.get('/stream', async (request, reply) => {
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': verbunden\n\n');

    const unsubscribe = app.displayBus.subscribe((event) => {
      res.write(`event: scan\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    heartbeat.unref();

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
};
