import {
  AddEntriesRequestSchema,
  AddEntriesResultSchema,
  EntriesPageSchema,
  EntriesQuerySchema,
  type FreeList,
  FreeListRequestSchema,
  FreeListSchema,
  type ImportReport,
  ImportModeSchema,
  ImportReportSchema,
  UpdateFreeListRequestSchema,
} from '@einlass/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { EntityManager } from 'typeorm';
import { z } from 'zod';
import { FreeListEntrySchema, FreeListSchema as FreeListEntity } from '../db/entities.js';
import { badRequest, notFound } from '../http/errors.js';
import { detectFormat, extractMatrikel, readRows } from './import-parser.js';

const IdParams = z.object({ id: z.uuid() });
const EntryParams = z.object({ id: z.uuid(), entryId: z.uuid() });

/** Maximale Größe einer Import-Datei */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
/** So viele ungültige Zeilen werden im Bericht einzeln aufgeführt */
const MAX_INVALID_IN_REPORT = 50;

interface ListRow {
  id: string;
  name: string;
  description: string | null;
  entry_count: string;
  created_at: Date;
  updated_at: Date;
}

const toDto = (r: ListRow, events: FreeList['events'] = []): FreeList => ({
  id: r.id,
  name: r.name,
  description: r.description,
  entryCount: Number(r.entry_count),
  events,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

const LIST_QUERY = `
  SELECT l.id, l.name, l.description, l.created_at, l.updated_at, count(e.id) AS entry_count
  FROM free_lists l LEFT JOIN free_list_entries e ON e.list_id = l.id`;

/** Fügt Nummern ein (Duplikate in der Liste werden übersprungen). Gibt die Zahl neuer Einträge zurück. */
async function insertEntries(em: EntityManager, listId: string, values: string[]): Promise<number> {
  if (values.length === 0) return 0;
  const rows: unknown[] = await em.query(
    `INSERT INTO free_list_entries (list_id, matrikelnummer)
     SELECT $1, unnest($2::text[])
     ON CONFLICT (list_id, matrikelnummer) DO NOTHING
     RETURNING id`,
    [listId, values],
  );
  return rows.length;
}

export const adminListRoutes: FastifyPluginAsyncZod = async (app) => {
  const ds = () => app.dataSource;

  /** Laufende und geplante Veranstaltungen je Liste (für Hinweise in der Oberfläche) */
  const eventsByList = async (listIds: string[]) => {
    const map = new Map<string, FreeList['events']>();
    if (listIds.length === 0) return map;
    const rows: { list_id: string; id: string; name: string; active: boolean }[] = await ds().query(
      `SELECT efl.list_id, e.id, e.name, e.starts_at <= $2 AS active
       FROM event_free_lists efl JOIN events e ON e.id = efl.event_id
       WHERE efl.list_id = ANY($1::uuid[]) AND e.ends_at > $2
       ORDER BY e.starts_at`,
      [listIds, app.now()],
    );
    for (const r of rows) {
      const list = map.get(r.list_id) ?? [];
      list.push({ id: r.id, name: r.name, status: r.active ? 'ACTIVE' : 'PLANNED' });
      map.set(r.list_id, list);
    }
    return map;
  };

  const loadDto = async (id: string) => {
    const rows: ListRow[] = await ds().query(`${LIST_QUERY} WHERE l.id = $1 GROUP BY l.id`, [id]);
    if (!rows[0]) throw notFound('Liste');
    return toDto(rows[0], (await eventsByList([id])).get(id));
  };

  const ensureExists = async (id: string) => {
    if (!(await ds().getRepository(FreeListEntity).existsBy({ id }))) throw notFound('Liste');
  };

  app.get('/', { schema: { response: { 200: z.array(FreeListSchema) } } }, async () => {
    const rows: ListRow[] = await ds().query(`${LIST_QUERY} GROUP BY l.id ORDER BY l.name`);
    const events = await eventsByList(rows.map((r) => r.id));
    return rows.map((r) => toDto(r, events.get(r.id)));
  });

  app.post(
    '/',
    { schema: { body: FreeListRequestSchema, response: { 201: FreeListSchema } } },
    async (request, reply) => {
      const saved = await ds()
        .getRepository(FreeListEntity)
        .save({ name: request.body.name, description: request.body.description ?? null });
      return reply.code(201).send(await loadDto(saved.id));
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        params: IdParams,
        body: UpdateFreeListRequestSchema,
        response: { 200: FreeListSchema },
      },
    },
    async (request) => {
      await ensureExists(request.params.id);
      await ds().getRepository(FreeListEntity).update(request.params.id, request.body);
      return loadDto(request.params.id);
    },
  );

  app.delete('/:id', { schema: { params: IdParams } }, async (request, reply) => {
    const result = await ds().getRepository(FreeListEntity).delete(request.params.id);
    if (!result.affected) throw notFound('Liste');
    return reply.code(204).send();
  });

  // ─── Einträge ────────────────────────────────────────────────────────────

  app.get(
    '/:id/entries',
    {
      schema: {
        params: IdParams,
        querystring: EntriesQuerySchema,
        response: { 200: EntriesPageSchema },
      },
    },
    async (request) => {
      await ensureExists(request.params.id);
      const { search, page, pageSize } = request.query;
      const qb = ds()
        .getRepository(FreeListEntrySchema)
        .createQueryBuilder('e')
        .where('e.list_id = :id', { id: request.params.id });
      if (search) qb.andWhere('e.matrikelnummer LIKE :s', { s: `${search.replace(/\D/g, '')}%` });
      const [items, total] = await qb
        .orderBy('e.matrikelnummer')
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();
      return {
        items: items.map((e) => ({
          id: e.id,
          matrikelnummer: e.matrikelnummer,
          note: e.note,
          createdAt: e.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
      };
    },
  );

  app.post(
    '/:id/entries',
    {
      schema: {
        params: IdParams,
        body: AddEntriesRequestSchema,
        response: { 200: AddEntriesResultSchema },
      },
    },
    async (request) => {
      await ensureExists(request.params.id);
      const unique = [...new Set(request.body.matrikelnummern)];
      const added = await insertEntries(ds().manager, request.params.id, unique);
      return { added, alreadyInList: unique.length - added };
    },
  );

  app.delete(
    '/:id/entries/:entryId',
    { schema: { params: EntryParams } },
    async (request, reply) => {
      const result = await ds()
        .getRepository(FreeListEntrySchema)
        .delete({ id: request.params.entryId, listId: request.params.id });
      if (!result.affected) throw notFound('Eintrag');
      return reply.code(204).send();
    },
  );

  app.delete(
    '/:id/entries',
    { schema: { params: IdParams, response: { 200: z.object({ removed: z.number().int() }) } } },
    async (request) => {
      await ensureExists(request.params.id);
      const result = await ds()
        .getRepository(FreeListEntrySchema)
        .delete({ listId: request.params.id });
      return { removed: result.affected ?? 0 };
    },
  );

  // ─── Import (CSV / XLSX) ─────────────────────────────────────────────────

  app.post(
    '/:id/import',
    { schema: { params: IdParams, response: { 200: ImportReportSchema } } },
    async (request): Promise<ImportReport> => {
      const listId = request.params.id;
      await ensureExists(listId);

      const file = await request.file({ limits: { fileSize: IMPORT_MAX_BYTES, files: 1 } });
      if (!file) throw badRequest('NO_FILE', 'Keine Datei hochgeladen');
      const data = await file.toBuffer();
      if (file.file.truncated) throw badRequest('FILE_TOO_LARGE', 'Datei ist größer als 5 MB');

      const field = (name: string) => {
        const f = file.fields[name];
        const single = Array.isArray(f) ? f[0] : f;
        return single && 'value' in single ? String(single.value) : undefined;
      };
      const modeResult = ImportModeSchema.safeParse(field('mode') ?? 'append');
      if (!modeResult.success)
        throw badRequest('INVALID_MODE', 'mode muss append oder replace sein');
      const mode = modeResult.data;

      const format = detectFormat(file.filename, data);
      const extracted = extractMatrikel(await readRows(format, data), field('column'));
      const unique = [...new Set(extracted.values.map((v) => v.value))];

      const { added, removed } = await ds().transaction(async (em) => {
        let removed = 0;
        if (mode === 'replace') {
          // QueryBuilder statt em.query(): liefert die Anzahl zuverlässig als `affected`
          const result = await em
            .getRepository(FreeListEntrySchema)
            .createQueryBuilder()
            .delete()
            .where('list_id = :listId', { listId })
            .andWhere('NOT (matrikelnummer = ANY(:values::text[]))', { values: unique })
            .execute();
          removed = result.affected ?? 0;
        }
        const added = await insertEntries(em, listId, unique);
        await em.getRepository(FreeListEntity).update(listId, { updatedAt: new Date() });
        return { added, removed };
      });

      request.log.info(
        { listId, mode, format, added, removed, invalid: extracted.invalid.length },
        'Freiliste importiert',
      );
      return {
        mode,
        format,
        column: extracted.column,
        rows: extracted.rows,
        added,
        alreadyInList: unique.length - added,
        removed,
        duplicatesInFile: extracted.values.length - unique.length,
        invalid: extracted.invalid.slice(0, MAX_INVALID_IN_REPORT),
        invalidCount: extracted.invalid.length,
      };
    },
  );
};
