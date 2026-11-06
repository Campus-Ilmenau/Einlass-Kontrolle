import { PlusOutlined, RightOutlined } from '@ant-design/icons';
import type { FreeList, FreeListRequest } from '@einlass/shared';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Empty, Flex, Form, Input, Modal, Spin, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation } from '../../lib/mutation';
import { LISTS_KEY } from './EventsPage';

export function ListFormModal({
  open,
  list,
  onClose,
}: {
  open: boolean;
  list?: FreeList | null;
  onClose: (created?: FreeList) => void;
}) {
  const [form] = Form.useForm<FreeListRequest>();
  const save = useApiMutation(
    (v: FreeListRequest) =>
      list
        ? api<FreeList>(`/admin/lists/${list.id}`, { method: 'PATCH', body: v })
        : api<FreeList>('/admin/lists', { method: 'POST', body: v }),
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
        onClose(await save.mutateAsync(values));
      }}
    >
      <Form<FreeListRequest>
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={list ? { name: list.name, description: list.description ?? '' } : {}}
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, max: 100 }]}>
          <Input placeholder="z. B. Fachschaft EI" />
        </Form.Item>
        <Form.Item name="description" label="Beschreibung (optional)" rules={[{ max: 500 }]}>
          <Input.TextArea autoSize={{ minRows: 2 }} />
        </Form.Item>
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
