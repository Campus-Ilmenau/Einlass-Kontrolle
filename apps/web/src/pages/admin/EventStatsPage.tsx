import { ArrowLeftOutlined } from '@ant-design/icons';
import type { Event, EventStats } from '@einlass/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Flex, Progress, Row, Spin, Statistic, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router';
import { api } from '../../api/client';
import { fmtRange } from '../../lib/format';

export function EventStatsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const event = useQuery({
    queryKey: ['admin', 'events', id],
    queryFn: () => api<Event>(`/admin/events/${id}`),
  });
  const stats = useQuery({
    queryKey: ['admin', 'events', id, 'stats'],
    queryFn: () => api<EventStats>(`/admin/events/${id}/stats`),
    // Während der Veranstaltung live aktualisieren
    refetchInterval: event.data?.status === 'ACTIVE' ? 15_000 : false,
  });

  const s = stats.data;
  const ageTotal = s ? s.ageGroups.U16 + s.ageGroups.U18 + s.ageGroups.ADULT : 0;
  const pct = (n: number) => (ageTotal ? Math.round((n / ageTotal) * 100) : 0);

  return (
    <Flex vertical gap={12}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/admin/events')}
        style={{ alignSelf: 'start' }}
      >
        Veranstaltungen
      </Button>
      {event.data && (
        <Flex vertical>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {event.data.name}
          </Typography.Title>
          <Typography.Text type="secondary">
            {fmtRange(event.data.startsAt, event.data.endsAt)}
          </Typography.Text>
        </Flex>
      )}
      {(stats.isPending || event.isPending) && <Spin />}
      {s?.archived && (
        <Alert
          type="info"
          showIcon
          message="Das Scan-Protokoll ist bereits gelöscht (Aufbewahrungsfrist). Angezeigt wird die gesicherte Zusammenfassung."
        />
      )}
      {s && (
        <>
          <Row gutter={[12, 12]}>
            <Col span={12}>
              <Card size="small">
                <Statistic title="Personen" value={s.persons} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic title="davon frei" value={s.freePersons} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic title="Scans" value={s.scans} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic title="Doppel-Scans" value={s.repeatedScans} />
              </Card>
            </Col>
          </Row>

          <Card size="small" title="Altersstufen">
            <Flex vertical gap={8}>
              {(
                [
                  ['18+', s.ageGroups.ADULT, '#52c41a'],
                  ['16–17 (U18)', s.ageGroups.U18, '#fa8c16'],
                  ['unter 16', s.ageGroups.U16, '#f5222d'],
                ] as const
              ).map(([label, n, color]) => (
                <div key={label}>
                  <Flex justify="space-between">
                    <span>{label}</span>
                    <strong>{n}</strong>
                  </Flex>
                  <Progress percent={pct(n)} showInfo={false} strokeColor={color} />
                </div>
              ))}
            </Flex>
          </Card>

          <Card size="small" title="Freier Eintritt je Liste">
            {s.perList.length === 0 && (
              <Typography.Text type="secondary">Keine Listen</Typography.Text>
            )}
            {s.perList.map((l) => (
              <Flex key={l.id} justify="space-between" style={{ padding: '4px 0' }}>
                <span>{l.name}</span>
                <strong>{l.persons}</strong>
              </Flex>
            ))}
          </Card>

          <Card size="small" title="Scans je Kontrolleur:in">
            {s.perUser.length === 0 && (
              <Typography.Text type="secondary">Noch keine Scans</Typography.Text>
            )}
            {s.perUser.map((u) => (
              <Flex key={u.name} justify="space-between" style={{ padding: '4px 0' }}>
                <span>{u.name}</span>
                <strong>{u.scans}</strong>
              </Flex>
            ))}
          </Card>
        </>
      )}
    </Flex>
  );
}
