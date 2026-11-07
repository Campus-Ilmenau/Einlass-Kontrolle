import {
  BarChartOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { Event, EventStatus, FreeList } from '@einlass/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  DatePicker,
  Divider,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api/client';
import { fmtRange } from '../../lib/format';
import { useApiMutation } from '../../lib/mutation';

export const EVENTS_KEY = ['admin', 'events'];
export const LISTS_KEY = ['admin', 'lists'];

const STATUS: Record<EventStatus, { color: string; label: string }> = {
  ACTIVE: { color: 'green', label: 'läuft' },
  PLANNED: { color: 'blue', label: 'geplant' },
  PAST: { color: 'default', label: 'vorbei' },
};

interface FormValues {
  name: string;
  range: [Dayjs, Dayjs];
  listIds: string[];
}

/** Vorschlag für einen neuen Abend: nächster Abend 21:00 bis 05:00 */
function defaultRange(): [Dayjs, Dayjs] {
  const start = dayjs().hour(21).minute(0).second(0);
  const s = dayjs().isAfter(start) ? start.add(1, 'day') : start;
  return [s, s.add(8, 'hour')];
}

function EventForm({
  open,
  event,
  onClose,
}: {
  open: boolean;
  event: Event | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const lists = useQuery({ queryKey: LISTS_KEY, queryFn: () => api<FreeList[]>('/admin/lists') });

  const save = useApiMutation(
    async (v: FormValues) => {
      const body = {
        name: v.name,
        startsAt: v.range[0].second(0).toISOString(),
        endsAt: v.range[1].second(0).toISOString(),
        listIds: v.listIds ?? [],
      };
      return event
        ? api<Event>(`/admin/events/${event.id}`, { method: 'PATCH', body })
        : api<Event>('/admin/events', { method: 'POST', body });
    },
    { invalidate: [EVENTS_KEY], success: event ? 'Gespeichert' : 'Veranstaltung angelegt' },
  );

  return (
    <Modal
      open={open}
      title={event ? 'Veranstaltung bearbeiten' : 'Neue Veranstaltung'}
      okText="Speichern"
      cancelText="Abbrechen"
      confirmLoading={save.isPending}
      destroyOnHidden
      onCancel={onClose}
      onOk={async () => {
        const values = await form.validateFields();
        await save.mutateAsync(values);
        onClose();
      }}
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={
          event
            ? {
                name: event.name,
                range: [dayjs(event.startsAt), dayjs(event.endsAt)],
                listIds: event.lists.map((l) => l.id),
              }
            : { range: defaultRange(), listIds: [] }
        }
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, max: 100 }]}>
          <Input placeholder="z. B. Freitagsparty" />
        </Form.Item>
        <Form.Item
          name="range"
          label="Beginn und Ende"
          rules={[{ required: true }]}
          extra="Während dieser Zeit ist Scannen möglich. Veranstaltungen dürfen sich nicht überschneiden."
        >
          <DatePicker.RangePicker
            showTime={{ format: 'HH:mm' }}
            format="DD.MM. HH:mm"
            style={{ width: '100%' }}
            inputReadOnly
          />
        </Form.Item>
        <Form.Item name="listIds" label="Freilisten (freier Eintritt)">
          <Select
            mode="multiple"
            loading={lists.isPending}
            placeholder="Keine"
            options={lists.data?.map((l) => ({
              value: l.id,
              label: `${l.name} (${l.entryCount})`,
            }))}
            optionFilterProp="label"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export function EventsPage() {
  const navigate = useNavigate();
  const events = useQuery({
    queryKey: EVENTS_KEY,
    queryFn: () => api<Event[]>('/admin/events'),
    refetchInterval: 60_000,
  });
  const [editing, setEditing] = useState<Event | null>(null);
  const [creating, setCreating] = useState(false);

  const end = useApiMutation((id: string) => api(`/admin/events/${id}/end`, { method: 'POST' }), {
    invalidate: [EVENTS_KEY],
    success: 'Veranstaltung beendet',
  });
  const remove = useApiMutation((id: string) => api(`/admin/events/${id}`, { method: 'DELETE' }), {
    invalidate: [EVENTS_KEY],
    success: 'Gelöscht',
  });

  // Laufende zuerst, dann geplante in zeitlicher Reihenfolge; vergangene neueste zuerst (API-Reihenfolge)
  const upcoming = (events.data?.filter((e) => e.status !== 'PAST') ?? []).sort(
    (a, b) =>
      Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') ||
      a.startsAt.localeCompare(b.startsAt),
  );
  const past = events.data?.filter((e) => e.status === 'PAST') ?? [];

  const renderEvent = (e: Event) => (
    <Card key={e.id} size="small">
      <Flex vertical gap={6}>
        <Flex justify="space-between" align="start" gap={8}>
          <Typography.Text strong style={{ fontSize: 17 }}>
            {e.name}
          </Typography.Text>
          <Tag color={STATUS[e.status].color} style={{ marginInlineEnd: 0 }}>
            {STATUS[e.status].label}
          </Tag>
        </Flex>
        <Typography.Text type="secondary">{fmtRange(e.startsAt, e.endsAt)}</Typography.Text>
        <Flex gap={4} wrap>
          {e.lists.length ? (
            e.lists.map((l) => (
              <Tag key={l.id} color="green">
                {l.name}
              </Tag>
            ))
          ) : (
            <Tag>keine Freilisten</Tag>
          )}
        </Flex>
        <Flex gap={8} wrap style={{ marginTop: 4 }}>
          <Button icon={<BarChartOutlined />} onClick={() => navigate(`/admin/events/${e.id}`)}>
            Statistik
          </Button>
          {e.status !== 'PAST' && (
            <Button icon={<EditOutlined />} onClick={() => setEditing(e)}>
              Bearbeiten
            </Button>
          )}
          {e.status === 'ACTIVE' && (
            <Popconfirm
              title="Veranstaltung jetzt beenden?"
              description="Danach ist kein Scannen mehr möglich."
              okText="Beenden"
              cancelText="Abbrechen"
              onConfirm={() => end.mutate(e.id)}
            >
              <Button icon={<StopOutlined />}>Beenden</Button>
            </Popconfirm>
          )}
          {e.status !== 'ACTIVE' && (
            <Popconfirm
              title={`„${e.name}“ löschen?`}
              description="Statistik und Scan-Protokoll werden mitgelöscht."
              okText="Löschen"
              cancelText="Abbrechen"
              okButtonProps={{ danger: true }}
              onConfirm={() => remove.mutate(e.id)}
            >
              <Button danger icon={<DeleteOutlined />} aria-label="Löschen" />
            </Popconfirm>
          )}
        </Flex>
      </Flex>
    </Card>
  );

  return (
    <Flex vertical gap={12}>
      <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
        Veranstaltung anlegen
      </Button>
      {events.isPending && <Spin />}
      {events.data && upcoming.length === 0 && (
        <Empty description="Keine geplanten Veranstaltungen" />
      )}
      {upcoming.map(renderEvent)}
      {past.length > 0 && (
        <>
          <Divider plain style={{ margin: '8px 0' }}>
            Vergangen
          </Divider>
          {past.map(renderEvent)}
        </>
      )}
      <EventForm
        open={creating || editing !== null}
        event={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </Flex>
  );
}
