import { DisplayStatusSchema } from '@einlass/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { findActiveEvent } from '../events/active-event.js';

/**
 * Öffentlicher Status für das Display am Pi (ohne Anmeldung).
 * Enthält bewusst keine personenbezogenen Daten: nur Name/Ende der Veranstaltung und eine Zahl.
 */
export const displayRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/display', { schema: { response: { 200: DisplayStatusSchema } } }, async () => {
    const now = app.now();
    const event = await findActiveEvent(app.dataSource, now);
    let persons = 0;
    if (event) {
      const [row] = await app.dataSource.query(
        `SELECT count(DISTINCT matrikel_hash) AS persons FROM check_logs WHERE event_id = $1`,
        [event.id],
      );
      persons = Number(row?.persons ?? 0);
    }
    return {
      serverTime: now.toISOString(),
      event: event ? { name: event.name, endsAt: event.endsAt.toISOString() } : null,
      persons,
    };
  });
};
