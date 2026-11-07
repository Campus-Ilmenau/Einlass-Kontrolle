import type { CheckResponse } from '@einlass/shared';
import { Button, Flex } from 'antd';
import dayjs from 'dayjs';
import { useEffect } from 'react';

export interface CheckedInput {
  matrikelnummer: string;
  birthDate: string;
}

/** Farbe nach Priorität: Jugendschutz vor freiem Eintritt. */
function verdict(r: CheckResponse) {
  if (r.ageGroup === 'U16')
    return { bg: '#a8071a', title: 'UNTER 16', vibrate: [200, 100, 200, 100, 200] };
  if (r.ageGroup === 'U18') return { bg: '#ad4e00', title: 'UNTER 18', vibrate: [200, 100, 200] };
  if (r.isFree) return { bg: '#237804', title: 'FREIER EINTRITT', vibrate: [120] };
  return { bg: '#0958d9', title: 'NORMALER EINTRITT', vibrate: [120] };
}

/** Vollbild-Ergebnis. Tippen → nächster Scan. */
export function ResultOverlay({
  result,
  input,
  onNext,
  onCorrect,
}: {
  result: CheckResponse;
  input: CheckedInput;
  onNext: () => void;
  onCorrect: () => void;
}) {
  const v = verdict(result);
  useEffect(() => {
    navigator.vibrate?.(v.vibrate);
  }, [v.vibrate]);

  const minor = result.ageGroup !== 'ADULT';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onNext}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNext()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: v.bg,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 20px',
        paddingTop: 'max(24px, env(safe-area-inset-top))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <Flex
        vertical
        flex={1}
        justify="center"
        align="center"
        gap={12}
        style={{ textAlign: 'center' }}
      >
        <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>{v.title}</div>
        <div style={{ fontSize: 28, fontWeight: 600 }}>{result.age} Jahre</div>
        {minor && result.isFree && (
          <div style={{ fontSize: 20, fontWeight: 600 }}>Freier Eintritt (Freiliste)</div>
        )}
        {result.matchedLists.length > 0 && (
          <div style={{ fontSize: 18, opacity: 0.9 }}>
            {result.matchedLists.map((l) => l.name).join(' · ')}
          </div>
        )}
        {result.alreadySeenAt && (
          <div
            style={{
              marginTop: 16,
              background: 'rgba(0,0,0,0.35)',
              border: '2px solid #ffd666',
              borderRadius: 12,
              padding: '10px 16px',
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            ⚠ Bereits um {dayjs(result.alreadySeenAt).format('HH:mm')} Uhr gescannt
          </div>
        )}
      </Flex>

      <Flex vertical gap={12} align="center">
        <div style={{ fontFamily: 'monospace', fontSize: 16, opacity: 0.85 }}>
          Matrikel {input.matrikelnummer} · geb. {dayjs(input.birthDate).format('DD.MM.YYYY')}
        </div>
        <Button
          ghost
          style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.85)' }}
          onClick={(e) => {
            e.stopPropagation();
            onCorrect();
          }}
        >
          Falsch erkannt? Korrigieren
        </Button>
        <div style={{ fontSize: 15, opacity: 0.8 }}>Tippen für nächsten Scan</div>
      </Flex>
    </div>
  );
}
