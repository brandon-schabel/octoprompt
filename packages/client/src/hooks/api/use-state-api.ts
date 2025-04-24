import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commonErrorHandler } from './common-mutation-error-handler';
import {
    getApiStateOptions,
    getApiStateQueryKey,
    putApiStateMutation,
} from '../generated/@tanstack/react-query.gen';
import type {
    GetApiStateResponse,
    PutApiStateData,
    PutApiStateError,
    PutApiStateResponse,
    ReplaceStateBody
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
    const mutationOptions = putApiStateMutation();

    return useMutation<PutApiStateResponse, PutApiStateError, ReplaceStateBody>({
        mutationFn: (variables: ReplaceStateBody) => {
            const opts: Options<PutApiStateData> = { body: variables };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getApiStateQueryKey() });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}