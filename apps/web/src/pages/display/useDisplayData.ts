import type { DisplayInfo, DisplayScanEvent, DisplayStats } from '@einlass/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '../../api/client';

/** Bei Netzwerkfehlern weiter versuchen (Pi startet evtl. noch), nicht bei falschem Token */
const retry = (_: number, err: unknown) => !(err instanceof ApiRequestError && err.status === 401);

/** Token aus der Kiosk-URL (`/display?token=…`) */
export function useDisplayToken(): string {
  return new URLSearchParams(window.location.search).get('token') ?? '';
}

const headers = (token: string) => ({ 'X-Display-Token': token });

export function useDisplayInfo(token: string) {
  return useQuery({
    queryKey: ['display', 'info'],
    queryFn: () => api<DisplayInfo>('/display/info', { headers: headers(token) }),
    refetchInterval: 60_000,
    retry,
    retryDelay: 5_000,
  });
}

export function useDisplayStats(token: string) {
  return useQuery({
    queryKey: ['display', 'stats'],
    queryFn: () => api<DisplayStats>('/display/stats', { headers: headers(token) }),
    refetchInterval: 15_000,
    retry,
    retryDelay: 5_000,
  });
}

/**
 * Live-Scans per Server-Sent Events. EventSource verbindet sich bei Abbrüchen selbst neu.
 * Nach jedem Scan wird die Statistik sofort neu geladen.
 */
export function useLiveScans(token: string, onScan: (e: DisplayScanEvent) => void) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    const source = new EventSource(`/api/display/stream?token=${encodeURIComponent(token)}`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener('scan', (msg) => {
      onScan(JSON.parse((msg as MessageEvent<string>).data) as DisplayScanEvent);
      void queryClient.invalidateQueries({ queryKey: ['display', 'stats'] });
    });
    return () => source.close();
  }, [token, onScan, queryClient]);

  return connected;
}
