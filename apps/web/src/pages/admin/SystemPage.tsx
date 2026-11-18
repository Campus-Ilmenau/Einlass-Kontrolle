import {
  ClockCircleOutlined,
  CloudDownloadOutlined,
  PoweroffOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type {
  Settings,
  SystemTime,
  SystemUpdate,
  TimeSyncLogEntry,
  UpdateResult,
} from '@einlass/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Flex,
  InputNumber,
  List,
  Popconfirm,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { fmtDateTime } from '../../lib/format';
import { useApiMutation } from '../../lib/mutation';

const TIME_KEY = ['admin', 'system', 'time'];
const LOG_KEY = ['admin', 'system', 'time-log'];
const SETTINGS_KEY = ['admin', 'settings'];
const UPDATE_KEY = ['admin', 'system', 'update'];

const SOURCE: Record<TimeSyncLogEntry['source'], string> = {
  LOGIN: 'Anmeldung',
  ME: 'App geöffnet',
  ADMIN: 'manuell',
  NTP: 'Internet',
};

function TimeCard() {
  const time = useQuery({
    queryKey: TIME_KEY,
    queryFn: () => api<SystemTime>('/admin/system/time'),
    refetchInterval: 10_000,
  });
  const [now, setNow] = useState(dayjs());
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(t);
  }, []);

  const setTime = useApiMutation(
    () => api('/admin/system/time', { method: 'POST', body: { time: new Date().toISOString() } }),
    { invalidate: [TIME_KEY, LOG_KEY], success: 'Systemzeit übernommen' },
  );

  const t = time.data;
  // Abweichung Server ↔ Gerät (grob, Abfrage ist bis zu 10 s alt)
  const drift = t ? Math.round((dayjs(t.serverTime).valueOf() - Date.now()) / 1000) : 0;

  return (
    <Card
      size="small"
      title={
        <>
          <ClockCircleOutlined /> Uhrzeit
        </>
      }
    >
      <Descriptions
        column={1}
        size="small"
        items={[
          { label: 'Pi', children: t ? dayjs(t.serverTime).format('DD.MM.YYYY HH:mm:ss') : '…' },
          { label: 'Dieses Gerät', children: now.format('DD.MM.YYYY HH:mm:ss') },
          {
            label: 'Internet-Zeit (NTP)',
            children:
              t?.ntpSynchronized == null ? (
                '–'
              ) : t.ntpSynchronized ? (
                <Tag color="green">synchron</Tag>
              ) : (
                <Tag>nein</Tag>
              ),
          },
          {
            label: 'RTC-Modul',
            children:
              t?.rtcPresent == null ? (
                '–'
              ) : t.rtcPresent ? (
                <Tag color="green">vorhanden</Tag>
              ) : (
                <Tag color="orange">fehlt</Tag>
              ),
          },
        ]}
      />
      {t && !t.hostd && (
        <Alert
          type="warning"
          showIcon
          message="Host-Dienst nicht erreichbar – Zeit kann nicht gesetzt werden"
        />
      )}
      {t && Math.abs(drift) > 30 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 8 }}
          message={`Abweichung ca. ${Math.round(Math.abs(drift) / 60)} min ${drift > 0 ? 'vor' : 'nach'}`}
        />
      )}
      <Popconfirm
        title="Uhrzeit dieses Geräts für den Pi übernehmen?"
        description={now.format('DD.MM.YYYY HH:mm:ss')}
        okText="Übernehmen"
        cancelText="Abbrechen"
        onConfirm={() => setTime.mutate(undefined)}
        disabled={!t?.hostd}
      >
        <Button block style={{ marginTop: 12 }} loading={setTime.isPending} disabled={!t?.hostd}>
          Zeit von diesem Gerät übernehmen
        </Button>
      </Popconfirm>
    </Card>
  );
}

