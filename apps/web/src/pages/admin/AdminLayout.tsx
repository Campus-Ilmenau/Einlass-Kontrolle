import {
  CalendarOutlined,
  SettingOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { theme } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { AppHeader } from '../../components/AppHeader';

const ITEMS = [
  { key: '/admin/events', icon: <CalendarOutlined />, label: 'Abende' },
  { key: '/admin/lists', icon: <UnorderedListOutlined />, label: 'Listen' },
  { key: '/admin/users', icon: <TeamOutlined />, label: 'Kontrolle' },
  { key: '/admin/settings', icon: <SettingOutlined />, label: 'System' },
];

const TITLES: Record<string, string> = {
  '/admin/events': 'Veranstaltungen',
  '/admin/lists': 'Freilisten',
  '/admin/users': 'Kontrolleur:innen',
  '/admin/settings': 'System',
};

/** Admin-Bereich: Kopfzeile + Tab-Leiste unten (mit dem Daumen erreichbar). */
export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const selected = ITEMS.find((i) => location.pathname.startsWith(i.key))?.key ?? ITEMS[0]!.key;

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title={TITLES[selected] ?? 'Verwaltung'} />
      <main
        style={{
          padding: 16,
          paddingBottom: 'calc(88px + env(safe-area-inset-bottom))',
          flex: 1,
          maxWidth: 960,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <Outlet />
      </main>
      <nav
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          background: '#141414',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 10,
        }}
      >
        {ITEMS.map((item) => {
          const active = item.key === selected;
          return (
            <button
              key={item.key}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(item.key)}
              style={{
                flex: 1,
                border: 0,
                background: 'transparent',
                padding: '10px 4px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                color: active ? token.colorPrimary : token.colorTextSecondary,
                fontSize: 12,
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
