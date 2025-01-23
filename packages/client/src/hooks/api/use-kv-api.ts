import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../use-api';

import { KVKey, KvSchemas, KVValue } from 'shared/src/kv-validators';
import { commonErrorHandler } from './common-mutation-error-handler';

type KVResult<T> = {
  success: boolean;
  key: string;
  value?: T;
};

export function useGetKvValue<K extends KVKey>(key: K) {
  const { api } = useApi();

  return useQuery({
    queryKey: ['kv', key],
    queryFn: async () => {
      const resp = await api.request(`/api/kv?key=${key}`);
      const data: KVResult<unknown> = await resp.json();

      // data.value is unknown; parse with the correct Zod schema to ensure type safety
      const validated = KvSchemas[key].parse(data.value);
      return validated as KVValue<K>;
    },
    enabled: !!key,
  });
}

export function useSetKvValue<K extends KVKey>(key: K) {
  const { api } = useApi();
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean },
    Error,
    { newValue: KVValue<K> }
  >({
    mutationFn: async ({ newValue }) => {
      // We'll automatically validate newValue in our route again
      const resp = await api.request('/api/kv', {
        method: 'POST',
        body: { key, value: newValue },
      });
      return resp.json();
    },
    onSuccess: () => {
      // Invalidate local cache so the new data is fetched
      queryClient.invalidateQueries({ queryKey: ['kv', key] });
    },
    onError: commonErrorHandler,
  });
}

export function useDeleteKvValue() {
  const { api } = useApi();
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; key: string },
    Error,
    { key: KVKey }
  >({
    mutationFn: async ({ key }) => {
      const resp = await api.request(`/api/kv/${key}`, {
        method: 'DELETE',
      });
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kv', data.key] });
    },
    onError: commonErrorHandler,
  });
} 