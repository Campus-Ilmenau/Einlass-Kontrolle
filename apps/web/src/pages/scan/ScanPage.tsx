import { BulbFilled, BulbOutlined, EditOutlined, LockOutlined } from '@ant-design/icons';
import {
  CARD_ASPECT_RATIO,
  type CheckContext,
  type CheckResponse,
  THOSKA_DATA_ROI,
} from '@einlass/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Flex, Progress, Result, Spin, Typography } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiRequestError } from '../../api/client';
import { AppHeader } from '../../components/AppHeader';
import { useCamera, useWakeLock } from '../../scan/useCamera';
import { useThoskaScanner } from '../../scan/useThoskaScanner';
import { ManualEntry } from './ManualEntry';
import { type CheckedInput, ResultOverlay } from './ResultOverlay';

const CONTEXT_KEY = ['checks', 'context'];

/** Kontext der Kontrolle: aktive Veranstaltung (alle 30 s neu, damit Beginn/Ende erkannt werden). */
export function useCheckContext() {
  return useQuery({
    queryKey: CONTEXT_KEY,
    queryFn: () => api<CheckContext>('/checks/context'),
    refetchInterval: 30_000,
  });
}

type Mode = 'camera' | 'manual' | 'result';

export function ScanPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const context = useCheckContext();
  const event = context.data?.event;

  const [mode, setMode] = useState<Mode>('camera');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ response: CheckResponse; input: CheckedInput } | null>(
    null,
  );
  const [manualInitial, setManualInitial] = useState<CheckedInput | null>(null);

  const camera = useCamera();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const scanning = !!event && mode === 'camera' && camera.state.status === 'running' && !checking;
  useWakeLock(!!event);

  const check = useCallback(
    async (input: CheckedInput) => {
      setChecking(true);
      try {
        const response = await api<CheckResponse>('/checks', { method: 'POST', body: input });
        setResult({ response, input });
        setMode('result');
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === 'NO_ACTIVE_EVENT') {
          await queryClient.invalidateQueries({ queryKey: CONTEXT_KEY });
        }
        message.error(err instanceof ApiRequestError ? err.message : 'Prüfung fehlgeschlagen');
        setMode((m) => (m === 'result' ? 'camera' : m));
      } finally {
        setChecking(false);
      }
    },
    [message, queryClient],
  );

  const scanner = useThoskaScanner(camera.videoRef, frameRef, scanning, check);

  // Kamera läuft, solange eine Veranstaltung aktiv ist und gescannt wird
  const hasEvent = !!event;
  const { start: startCamera, stop: stopCamera } = camera;
  useEffect(() => {
    if (hasEvent && mode === 'camera') void startCamera();
    if (!hasEvent) stopCamera();
  }, [hasEvent, mode, startCamera, stopCamera]);

  const next = () => {
    // Ergebnis wurde weggetippt → Display am Pi zeigt "Nächster bitte" (Fehler sind egal)
    if (mode === 'result') void api('/checks/next', { method: 'POST' }).catch(() => undefined);
    setResult(null);
    setManualInitial(null);
    scanner.reset();
    setMode('camera');
  };

  const header = (
    <AppHeader
      title={event ? event.name : 'Kontrolle'}
      extra={
        event && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            bis {dayjs(event.endsAt).format('HH:mm')} Uhr
            {event.lists.length ? ` · ${event.lists.map((l) => l.name).join(', ')}` : ''}
          </Typography.Text>
        )
      }
    />
  );

  if (context.isPending) {
    return (
      <Flex vertical style={{ height: '100%' }}>
        {header}
        <Flex flex={1} align="center" justify="center">
          <Spin size="large" />
        </Flex>
      </Flex>
    );
  }

  if (!event) {
    return (
      <Flex vertical style={{ height: '100%' }}>
        {header}
        <Flex flex={1} align="center" justify="center" style={{ padding: 16 }}>
          {context.isError ? (
            <Alert
              type="error"
              showIcon
              message="Keine Verbindung zum Pi"
              description="WLAN prüfen"
            />
          ) : (
            <Result
              icon={<LockOutlined />}
              title="Keine Veranstaltung aktiv"
              subTitle="Scannen ist erst möglich, wenn eine Veranstaltung läuft."
            />
          )}
        </Flex>
      </Flex>
    );
  }

  const { progress } = scanner;

  return (
    <Flex vertical style={{ height: '100%' }}>
      {header}

      {mode === 'manual' ? (
        <Flex flex={1} justify="center" style={{ padding: 16, overflowY: 'auto' }}>
          <ManualEntry
            initial={manualInitial}
            loading={checking}
            onSubmit={check}
            onCancel={next}
          />
        </Flex>
      ) : (
        <>
          {/* Kamerabild mit Kartenrahmen; der gelbe Bereich wird ausgewertet */}
          <div style={{ position: 'relative', flex: 1, background: '#000', overflow: 'hidden' }}>
            <video
              ref={camera.bindVideo}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div
              ref={frameRef}
              style={{
                position: 'absolute',
                left: '5%',
                width: '90%',
                top: '50%',
                transform: 'translateY(-50%)',
                aspectRatio: CARD_ASPECT_RATIO,
                border: '3px solid rgba(255,255,255,0.9)',
                borderRadius: 14,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `${THOSKA_DATA_ROI.x * 100}%`,
                  top: `${THOSKA_DATA_ROI.y * 100}%`,
                  width: `${THOSKA_DATA_ROI.w * 100}%`,
                  height: `${THOSKA_DATA_ROI.h * 100}%`,
                  border: '2px dashed #fadb14',
                  borderRadius: 4,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: -34,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  color: '#fff',
                  fontSize: 14,
                }}
              >
                Thoska quer halten, Foto links
              </div>
            </div>

            {camera.state.status === 'error' && (
              <Flex
                vertical
                align="center"
                justify="center"
                gap={12}
                style={{
                  position: 'absolute',
                  inset: 0,
                  padding: 24,
                  background: 'rgba(0,0,0,0.85)',
                }}
              >
                <Alert type="error" showIcon message={camera.state.message} />
                <Button onClick={() => void camera.start()}>Erneut versuchen</Button>
              </Flex>
            )}
          </div>

          {/* Status + Bedienung */}
          <Flex
            vertical
            gap={10}
            style={{
              padding: 12,
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
              background: '#141414',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {progress.error && <Alert type="error" showIcon message={progress.error} />}
            {progress.loading !== null && !progress.error ? (
              <Flex vertical gap={2}>
                <Typography.Text type="secondary">Texterkennung wird geladen …</Typography.Text>
                <Progress percent={Math.round(progress.loading * 100)} size="small" />
              </Flex>
            ) : (
              <Flex justify="space-around" style={{ fontFamily: 'monospace', fontSize: 16 }}>
                <span>
                  Matrikel: <strong>{progress.matrikel ?? '…'}</strong>
                </span>
                <span>
                  geb.:{' '}
                  <strong>
                    {progress.birthDate ? dayjs(progress.birthDate).format('DD.MM.YYYY') : '…'}
                  </strong>
                </span>
              </Flex>
            )}
            <Flex gap={8}>
              <Button
                size="large"
                icon={<EditOutlined />}
                style={{ flex: 1 }}
                onClick={() => {
                  setManualInitial(null);
                  setMode('manual');
                }}
              >
                Manuell eingeben
              </Button>
              {camera.state.status === 'running' && (
                <Button
                  size="large"
                  type={camera.state.torchOn ? 'primary' : 'default'}
                  icon={camera.state.torchOn ? <BulbFilled /> : <BulbOutlined />}
                  aria-pressed={camera.state.torchOn}
                  onClick={async () => {
                    const ok = await camera.toggleTorch();
                    if (!ok)
                      message.warning('Licht wird von diesem Gerät bzw. Browser nicht unterstützt');
                  }}
                >
                  {camera.state.torchOn ? 'Licht aus' : 'Licht an'}
                </Button>
              )}
            </Flex>
          </Flex>
        </>
      )}

      {checking && mode === 'camera' && (
        <Flex
          align="center"
          justify="center"
          style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.6)' }}
        >
          <Spin size="large" />
        </Flex>
      )}

      {mode === 'result' && result && (
        <ResultOverlay
          result={result.response}
          input={result.input}
          onNext={next}
          onCorrect={() => {
            setManualInitial(result.input);
            setResult(null);
            setMode('manual');
          }}
        />
      )}
    </Flex>
  );
}