function TimeLogCard() {
  const log = useQuery({
    queryKey: LOG_KEY,
    queryFn: () => api<TimeSyncLogEntry[]>('/admin/system/time-log'),
  });
  return (
    <Card size="small" title="Zeitabgleich-Protokoll">
      <List
        size="small"
        loading={log.isPending}
        dataSource={log.data?.slice(0, 20) ?? []}
        locale={{ emptyText: 'Bisher keine Korrekturen' }}
        renderItem={(e) => (
          <List.Item>
            <Flex vertical style={{ width: '100%' }}>
              <Flex justify="space-between" gap={8}>
                <span>{fmtDateTime(e.createdAt)}</span>
                <Tag
                  color={
                    e.action === 'adjusted' ? 'green' : e.action === 'warning' ? 'orange' : 'red'
                  }
                  style={{ marginInlineEnd: 0 }}
                >
                  {e.action === 'adjusted'
                    ? 'korrigiert'
                    : e.action === 'warning'
                      ? 'Warnung'
                      : 'abgelehnt'}
                </Tag>
              </Flex>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {SOURCE[e.source]}
                {e.userName ? ` · ${e.userName}` : ''} · Abweichung {Math.round(e.driftSeconds)} s
                {e.reason ? ` · ${e.reason}` : ''}
              </Typography.Text>
            </Flex>
          </List.Item>
        )}
      />
    </Card>
  );
}

function SettingsCard() {
  const settings = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => api<Settings>('/admin/settings'),
  });
  const [days, setDays] = useState<number | null>(null);
  const save = useApiMutation(
    (checkLogRetentionDays: number) =>
      api<Settings>('/admin/settings', { method: 'PATCH', body: { checkLogRetentionDays } }),
    { invalidate: [SETTINGS_KEY], success: 'Gespeichert' },
  );
  const value = days ?? settings.data?.checkLogRetentionDays ?? null;

  return (
    <Card size="small" title="Datenschutz">
      <Typography.Paragraph type="secondary">
        Scan-Protokolle beendeter Veranstaltungen werden nach dieser Frist gelöscht. Die Statistik
        bleibt erhalten.
      </Typography.Paragraph>
      <Flex gap={8}>
        <InputNumber
          min={1}
          max={365}
          value={value}
          onChange={(v) => setDays(v)}
          addonAfter="Tage"
          style={{ flex: 1 }}
          inputMode="numeric"
        />
        <Button
          type="primary"
          disabled={days === null || days === settings.data?.checkLogRetentionDays}
          loading={save.isPending}
          onClick={() => days && save.mutate(days)}
        >
          Speichern
        </Button>
      </Flex>
    </Card>
  );
}

const UPDATE_RESULT: Record<UpdateResult, { color: string; label: string }> = {
  current: { color: 'green', label: 'aktuell' },
  updated: { color: 'green', label: 'aktualisiert' },
  skipped: { color: 'orange', label: 'verschoben' },
  'rolled-back': { color: 'red', label: 'zurückgerollt' },
  failed: { color: 'red', label: 'fehlgeschlagen' },
  offline: { color: 'default', label: 'kein Internet' },
};

