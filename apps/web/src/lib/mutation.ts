import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { ApiRequestError } from '../api/client';

/** Fehlertext für Meldungen */
export const errorMessage = (err: unknown) =>
  err instanceof ApiRequestError ? err.message : 'Unerwarteter Fehler';

/**
 * Mutation mit Erfolgs-/Fehlermeldung, die danach die angegebenen Abfragen neu lädt.
 */
export function useApiMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  options: { invalidate?: QueryKey[]; success?: string | ((r: TResult) => string) } = {},
) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await Promise.all(
        (options.invalidate ?? []).map((key) => queryClient.invalidateQueries({ queryKey: key })),
      );
      const text =
        typeof options.success === 'function' ? options.success(result) : options.success;
      if (text) message.success(text);
    },
    onError: (err) => message.error(errorMessage(err)),
  });
}
