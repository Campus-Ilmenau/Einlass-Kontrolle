import { PlusOutlined, RightOutlined } from '@ant-design/icons';
import type { FreeList, FreeListRequest } from '@einlass/shared';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Checkbox, Empty, Flex, Form, Input, Modal, Spin, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation } from '../../lib/mutation';
import { LISTS_KEY } from './EventsPage';
import { ListEventTags, useAssignToActiveEvent } from './listEvents';

export function ListFormModal({
  open,
  list,
  onClose,
}: {
  open: boolean;
  list?: FreeList | null;
  onClose: (created?: FreeList) => void;
}) {
  const [form] = Form.useForm<FreeListRequest & { assign?: boolean }>();
  const { active, assign } = useAssignToActiveEvent();
  const save = useApiMutation(
    ({ name, description }: FreeListRequest) =>
      list
        ? api<FreeList>(`/admin/lists/${list.id}`, { method: 'PATCH', body: { name, description } })
        : api<FreeList>('/admin/lists', { method: 'POST', body: { name, description } }),
    { invalidate: [LISTS_KEY], success: list ? 'Gespeichert' : 'Liste angelegt' },
  );
  return (
    <Modal
      open={open}
      title={list ? 'Liste umbenennen' : 'Neue Freiliste'}
      okText="Speichern"
      cancelText="Abbrechen"
      confirmLoading={save.isPending}
      destroyOnHidden
      onCancel={() => onClose()}
      onOk={async () => {
        const values = await form.validateFields();
        const saved = await save.mutateAsync(values);
        // Neue Liste direkt der laufenden Veranstaltung zuordnen (sonst zählt sie heute nicht)
        if (!list && values.assign && active) await assign(saved.id).catch(() => undefined);
        onClose(saved);
      }}
    >
      <Form<FreeListRequest & { assign?: boolean }>
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={
          list ? { name: list.name, description: list.description ?? '' } : { assign: true }
        }
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, max: 100 }]}>
          <Input placeholder="z. B. Fachschaft EI" />
        </Form.Item>
        <Form.Item name="description" label="Beschreibung (optional)" rules={[{ max: 500 }]}>
          <Input.TextArea autoSize={{ minRows: 2 }} />
        </Form.Item>
        {!list && active && (
          <Form.Item name="assign" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>Der laufenden Veranstaltung „{active.name}“ zuordnen</Checkbox>
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

export function ListsPage() {
  const navigate = useNavigate();
  const lists = useQuery({ queryKey: LISTS_KEY, queryFn: () => api<FreeList[]>('/admin/lists') });
  const [creating, setCreating] = useState(false);

  return (
    <Flex vertical gap={12}>
      <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
        Liste anlegen
      </Button>
      {lists.isPending && <Spin />}
      {lists.data?.length === 0 && <Empty description="Noch keine Freilisten" />}
      {lists.data?.map((l) => (
        <Card key={l.id} size="small" hoverable onClick={() => navigate(`/admin/lists/${l.id}`)}>
          <Flex justify="space-between" align="center" gap={8}>
            <Flex vertical style={{ minWidth: 0 }}>
              <Typography.Text strong style={{ fontSize: 17 }} ellipsis>
                {l.name}
              </Typography.Text>
              <Typography.Text type="secondary">
                {l.entryCount} {l.entryCount === 1 ? 'Nummer' : 'Nummern'}
                {l.description ? ` · ${l.description}` : ''}
              </Typography.Text>
              <Flex gap={4} wrap style={{ marginTop: 4 }}>
                <ListEventTags list={l} />
              </Flex>
            </Flex>
            <RightOutlined />
          </Flex>
        </Card>
      ))}
      <ListFormModal
        open={creating}
        onClose={(created) => {
          setCreating(false);
          if (created) navigate(`/admin/lists/${created.id}`);
        }}
      />
    </Flex>
  );
}
