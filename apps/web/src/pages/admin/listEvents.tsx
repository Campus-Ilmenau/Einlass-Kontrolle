import type { Event, FreeList } from '@einlass/shared';
import { useQuery } from '@tanstack/react-query';
import { Tag } from 'antd';
import { api } from '../../api/client';
import { useApiMutation } from '../../lib/mutation';
import { EVENTS_KEY, LISTS_KEY } from './EventsPage';

/** Die gerade laufende Veranstaltung (aus der Liste aller Veranstaltungen) */
export function useActiveEvent(): Event | null {
  const events = useQuery({ queryKey: EVENTS_KEY, queryFn: () => api<Event[]>('/admin/events') });
  return events.data?.find((e) => e.status === 'ACTIVE') ?? null;
}

/** Freiliste der laufenden Veranstaltung zuordnen (bestehende Zuordnungen bleiben). */
export function useAssignToActiveEvent() {
  const active = useActiveEvent();
  const mutation = useApiMutation(
    async (listId: string) => {
      if (!active) throw new Error('Keine laufende Veranstaltung');
      const listIds = [...new Set([...active.lists.map((l) => l.id), listId])];
      return api<Event>(`/admin/events/${active.id}`, { method: 'PATCH', body: { listIds } });
    },
    {
      invalidate: [EVENTS_KEY, LISTS_KEY],
      success: (e) => `Liste ist jetzt „${e.name}“ zugeordnet`,
    },
  );
  return { active, assign: mutation.mutateAsync, pending: mutation.isPending };
}

/** Tags: in welchen Veranstaltungen die Liste verwendet wird – oder Warnung, wenn in keiner. */
export function ListEventTags({ list }: { list: FreeList }) {
  if (list.events.length === 0) {
    return <Tag color="warning">keiner Veranstaltung zugeordnet</Tag>;
  }
  return (
    <>
      {list.events.map((e) => (
        <Tag key={e.id} color={e.status === 'ACTIVE' ? 'green' : 'blue'}>
          {e.name} · {e.status === 'ACTIVE' ? 'läuft' : 'geplant'}
        </Tag>
      ))}
    </>
  );
}
