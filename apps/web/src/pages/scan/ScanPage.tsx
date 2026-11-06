import { LockOutlined, ScanOutlined } from '@ant-design/icons';
import type { CheckContext } from '@einlass/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, Flex, Result, Spin, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { api } from '../../api/client';
import { AppHeader } from '../../components/AppHeader';

/** Kontext der Kontrolle: aktive Veranstaltung (alle 30 s neu, damit Beginn/Ende erkannt werden). */
export function useCheckContext() {
  return useQuery({
    queryKey: ['checks', 'context'],
    queryFn: () => api<CheckContext>('/checks/context'),
    refetchInterval: 30_000,
  });
}

export function ScanPage() {
  const context = useCheckContext();
  const event = context.data?.event;

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader
        title={event ? event.name : 'Kontrolle'}
        extra={
          event && (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              bis {dayjs(event.endsAt).format('HH:mm')} Uhr
            </Typography.Text>
          )
        }
      />
      <Flex vertical flex={1} align="center" justify="center" style={{ padding: 16 }}>
        {context.isPending && <Spin size="large" />}
        {context.isError && (
          <Alert
            type="error"
            showIcon
            message="Keine Verbindung zum Pi"
            description="WLAN prüfen"
          />
        )}
        {context.data && !event && (
          <Result
            icon={<LockOutlined />}
            title="Keine Veranstaltung aktiv"
            subTitle="Scannen ist erst möglich, wenn eine Veranstaltung läuft."
          />
        )}
        {event && (
          <Result
            icon={<ScanOutlined />}
            title="Bereit zum Scannen"
            subTitle={
              <Flex vertical gap={8} align="center">
                <span>Die Scan-Funktion folgt im nächsten Schritt.</span>
                <Flex gap={4} wrap justify="center">
                  {event.lists.length ? (
                    event.lists.map((l) => (
                      <Tag key={l.id} color="green">
                        {l.name}
                      </Tag>
                    ))
                  ) : (
                    <Tag>Keine Freilisten</Tag>
                  )}
                </Flex>
              </Flex>
            }
          />
        )}
      </Flex>
    </div>
  );
}
