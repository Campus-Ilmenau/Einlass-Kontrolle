import type { LoginResponse, TimeSyncResult, User } from '@einlass/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo } from 'react';
import { api, ApiRequestError, clientTime } from '../api/client';

interface MeResponse {
  user: User;
  timeSync?: TimeSyncResult;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (name: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const ME_KEY = ['me'] as const;

/** Hinweise zum automatischen Zeitabgleich (siehe konzept/04). */
function useTimeSyncNotice() {
  const { message } = App.useApp();
  return useCallback(
    (sync?: TimeSyncResult) => {
      if (!sync) return;
      if (sync.action === 'adjusted') {
        message.success('Uhrzeit des Systems wurde mit diesem Gerät abgeglichen');
      } else if (sync.action === 'warning' || sync.action === 'rejected') {
        if (sync.reason === 'HOST_UNAVAILABLE') return;
        const minutes = Math.round(Math.abs(sync.driftSeconds) / 60);
        message.warning(
          `Die Uhr dieses Geräts weicht um ca. ${minutes} min von der Systemzeit ab – bitte prüfen`,
          6,
        );
      }
    },
    [message],
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const notice = useTimeSyncNotice();

  // GET /auth/me schickt die Gerätezeit mit → Zeitabgleich auch ohne neuen Login
  // (beim Start und wenn die App wieder in den Vordergrund kommt)
  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api<MeResponse>('/auth/me', { headers: { 'X-Client-Time': clientTime() } });
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) return null;
        throw err;
      }
    },
    refetchOnWindowFocus: true,
    staleTime: 60_000,
    retry: (count, err) => !(err instanceof ApiRequestError && err.status === 401) && count < 2,
  });

  useEffect(() => notice(me.data?.timeSync), [me.data?.timeSync, notice]);

  const login = useCallback(
    async (name: string, password: string) => {
      const res = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { name, password, clientTime: clientTime() },
      });
      queryClient.setQueryData(ME_KEY, { user: res.user });
      notice(res.timeSync);
      return res.user;
    },
    [queryClient, notice],
  );

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    queryClient.setQueryData(ME_KEY, null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ user: me.data?.user ?? null, loading: me.isPending, login, logout }),
    [me.data, me.isPending, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth außerhalb von AuthProvider');
  return ctx;
}
