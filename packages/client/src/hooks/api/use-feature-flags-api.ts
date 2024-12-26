import { useQuery } from '@tanstack/react-query';
import { useApi } from '../use-api';

export type FeatureFlag = {
    id: string;
    key: string;
    enabled: boolean;
    description: string;
    data: string;
};

type FeatureFlagResponse = {
    success: boolean;
    flag: FeatureFlag;
};

const FEATURE_FLAG_KEYS = {
    all: ['feature-flags'] as const,
    flag: (key: string) => [...FEATURE_FLAG_KEYS.all, key] as const,
};

async function getFeatureFlag(
    api: ReturnType<typeof useApi>['api'], 
    key: string
): Promise<FeatureFlagResponse> {
    const response = await api.request(`/api/flags/${key}`);
    return response.json();
}

export const useFeatureFlag = (key: string) => {
    const { api } = useApi();

    return useQuery({
        queryKey: FEATURE_FLAG_KEYS.flag(key),
        queryFn: async () => {
            try {
                const response = await getFeatureFlag(api, key);
                if (!response.success) {
                    throw new Error('Failed to fetch feature flag');
                }
                return response;
            } catch (error) {
                console.error('Error fetching feature flag:', {
                    key,
                    error,
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
                throw error;
            }
        },
        select: (data) => ({
            ...data.flag,
            data: data.flag.data ? JSON.parse(data.flag.data) : undefined
        }),
        // Keep the data fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        retry: 1, // Only retry once for feature flags
    });
};

// Helper hook to directly get the enabled status
export const useIsFeatureEnabled = (key: string) => {
    const { data, isLoading } = useFeatureFlag(key);
    return {
        isEnabled: data?.enabled ?? false,
        isLoading,
        data: data?.data,
    };
}; 