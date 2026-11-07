import {
  DISPLAY_TIMELINE_MINUTES,
  type DisplayInfo,
  type DisplayScanEvent,
  type DisplayStats,
} from '@einlass/shared';
import dayjs from 'dayjs';
import QRCode from 'qrcode';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';

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
        width: vw(40),
        aspectRatio: '1',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      {src && (
        <img
          src={src}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            imageRendering: 'pixelated',
            display: 'block',
          }}
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

/** Größe eines Elements in Pixeln (für Diagramme ohne verzerrte Schrift) */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Abstand der Beschriftungen auf der X-Achse je nach Länge des Zeitraums */
function tickStepMinutes(spanMinutes: number): number {
  if (spanMinutes <= 3 * 60) return 30;
  if (spanMinutes <= 10 * 60) return 60;
  return 120;
}

/** Zeitverlauf als Linie mit Fläche, X-Achse mit Uhrzeiten, Y-Achse mit Höchstwert. */
function Timeline({ data }: { data: DisplayStats['timeline'] }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const font = Math.max(11, w * 0.034);
  const pad = { l: font * 2.2, r: font * 1.7, t: font * 0.8, b: font * 1.9 };
  const pw = Math.max(1, w - pad.l - pad.r);
  const ph = Math.max(1, h - pad.t - pad.b);

  const times = data.map((d) => dayjs(d.at).valueOf());
  const t0 = times[0] ?? Date.now();
  const t1 = Math.max(times[times.length - 1] ?? t0, t0 + DISPLAY_TIMELINE_MINUTES * 60_000);
  const max = Math.max(1, ...data.map((d) => d.scans));
  // runder Höchstwert für die Y-Achse
  const yMax = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * pw;
  const y = (v: number) => pad.t + ph - (v / yMax) * ph;

  const pts = data.map((d, i) => [x(times[i]!), y(d.scans)] as const);
  const line = pts
    .map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`)
    .join(' ');
  const last = pts[pts.length - 1];
  const area = last
    ? `${line} L${last[0].toFixed(1)},${y(0)} L${pts[0]![0].toFixed(1)},${y(0)} Z`
    : '';

  // Beschriftung der X-Achse zu runden Uhrzeiten
  const step = tickStepMinutes((t1 - t0) / 60_000);
  const ticks: number[] = [];
  let tick = dayjs(t0).startOf('hour');
  while (tick.valueOf() < t0) tick = tick.add(step, 'minute');
  for (; tick.valueOf() <= t1; tick = tick.add(step, 'minute')) ticks.push(tick.valueOf());

  return (
    <div ref={ref} style={{ width: '100%', height: '100%' }}>
      {w > 0 && (
        <svg width={w} height={h} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="timeline-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.accent} stopOpacity={0.45} />
              <stop offset="100%" stopColor={C.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {/* Hilfslinien + Beschriftung der Y-Achse */}
          {[0, yMax / 2, yMax].map((v) => (
            <g key={v}>
              <line
                x1={pad.l}
                x2={w - pad.r}
                y1={y(v)}
                y2={y(v)}
                stroke="#374151"
                strokeWidth={1}
                strokeDasharray={v ? '4 4' : undefined}
              />
              {Number.isInteger(v) && (
                <text
                  x={pad.l - font * 0.4}
                  y={y(v) + font * 0.35}
                  fontSize={font}
                  fill={C.muted}
                  textAnchor="end"
                >
                  {v}
                </text>
              )}
            </g>
          ))}
          {/* X-Achse mit Uhrzeiten */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(0) + font * 0.4} stroke="#6b7280" />
              <text
                x={x(t)}
                y={y(0) + font * 1.4}
                fontSize={font}
                fill={C.muted}
                textAnchor="middle"
              >
                {dayjs(t).format('HH:mm')}
              </text>
            </g>
          ))}
          {area && <path d={area} fill="url(#timeline-area)" />}
          {line && (
            <path
              d={line}
              fill="none"
              stroke={C.accent}
              strokeWidth={Math.max(2, font * 0.2)}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {last && <circle cx={last[0]} cy={last[1]} r={font * 0.32} fill={C.accent} />}
        </svg>
      )}
    </div>
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
          de="Scans im Zeitverlauf"
          en={`Scans over time · je/per ${DISPLAY_TIMELINE_MINUTES} min`}
          size={3.6}
        />
        <div style={{ flex: 1, minHeight: 0, marginTop: vw(2) }}>
          <Timeline data={t} />
        </div>
        {peak && peak.scans > 0 && (
          <div style={{ fontSize: vw(2.8), color: C.muted }}>
            Ansturm · Peak: {dayjs(peak.at).format('HH:mm')} Uhr ({peak.scans} Scans)
          </div>
        )}
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

export type LastResult = { kind: 'scan'; scan: DisplayScanEvent } | { kind: 'next' };

export function ScanView({ last }: { last: LastResult | null }) {
  if (last?.kind === 'next') return <NextView />;
  return <ScanResult scan={last?.scan ?? null} />;
}

/** Nach dem Wegtippen auf dem Handy: Aufforderung für die nächste Person */
function NextView() {
  return (
    <div
      style={{
        height: '100%',
        boxSizing: 'border-box',
        borderRadius: vw(4),
        background: C.card,
        border: `${vw(0.8)} solid ${C.accent}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: vw(5),
      }}
    >
      <div style={{ fontSize: vw(22), lineHeight: 1 }}>👋</div>
      <div>
        <div style={{ fontSize: vw(11), fontWeight: 900 }}>Nächster bitte</div>
        <div style={{ fontSize: vw(7), fontWeight: 700, color: C.muted }}>Next please</div>
      </div>
      <div style={{ fontSize: vw(4), color: C.muted }}>
        Thoska bereithalten
        <br />
        Have your student ID ready
      </div>
    </div>
  );
}

function ScanResult({ scan }: { scan: DisplayScanEvent | null }) {
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
