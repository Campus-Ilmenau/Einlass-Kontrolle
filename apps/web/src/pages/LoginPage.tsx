import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Form, Input, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ApiRequestError } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { FullPageSpinner, homeFor } from '../auth/guards';

interface LoginForm {
  name: string;
  password: string;
}

function errorText(err: unknown): string {
  if (!(err instanceof ApiRequestError)) return 'Anmeldung fehlgeschlagen';
  switch (err.code) {
    case 'INVALID': {
      const left = err.body.remainingAttempts;
      return typeof left === 'number'
        ? `Name oder Passwort falsch – noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'}`
        : 'Name oder Passwort falsch';
    }
    case 'LOCKED': {
      const until = typeof err.body.lockedUntil === 'string' ? dayjs(err.body.lockedUntil) : null;
      return until
        ? `Zu viele Fehlversuche – gesperrt bis ${until.format('HH:mm')} Uhr`
        : 'Zu viele Fehlversuche – vorübergehend gesperrt';
    }
    case 'DISABLED':
      return 'Dieses Konto ist deaktiviert';
    case 'EXPIRED':
      return 'Dieses Konto ist abgelaufen';
    case 'RATE_LIMITED':
      return 'Zu viele Anmeldeversuche – bitte kurz warten';
    default:
      return err.message;
  }
}

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <FullPageSpinner />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const onFinish = async ({ name, password }: LoginForm) => {
    setSubmitting(true);
    setError(null);
    try {
      const u = await login(name.trim(), password);
      navigate(homeFor(u.role), { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flex align="center" justify="center" style={{ minHeight: '100%', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <Flex vertical gap={4} style={{ marginBottom: 24 }}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Einlass-Kontrolle
          </Typography.Title>
          <Typography.Text type="secondary">Bitte anmelden</Typography.Text>
        </Flex>

        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

        <Form<LoginForm> layout="vertical" size="large" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name fehlt' }]}>
            <Input
              prefix={<UserOutlined />}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="Passwort"
            rules={[{ required: true, message: 'Passwort fehlt' }]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Anmelden
          </Button>
        </Form>
      </Card>
    </Flex>
  );
}
