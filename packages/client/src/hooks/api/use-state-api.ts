import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commonErrorHandler } from './common-mutation-error-handler';
import {
    getApiStateOptions,
    getApiStateQueryKey,
    postApiStateMutation
} from '../generated/@tanstack/react-query.gen';
import type {
    GetApiStateResponse,
    PostApiStateData,
    PostApiStateError,
    PostApiStateResponse
} from '../generated/types.gen';
import { Options } from '../generated/sdk.gen';

export type UpdateStateInput = {
    key: string;
    value: any;
};

const STATE_KEYS = {
    all: ['state'] as const,
};

export function useGetState() {
    const queryOptions = getApiStateOptions();

    return useQuery<
        GetApiStateResponse,
        Error,
        GetApiStateResponse,
        ReturnType<typeof getApiStateQueryKey>
    >({
        queryKey: queryOptions.queryKey,
        queryFn: queryOptions.queryFn,
        refetchOnWindowFocus: true,
    });
}

export function useUpdateState() {
    const queryClient = useQueryClient();
    const mutationOptions = postApiStateMutation();

    return useMutation<PostApiStateResponse, PostApiStateError, UpdateStateInput>({
        mutationFn: (variables: UpdateStateInput) => {
            const opts: Options<PostApiStateData> = { body: variables };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: () => {
            // Invalidate state queries to trigger a refetch
            queryClient.invalidateQueries({ queryKey: STATE_KEYS.all });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}