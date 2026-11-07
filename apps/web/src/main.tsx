import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import deDE from 'antd/locale/de_DE';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { HomeRedirect, RequireRole } from './auth/guards';
import { AdminLayout } from './pages/admin/AdminLayout';
import { EventsPage } from './pages/admin/EventsPage';
import { EventStatsPage } from './pages/admin/EventStatsPage';
import { ListDetailPage } from './pages/admin/ListDetailPage';
import { ListsPage } from './pages/admin/ListsPage';
import { DisplayPage } from './pages/display/DisplayPage';
import { SystemPage } from './pages/admin/SystemPage';
import { UsersPage } from './pages/admin/UsersPage';
import { LoginPage } from './pages/LoginPage';
import { ScanPage } from './pages/scan/ScanPage';

dayjs.locale('de');

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  { path: '/login', element: <LoginPage /> },
  // Touch-Display am Pi (Kiosk), geschützt per Display-Token statt Anmeldung
  { path: '/display', element: <DisplayPage /> },
  {
    path: '/scan',
    element: (
      <RequireRole role="CONTROLLER">
        <ScanPage />
      </RequireRole>
    ),
  },
  {
    path: '/admin',
    element: (
      <RequireRole role="ADMIN">
        <AdminLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <Navigate to="events" replace /> },
      { path: 'events', element: <EventsPage /> },
      { path: 'events/:id', element: <EventStatsPage /> },
      { path: 'lists', element: <ListsPage /> },
      { path: 'lists/:id', element: <ListDetailPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'settings', element: <SystemPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={deDE}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#1677ff', borderRadius: 10, fontSize: 16 },
      }}
    >
      <AntApp style={{ height: '100%' }}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
