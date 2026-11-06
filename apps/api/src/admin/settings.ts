import { type Settings, SettingsSchema, UpdateSettingsRequestSchema } from '@einlass/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { DataSource } from 'typeorm';
import { SettingSchema } from '../db/entities.js';

export const DEFAULT_SETTINGS: Settings = {
  checkLogRetentionDays: 7,
};

export async function readSettings(ds: DataSource): Promise<Settings> {
  const rows = await ds.getRepository(SettingSchema).find();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return SettingsSchema.parse({ ...DEFAULT_SETTINGS, ...stored });
}

export const adminSettingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/', { schema: { response: { 200: SettingsSchema } } }, async () =>
    readSettings(app.dataSource),
  );

  app.patch(
    '/',
    { schema: { body: UpdateSettingsRequestSchema, response: { 200: SettingsSchema } } },
    async (request) => {
      const entries = Object.entries(request.body).filter(([, v]) => v !== undefined);
      if (entries.length) {
        await app.dataSource.getRepository(SettingSchema).upsert(
          entries.map(([key, value]) => ({ key, value })),
          ['key'],
        );
        request.log.info({ settings: request.body }, 'Einstellungen geändert');
      }
      return readSettings(app.dataSource);
    },
  );
};
