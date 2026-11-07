import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import type {
  AdminUser,
  CreateUserRequest,
  Role,
  UpdateUserRequest,
  UserStatus,
} from '@einlass/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { fmtDateTime, randomPassword } from '../../lib/format';
import { useApiMutation } from '../../lib/mutation';

const KEY = ['admin', 'users'];

const STATUS: Record<UserStatus, { color: string; label: string }> = {
  ACTIVE: { color: 'green', label: 'aktiv' },
  LOCKED: { color: 'orange', label: 'gesperrt (Fehlversuche)' },
  DISABLED: { color: 'red', label: 'deaktiviert' },
  EXPIRED: { color: 'default', label: 'abgelaufen' },
};

interface FormValues {
  name: string;
  password?: string;
  role: Role;
  validUntil?: Dayjs | null;
  disabled?: boolean;
}

/** Schnellauswahl "gültig bis": Ende der Nacht (06:00 Uhr) */
const nextMorning = (days = 1) =>
  dayjs()
    .add(dayjs().hour() < 6 ? days - 1 : days, 'day')
    .hour(6)
    .minute(0)
    .second(0);

function UserForm({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const { user: me } = useAuth();
  const isSelf = user?.id === me?.id;

  const save = useApiMutation(
    async (v: FormValues) => {
      const validUntil = v.validUntil ? v.validUntil.toISOString() : null;
      if (!user) {
        const body: CreateUserRequest = {
          name: v.name,
          password: v.password!,
          role: v.role,
          validUntil,
        };
        return api<AdminUser>('/admin/users', { method: 'POST', body });
      }
      const body: UpdateUserRequest = {
        name: v.name,
        ...(isSelf ? {} : { role: v.role, disabled: v.disabled, validUntil }),
        ...(v.password ? { password: v.password } : {}),
      };
      return api<AdminUser>(`/admin/users/${user.id}`, { method: 'PATCH', body });
    },
    { invalidate: [KEY], success: user ? 'Gespeichert' : 'Angelegt' },
  );

  return (
    <Modal
      open={open}
      title={user ? `${user.name} bearbeiten` : 'Neue Person'}
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
          user
            ? {
                name: user.name,
                role: user.role,
                disabled: user.disabled,
                validUntil: user.validUntil ? dayjs(user.validUntil) : null,
              }
            : { role: 'CONTROLLER', validUntil: nextMorning(), password: randomPassword() }
        }
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, min: 2, max: 50 }]}>
          <Input autoComplete="off" autoCapitalize="none" />
        </Form.Item>

        <Form.Item
          label={user ? 'Neues Passwort (leer lassen = unverändert)' : 'Passwort'}
          required={!user}
        >
          <Flex gap={8}>
            <Form.Item
              name="password"
              noStyle
              rules={[{ required: !user, min: 8, message: 'Mindestens 8 Zeichen' }]}
            >
              <Input autoComplete="new-password" style={{ fontFamily: 'monospace' }} />
            </Form.Item>
            <Button
              icon={<ThunderboltOutlined />}
              aria-label="Passwort erzeugen"
              onClick={() => form.setFieldValue('password', randomPassword())}
            />
          </Flex>
        </Form.Item>

        {!isSelf && (
          <>
            <Form.Item name="role" label="Rolle">
              <Segmented
                block
                options={[
                  { value: 'CONTROLLER', label: 'Kontrolle' },
                  { value: 'ADMIN', label: 'Admin' },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="validUntil"
              label="Gültig bis"
              extra="Danach ist keine Anmeldung mehr möglich. Leer = unbegrenzt."
            >
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="DD.MM.YYYY HH:mm"
                style={{ width: '100%' }}
                inputReadOnly
                presets={[
                  { label: 'Morgen 06:00', value: nextMorning() },
                  { label: 'Übermorgen 06:00', value: nextMorning(2) },
                  { label: 'In 7 Tagen', value: nextMorning(7) },
                ]}
              />
            </Form.Item>
            {user && (
              <Form.Item name="disabled" label="Deaktiviert" valuePropName="checked">
                <Switch />
              </Form.Item>
            )}
          </>
        )}
      </Form>
    </Modal>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const users = useQuery({ queryKey: KEY, queryFn: () => api<AdminUser[]>('/admin/users') });
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);

  const unlock = useApiMutation(
    (id: string) => api(`/admin/users/${id}`, { method: 'PATCH', body: { unlock: true } }),
    { invalidate: [KEY], success: 'Entsperrt' },
  );
  const remove = useApiMutation((id: string) => api(`/admin/users/${id}`, { method: 'DELETE' }), {
    invalidate: [KEY],
    success: 'Gelöscht',
  });

  return (
    <Flex vertical gap={12}>
      <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setCreating(true)}>
        Person anlegen
      </Button>

      {users.isPending && <Spin />}
      {users.data?.length === 0 && <Empty description="Noch niemand angelegt" />}

      {users.data?.map((u) => (
        <Card key={u.id} size="small">
          <Flex justify="space-between" align="start" gap={8}>
            <Flex vertical gap={4} style={{ minWidth: 0 }}>
              <Typography.Text strong style={{ fontSize: 17 }}>
                {u.name}{' '}
                {u.id === me?.id && <Typography.Text type="secondary">(du)</Typography.Text>}
              </Typography.Text>
              <Flex gap={4} wrap>
                <Tag color={u.role === 'ADMIN' ? 'gold' : 'blue'}>
                  {u.role === 'ADMIN' ? 'Admin' : 'Kontrolle'}
                </Tag>
                <Tag color={STATUS[u.status].color}>{STATUS[u.status].label}</Tag>
              </Flex>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                gültig bis {u.validUntil ? fmtDateTime(u.validUntil) : 'unbegrenzt'}
                <br />
                letzte Anmeldung {fmtDateTime(u.lastLoginAt)}
              </Typography.Text>
            </Flex>
            <Flex gap={4} style={{ flexShrink: 0 }}>
              {u.status === 'LOCKED' && (
                <Button
                  icon={<UnlockOutlined />}
                  aria-label="Entsperren"
                  onClick={() => unlock.mutate(u.id)}
                />
              )}
              <Button
                icon={<EditOutlined />}
                aria-label="Bearbeiten"
                onClick={() => setEditing(u)}
              />
              {u.id !== me?.id && (
                <Popconfirm
                  title={`${u.name} löschen?`}
                  okText="Löschen"
                  cancelText="Abbrechen"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove.mutate(u.id)}
                >
                  <Button danger icon={<DeleteOutlined />} aria-label="Löschen" />
                </Popconfirm>
              )}
            </Flex>
          </Flex>
        </Card>
      ))}

      <UserForm
        open={creating || editing !== null}
        user={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </Flex>
  );
}
