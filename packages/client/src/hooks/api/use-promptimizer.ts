import { useMutation } from '@tanstack/react-query';
import { useApi } from '../use-api';
import { commonErrorHandler } from './common-mutation-error-handler';

export type OptimizePromptResponse = {
    success: boolean;
    optimizedPrompt?: string;
    error?: string;
};

const PROMPTIMIZER_KEYS = {
    all: ['promptimizer'] as const,
    optimize: () => [...PROMPTIMIZER_KEYS.all, 'optimize'] as const,
} as const;

async function optimizePrompt(
    api: ReturnType<typeof useApi>['api'],
    userContext: string
): Promise<OptimizePromptResponse> {
    const response = await api.request('/api/prompt/optimize', {
        method: 'POST',
        body: { userContext },
    });
    return response.json();
}

export const useOptimizePrompt = () => {
    const { api } = useApi();

    return useMutation<OptimizePromptResponse, Error, string>({
        mutationFn: (userContext: string) => optimizePrompt(api, userContext),
        onError: commonErrorHandler,
    });
};
