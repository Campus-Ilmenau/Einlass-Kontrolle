/** Fehler einer API-Anfrage mit maschinenlesbarem Code (z. B. `LOCKED`, `NAME_TAKEN`). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** Aufruf der API unter `/api` (gleicher Ursprung, Session-Cookie wird mitgeschickt). */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, signal } = options;
  const isForm = body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK', 'Keine Verbindung zum Pi – WLAN prüfen');
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      typeof data.error === 'string' ? data.error : `HTTP_${res.status}`,
      typeof data.message === 'string' ? data.message : res.statusText,
      data,
    );
  }
  return data as T;
}

/** Aktuelle Gerätezeit für den automatischen Zeitabgleich. */
export const clientTime = () => new Date().toISOString();
