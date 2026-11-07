import type { DisplayScanEvent } from '@einlass/shared';
import { type PointerEvent, type ReactNode, useCallback, useRef, useState } from 'react';
import { useDisplayInfo, useDisplayStats, useDisplayToken, useLiveScans } from './useDisplayData';
import { ScanView, StatsView, WelcomeView } from './views';

const PAGES = 3;
/** Ab dieser Wischstrecke (px) wird die Seite gewechselt */
const SWIPE_THRESHOLD = 60;

/**
 * Anzeige für das Touch-Display am Pi (Kiosk). Drei Ansichten, per Wischen oder Punkte wechseln:
 * ① Willkommen (QR-Codes) · ② Statistik · ③ letzter Scan (live, springt bei jedem Scan nach vorn).
 */
export function DisplayPage() {
  const token = useDisplayToken();
  const info = useDisplayInfo(token);
  const stats = useDisplayStats(token);
  const [page, setPage] = useState(0);
  const [lastScan, setLastScan] = useState<DisplayScanEvent | null>(null);
  const [drag, setDrag] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);

  const onScan = useCallback((e: DisplayScanEvent) => {
    setLastScan(e);
    setPage(2);
  }, []);
  const live = useLiveScans(token, onScan);

  const onPointerDown = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    // Am Rand gedämpft weiterziehen
    const atEdge = (page === 0 && dx > 0) || (page === PAGES - 1 && dx < 0);
    setDrag(atEdge ? dx / 4 : dx);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    start.current = null;
    setDrag(0);
    if (dx < -SWIPE_THRESHOLD) setPage((p) => Math.min(PAGES - 1, p + 1));
    else if (dx > SWIPE_THRESHOLD) setPage((p) => Math.max(0, p - 1));
  };

  if (!token) {
    return <Centered text="Display-Token fehlt (…/display?token=…)" />;
  }
  if (info.isError && (info.error as { status?: number })?.status === 401) {
    return <Centered text="Ungültiges Display-Token" />;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#111418',
        color: '#e8eaed',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        touchAction: 'pan-y',
        userSelect: 'none',
        cursor: 'none',
        fontFamily: 'system-ui, "DejaVu Sans", sans-serif',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        style={{
          display: 'flex',
          width: `${PAGES * 100}vw`,
          flex: 1,
          minHeight: 0,
          transform: `translateX(calc(${-page * 100}vw + ${drag}px))`,
          transition: start.current ? 'none' : 'transform 300ms ease',
        }}
      >
        <Page>
          <WelcomeView info={info.data} />
        </Page>
        <Page>
          <StatsView stats={stats.data} />
        </Page>
        <Page>
          <ScanView scan={lastScan} />
        </Page>
      </div>

      {/* Seitenpunkte + Verbindungsstatus */}
      <div
        style={{
          position: 'relative',
          flexShrink: 0,
          height: '9vw',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4vw',
        }}
      >
        {Array.from({ length: PAGES }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ansicht ${i + 1}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPage(i)}
            style={{
              width: i === page ? '7vw' : '3vw',
              height: '3vw',
              borderRadius: '2vw',
              border: 0,
              padding: 0,
              background: i === page ? '#3b82f6' : '#4b5563',
              transition: 'width 200ms',
              cursor: 'none',
            }}
          />
        ))}
        <span
          title={live ? 'live' : 'offline'}
          style={{
            position: 'absolute',
            right: '4vw',
            width: '2vw',
            height: '2vw',
            borderRadius: '50%',
            background: live ? '#52c41a' : '#ff4d4f',
          }}
        />
      </div>
    </div>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: '100vw',
        height: '100%',
        padding: '5vw 5vw 2vw',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

function Centered({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#111418',
        color: '#e8eaed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '5vw',
        padding: '8vw',
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
}
