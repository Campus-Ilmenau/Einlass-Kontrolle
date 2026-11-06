import multipart from '@fastify/multipart';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authenticate, requireRole } from '../auth/session.js';
import { adminEventRoutes } from './events.js';
import { adminListRoutes, IMPORT_MAX_BYTES } from './lists.js';
import { adminSettingsRoutes } from './settings.js';
import { adminUserRoutes } from './users.js';

/** Alle Admin-Endpunkte unter /api/admin – nur für angemeldete Admins. */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', authenticate(app));
  app.addHook('preHandler', requireRole('ADMIN'));

  await app.register(multipart, { limits: { fileSize: IMPORT_MAX_BYTES, files: 1, fields: 5 } });

  await app.register(adminUserRoutes, { prefix: '/users' });
  await app.register(adminListRoutes, { prefix: '/lists' });
  await app.register(adminEventRoutes, { prefix: '/events' });
  await app.register(adminSettingsRoutes, { prefix: '/settings' });
};
