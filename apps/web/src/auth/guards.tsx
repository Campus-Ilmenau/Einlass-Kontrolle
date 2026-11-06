import type { Role } from '@einlass/shared';
import { Flex, Spin } from 'antd';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';

export function FullPageSpinner() {
  return (
    <Flex align="center" justify="center" style={{ height: '100%' }}>
      <Spin size="large" />
    </Flex>
  );
}

/** Startseite je nach Rolle: Admin → Verwaltung, Kontrolleur:in → Scannen. */
export const homeFor = (role: Role) => (role === 'ADMIN' ? '/admin' : '/scan');

export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}

/** Nur für angemeldete Benutzer mit der passenden Rolle (Admin und Kontrolle sind strikt getrennt). */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}
