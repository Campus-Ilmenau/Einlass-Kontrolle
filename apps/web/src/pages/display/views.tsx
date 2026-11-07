import {
  DISPLAY_TIMELINE_MINUTES,
  type DisplayInfo,
  type DisplayScanEvent,
  type DisplayStats,
} from '@einlass/shared';
import dayjs from 'dayjs';
import QRCode from 'qrcode';
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';

/* Größen relativ zur Breite → passt auf 720×1280 (Pi) wie auf andere Displays */
const vw = (n: number) => `${n}vw`;

const C = {
  bg: '#111418',
  card: '#1b1f25',
  text: '#e8eaed',
  muted: '#9aa3ad',
  accent: '#3b82f6',
  green: '#237804',
  blue: '#0958d9',
  orange: '#ad4e00',
  red: '#a8071a',
};

const card: CSSProperties = { background: C.card, borderRadius: vw(3), padding: vw(4) };

/** Zweisprachige Beschriftung: Deutsch groß, Englisch klein darunter */
function Bi({ de, en, size = 4.5 }: { de: ReactNode; en: ReactNode; size?: number }) {
  return (
    <div style={{ lineHeight: 1.15 }}>
      <div style={{ fontSize: vw(size), fontWeight: 700 }}>{de}</div>
      <div style={{ fontSize: vw(size * 0.6), color: C.muted }}>{en}</div>
    </div>
  );
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => dayjs());
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function Qr({ text }: { text: string }) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 600, errorCorrectionLevel: 'M' })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [text]);
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: vw(2),
        padding: vw(2),
        width: vw(42),
        height: vw(42),
      }}
    >
      {src && (
        <img
          src={src}
          alt=""
          style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
        />
      )}
    </div>
  );
}

/** WLAN-QR-Format: Sonderzeichen \ ; , : " escapen */
const wifiEscape = (s: string) => s.replace(/[\\;,:"]/g, (c) => `\\${c}`);

// ─── ① Willkommen ──────────────────────────────────────────────────────────

export function WelcomeView({ info }: { info?: DisplayInfo }) {
  const now = useNow();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: vw(4), height: '100%' }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: vw(4) }}>
        {info?.wifi && (
          <Qr
            text={`WIFI:T:WPA;S:${wifiEscape(info.wifi.ssid)};P:${wifiEscape(info.wifi.password)};;`}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: vw(2), minWidth: 0 }}>
          <Bi de="1 · WLAN verbinden" en="Connect to Wi-Fi" />
          {info?.wifi && (
            <div style={{ fontSize: vw(3.6), fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {info.wifi.ssid}
              <br />
              {info.wifi.password}
            </div>
          )}
        </div>
      </div>

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: vw(4) }}>
        {info && <Qr text={info.appUrl} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: vw(2), minWidth: 0 }}>
          <Bi de="2 · App öffnen" en="Open the app" />
          <div style={{ fontSize: vw(3.6), fontFamily: 'monospace' }}>{info?.appUrl}</div>
          <div style={{ fontSize: vw(2.8), color: C.muted }}>
            Zertifikatswarnung bestätigen
            <br />
            Accept the certificate warning
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        {info?.event ? (
          <Bi
            de={info.event.name}
            en={`${dayjs(info.event.startsAt).format('HH:mm')} – ${dayjs(info.event.endsAt).format('HH:mm')}`}
            size={6}
          />
        ) : (
          <Bi de="Keine Veranstaltung aktiv" en="No event running" size={5} />
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: vw(13), fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {now.format('HH:mm:ss')}
        </div>
        <div style={{ fontSize: vw(3.6), color: C.muted }}>{now.format('dddd, DD.MM.YYYY')}</div>
      </div>
    </div>
  );
}

// ─── ② Statistik ───────────────────────────────────────────────────────────

function Number_({
  value,
  de,
  en,
  color,
}: {
  value: number;
  de: string;
  en: string;
  color?: string;
}) {
  return (
    <div style={{ ...card, flex: 1, textAlign: 'center', padding: vw(3) }}>
      <div style={{ fontSize: vw(10), fontWeight: 800, color: color ?? C.text, lineHeight: 1.05 }}>
        {value}
      </div>
      <div style={{ fontSize: vw(3.2), fontWeight: 600 }}>{de}</div>
      <div style={{ fontSize: vw(2.5), color: C.muted }}>{en}</div>
    </div>
  );
}

function Timeline({ data }: { data: DisplayStats['timeline'] }) {
  const max = Math.max(1, ...data.map((d) => d.scans));
  const W = 100;
  const H = 40;
  const bw = W / Math.max(data.length, 1);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: '100%' }}
      preserveAspectRatio="none"
    >
      {data.map((d, i) => {
        const h = (d.scans / max) * H;
        const last = i === data.length - 1;
        return (
          <g key={d.at}>
            <rect
              x={i * bw + bw * 0.12}
              y={H - h}
              width={bw * 0.76}
              height={Math.max(h, 0.4)}
              rx={0.6}
              fill={last ? C.accent : '#4b5563'}
            />
          </g>
        );
      })}
      <line x1={0} y1={H} x2={W} y2={H} stroke="#374151" strokeWidth={0.3} />
    </svg>
  );
}

