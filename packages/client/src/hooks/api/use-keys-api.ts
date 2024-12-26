import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../use-api';
import { ProviderKey } from 'shared';

type KeyListResponse = {
    success: boolean;
    keys: ProviderKey[];
};

type KeyResponse = {
    success: boolean;
    key: ProviderKey;
};

type CreateKeyInput = {
    provider: string;
    key: string;
};

type UpdateKeyInput = {
    provider?: string;
    key?: string;
};

const KEYS_KEY = ['provider-keys'];

export function useGetKeys() {
    const { api } = useApi();
    return useQuery({
        queryKey: KEYS_KEY,
        queryFn: async () => {
            const res = await api.request('/api/keys');
            const data = await res.json() as KeyListResponse;
            return data.keys;
        }
    });
}

export function useCreateKey() {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<ProviderKey, Error, CreateKeyInput>({
        mutationFn: async (input: CreateKeyInput) => {
            const res = await api.request('/api/keys', { method: 'POST', body: input });
            const data = await res.json() as KeyResponse;
            if (!data.success) throw new Error('Failed to create key');
            return data.key;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: KEYS_KEY });
        }
    });
}

export function useUpdateKey() {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<ProviderKey, Error, { keyId: string; updates: UpdateKeyInput }>({
        mutationFn: async ({ keyId, updates }: { keyId: string; updates: UpdateKeyInput }) => {
            const res = await api.request(`/api/keys/${keyId}`, { method: 'PATCH', body: updates });
            const data = await res.json() as KeyResponse;
            if (!data.success) throw new Error('Failed to update key');
            return data.key;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: KEYS_KEY });
        }
    });
}

export function useDeleteKey() {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<void, Error, string>({
        mutationFn: async (keyId: string) => {
            const res = await api.request(`/api/keys/${keyId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!data.success) throw new Error('Failed to delete key');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: KEYS_KEY });
        }
    });
}