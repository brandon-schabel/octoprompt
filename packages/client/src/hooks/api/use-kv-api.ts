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

type MutationContext<K extends KVKey> = {
    previousValue?: KVValue<K>;
};

export function useSetKvValue<K extends KVKey>(key: K) {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<
        { success: boolean },
        Error,
        { newValue: KVValue<K> },
        MutationContext<K>
    >({
        mutationFn: async ({ newValue }) => {
            // We'll automatically validate newValue in our route again
            const resp = await api.request('/api/kv', {
                method: 'POST',
                body: { key, value: newValue },
            });
            return resp.json();
        },

        // This fires *before* the mutationFn to do optimistic updates
        onMutate: async ({ newValue }) => {
            // Cancel any outgoing refetches so they don’t overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey: ['kv', key] });

            // Get the current data so we can revert if something goes wrong
            const previousValue = queryClient.getQueryData<KVValue<K>>(['kv', key]);

            // Optimistically update to the new value
            queryClient.setQueryData(['kv', key], newValue);

            // Return context object with previousValue so we can roll back if needed
            return { previousValue };
        },

        // If the mutation fails, revert to the old value
        onError: (error, variables, context) => {
            if (context?.previousValue !== undefined) {
                queryClient.setQueryData(['kv', key], context.previousValue);
            }
            commonErrorHandler(error);
        },

        // Always refetch after error or success to keep server data in sync
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['kv', key] });
        },
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