export function StatsView({ stats }: { stats?: DisplayStats }) {
  if (!stats?.event) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <Bi de="Keine Veranstaltung aktiv" en="No event running" size={5} />
      </div>
    );
  }
  const minors = stats.ageGroups.U18 + stats.ageGroups.U16;
  const t = stats.timeline;
  const peak = t.reduce((m, d) => (d.scans > m.scans ? d : m), t[0] ?? { at: '', scans: 0 });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: vw(2.5), height: '100%' }}>
      <Bi de="Statistik" en={`Statistics · ${stats.event.name}`} size={5.5} />
      <div style={{ display: 'flex', gap: vw(3) }}>
        <Number_ value={stats.persons} de="Personen" en="People" />
        <Number_ value={stats.freePersons} de="Freier Eintritt" en="Free entry" color="#73d13d" />
      </div>
      <div style={{ display: 'flex', gap: vw(3) }}>
        <Number_ value={stats.ageGroups.U18} de="Unter 18" en="Under 18" color="#ffa940" />
        <Number_ value={stats.ageGroups.U16} de="Unter 16" en="Under 16" color="#ff4d4f" />
      </div>

      {stats.perList.length > 0 && (
        <div style={card}>
          <Bi de="Freilisten" en="Guest lists" size={3.6} />
          {stats.perList.map((l) => (
            <div
              key={l.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: vw(3.8),
                marginTop: vw(1.5),
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.name}
              </span>
              <strong>{l.persons}</strong>
            </div>
          ))}
        </div>
      )}

      <div style={{ ...card, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Bi
          de={`Scans je ${DISPLAY_TIMELINE_MINUTES} min`}
          en={`Scans per ${DISPLAY_TIMELINE_MINUTES} min`}
          size={3.6}
        />
        <div style={{ flex: 1, minHeight: 0, marginTop: vw(2) }}>
          <Timeline data={t} />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: vw(2.8),
            color: C.muted,
          }}
        >
          <span>{t[0] ? dayjs(t[0].at).format('HH:mm') : ''}</span>
          {peak && peak.scans > 0 && (
            <span>
              Ansturm · Peak: {dayjs(peak.at).format('HH:mm')} ({peak.scans})
            </span>
          )}
          <span>jetzt · now</span>
        </div>
        <div style={{ fontSize: vw(2.8), color: C.muted, marginTop: vw(1) }}>
          {stats.scans} Scans gesamt · total{minors ? ` · ${minors} minderjährig · minors` : ''}
        </div>
      </div>
    </div>
  );
}

// ─── ③ Letzter Scan ────────────────────────────────────────────────────────

function verdict(e: DisplayScanEvent) {
  if (e.ageGroup === 'U16') return { bg: C.red, de: 'UNTER 16', en: 'UNDER 16' };
  if (e.ageGroup === 'U18') return { bg: C.orange, de: 'UNTER 18', en: 'UNDER 18' };
  if (e.isFree) return { bg: C.green, de: 'FREIER EINTRITT', en: 'FREE ENTRY' };
  return { bg: C.blue, de: 'NORMALER EINTRITT', en: 'REGULAR ENTRY' };
}

export function ScanView({ scan }: { scan: DisplayScanEvent | null }) {
  const now = useNow(5000);
  if (!scan) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <Bi de="Noch kein Scan" en="No scan yet" size={6} />
      </div>
    );
  }
  const v = verdict(scan);
  const seconds = Math.max(0, now.diff(dayjs(scan.at), 'second'));
  const ago = seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
  const stale = seconds > 120;
  return (
    <div
      style={{
        height: '100%',
        boxSizing: 'border-box',
        borderRadius: vw(4),
        background: v.bg,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        gap: vw(4),
        padding: vw(5),
        opacity: stale ? 0.55 : 1,
        transition: 'opacity 1s',
      }}
    >
      <div>
        <div style={{ fontSize: vw(11), fontWeight: 900, lineHeight: 1.05 }}>{v.de}</div>
        <div style={{ fontSize: vw(6.5), fontWeight: 700, opacity: 0.85 }}>{v.en}</div>
      </div>
      <div style={{ fontSize: vw(8), fontWeight: 700 }}>{scan.age} Jahre · years</div>
      {scan.ageGroup !== 'ADULT' && scan.isFree && (
        <div style={{ fontSize: vw(4.5), fontWeight: 600 }}>Freier Eintritt · Free entry</div>
      )}
      {scan.lists.length > 0 && (
        <div style={{ fontSize: vw(4.5), opacity: 0.9 }}>{scan.lists.join(' · ')}</div>
      )}
      {scan.alreadySeen && (
        <div
          style={{
            background: 'rgba(0,0,0,0.35)',
            border: '3px solid #ffd666',
            borderRadius: vw(3),
            padding: `${vw(2)} ${vw(4)}`,
            fontSize: vw(4.5),
            fontWeight: 700,
          }}
        >
          ⚠ Bereits gescannt
          <br />
          <span style={{ fontSize: vw(3.6), fontWeight: 600 }}>Already scanned</span>
        </div>
      )}
      <div style={{ fontSize: vw(3.4), opacity: 0.8 }}>
        vor {ago} · {ago} ago
      </div>
    </div>
  );
}
