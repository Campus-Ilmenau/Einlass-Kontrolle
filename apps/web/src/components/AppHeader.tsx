import { LogoutOutlined } from '@ant-design/icons';
import { Button, Flex, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';

/** Kopfzeile: Titel, angemeldete Person, Abmelden. */
export function AppHeader({ title, extra }: { title: ReactNode; extra?: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <Flex
      align="center"
      justify="space-between"
      gap={12}
      style={{
        padding: '12px 16px',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: '#141414',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <Flex vertical style={{ minWidth: 0 }}>
        <Typography.Text strong style={{ fontSize: 18 }} ellipsis>
          {title}
        </Typography.Text>
        {extra}
      </Flex>
      <Flex align="center" gap={8} style={{ flexShrink: 0 }}>
        {user && (
          <Tag color={user.role === 'ADMIN' ? 'gold' : 'blue'} style={{ marginInlineEnd: 0 }}>
            {user.name}
          </Tag>
        )}
        <Button
          aria-label="Abmelden"
          icon={<LogoutOutlined />}
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        />
      </Flex>
    </Flex>
  );
}