/** Neueste Version (Stand main) aus dem Repository holen: Images ziehen, Backup, Neustart */
function UpdateCard() {
  // Nach dem Start: schneller abfragen, bis das Update durch ist (API startet dabei kurz neu)
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const update = useQuery({
    queryKey: UPDATE_KEY,
    queryFn: () => api<SystemUpdate>('/admin/system/update'),
    refetchInterval: (q) => (startedAt || q.state.data?.running ? 3000 : 30_000),
    retry: false,
  });
  const u = update.data;
  const finished =
    startedAt !== null &&
    u !== undefined &&
    !u.running &&
    u.lastRun !== null &&
    dayjs(u.lastRun).valueOf() >= startedAt - 5000;
  useEffect(() => {
    if (finished) setStartedAt(null);
  }, [finished]);
  // Läuft länger als 20 min → nicht mehr warten
  useEffect(() => {
    if (startedAt === null) return;
    const t = setTimeout(() => setStartedAt(null), 20 * 60_000);
    return () => clearTimeout(t);
  }, [startedAt]);

  const start = useApiMutation(
    (force: boolean) =>
      api<SystemUpdate>('/admin/system/update', { method: 'POST', body: { force } }),
    { invalidate: [UPDATE_KEY], success: 'Update gestartet' },
  );
  const run = (force: boolean) =>
    start.mutate(force, { onSuccess: () => setStartedAt(Date.now()) });

  const running = startedAt !== null || (u?.running ?? false);
  const result = u?.result ? UPDATE_RESULT[u.result] : null;

  return (
    <Card
      size="small"
      title={
        <>
          <CloudDownloadOutlined /> App-Update
        </>
      }
    >
      <Typography.Paragraph type="secondary">
        Holt den neuesten Stand (main) aus dem Repository. Vorher wird die Datenbank gesichert;
        startet die neue Version nicht, wird automatisch die alte wiederhergestellt.
      </Typography.Paragraph>
      <Descriptions
        column={1}
        size="small"
        items={[
          { label: 'Letzte Prüfung', children: u?.lastRun ? fmtDateTime(u.lastRun) : '–' },
          {
            label: 'Ergebnis',
            children: result ? <Tag color={result.color}>{result.label}</Tag> : '–',
          },
          ...(u?.message ? [{ label: 'Meldung', children: u.message }] : []),
        ]}
      />
      {u && !u.hostd && (
        <Alert
          type="warning"
          showIcon
          message="Host-Dienst nicht erreichbar – Update nur direkt auf dem Pi möglich"
        />
      )}
      {running && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 8 }}
          message="Update läuft …"
          description="Das kann einige Minuten dauern. Die App ist dabei kurz nicht erreichbar."
        />
      )}
      {!running && u?.result === 'updated' && (
        <Alert
          type="success"
          showIcon
          style={{ marginTop: 8 }}
          message="Neue Version installiert"
          action={
            <Button size="small" onClick={() => window.location.reload()}>
              Seite neu laden
            </Button>
          }
        />
      )}
      <Popconfirm
        title={
          u?.eventActive
            ? 'Veranstaltung läuft – trotzdem aktualisieren?'
            : 'App jetzt aktualisieren?'
        }
        description={
          u?.eventActive
            ? 'Der Einlass ist während des Neustarts ca. 1–2 Minuten nicht möglich.'
            : 'Die App ist während des Neustarts kurz nicht erreichbar.'
        }
        okText="Aktualisieren"
        cancelText="Abbrechen"
        okButtonProps={{ danger: u?.eventActive }}
        onConfirm={() => run(u?.eventActive ?? false)}
        disabled={!u?.hostd || running}
      >
        <Button
          type="primary"
          block
          icon={<CloudDownloadOutlined />}
          style={{ marginTop: 12 }}
          loading={start.isPending || running}
          disabled={!u?.hostd}
        >
          {running ? 'Update läuft …' : 'Jetzt aktualisieren'}
        </Button>
      </Popconfirm>
    </Card>
  );
}

function PowerCard() {
  const shutdown = useApiMutation(() => api('/admin/system/shutdown', { method: 'POST' }), {
    success: 'Pi fährt herunter – in ca. 30 s kann der Strom getrennt werden',
  });
  const reboot = useApiMutation(() => api('/admin/system/reboot', { method: 'POST' }), {
    success: 'Pi startet neu – ca. 1 Minute',
  });
  return (
    <Card size="small" title="Gerät">
      <Flex gap={8}>
        <Popconfirm
          title="Pi herunterfahren?"
          description="Kontrolle ist danach nicht mehr möglich."
          okText="Herunterfahren"
          cancelText="Abbrechen"
          okButtonProps={{ danger: true }}
          onConfirm={() => shutdown.mutate(undefined)}
        >
          <Button danger icon={<PoweroffOutlined />} style={{ flex: 1 }}>
            Herunterfahren
          </Button>
        </Popconfirm>
        <Popconfirm
          title="Pi neu starten?"
          okText="Neu starten"
          cancelText="Abbrechen"
          onConfirm={() => reboot.mutate(undefined)}
        >
          <Button icon={<ReloadOutlined />} style={{ flex: 1 }}>
            Neu starten
          </Button>
        </Popconfirm>
      </Flex>
    </Card>
  );
}

export function SystemPage() {
  return (
    <Flex vertical gap={12}>
      <TimeCard />
      <SettingsCard />
      <UpdateCard />
      <PowerCard />
      <TimeLogCard />
    </Flex>
  );
}
