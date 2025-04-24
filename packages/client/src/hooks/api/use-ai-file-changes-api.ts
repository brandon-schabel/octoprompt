import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commonErrorHandler } from './common-mutation-error-handler';
import {
  getApiFileAiChangeByFileChangeIdOptions,
  getApiFileAiChangeByFileChangeIdQueryKey,
  postApiFileAiChangeMutation,
  postApiFileAiChangeByFileChangeIdConfirmMutation,
} from '../generated/@tanstack/react-query.gen';
import type {
  GetApiFileAiChangeByFileChangeIdData,
  GetApiFileAiChangeByFileChangeIdResponse,
  PostApiFileAiChangeData,
  PostApiFileAiChangeError,
  PostApiFileAiChangeResponse,
  PostApiFileAiChangeByFileChangeIdConfirmData,
  PostApiFileAiChangeByFileChangeIdConfirmError,
  PostApiFileAiChangeByFileChangeIdConfirmResponse,
} from '../generated/types.gen';
import { Options } from '../generated/sdk.gen';

export type GenerateChangeInput = {
  filePath: string;
  prompt: string;
};

type FileChangeDetailsResponse = GetApiFileAiChangeByFileChangeIdResponse; // Assuming direct response or adjust as needed

const FILE_CHANGE_KEYS = {
  all: ['fileChange'] as const,
  detail: (changeId: number) => getApiFileAiChangeByFileChangeIdQueryKey({ path: { fileChangeId: changeId.toString() } } as Options<GetApiFileAiChangeByFileChangeIdData>),
};

export function useGenerateFileChange() {
  const mutationOptions = postApiFileAiChangeMutation();

  return useMutation<PostApiFileAiChangeResponse, PostApiFileAiChangeError, GenerateChangeInput>({
    mutationFn: (variables: GenerateChangeInput) => {
      const opts: Options<PostApiFileAiChangeData> = { body: variables };
      // Ensure mutationFn exists before calling
      if (!mutationOptions.mutationFn) {
        throw new Error('Mutation function not available');
      }
      return mutationOptions.mutationFn(opts);
    },
    onError: (error) => commonErrorHandler(error as unknown as Error),
  });
}

export function useGetFileChange(changeId: number | null) {
  const queryKey = changeId ? FILE_CHANGE_KEYS.detail(changeId) : [...FILE_CHANGE_KEYS.all, null]; // Use a consistent key structure

  return useQuery<
    FileChangeDetailsResponse | null,
    Error,
    FileChangeDetailsResponse | null,
    typeof queryKey
  >({
    queryKey: queryKey,
    queryFn: async ({ signal }) => {
      if (!changeId) return null;

      try {
        const options = getApiFileAiChangeByFileChangeIdOptions({
          path: { fileChangeId: changeId.toString() }
        } as Options<GetApiFileAiChangeByFileChangeIdData>);

        if (!options?.queryFn) {
          console.error('Generated query options or queryFn not found');
          return null;
        }

        const result = await options.queryFn({
          signal,
          queryKey: queryKey as ReturnType<typeof getApiFileAiChangeByFileChangeIdQueryKey>,
          meta: undefined
        });

        return result;
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return null;
        }
        console.error('Error fetching file change:', error);
        commonErrorHandler(error as Error);
        throw error;
      }
    },
    enabled: changeId !== null,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      return failureCount < 3;
    },
    refetchOnWindowFocus: false,
  });
}

export function useConfirmFileChange() {
  const queryClient = useQueryClient();
  const mutationOptions = postApiFileAiChangeByFileChangeIdConfirmMutation();

  return useMutation<
    PostApiFileAiChangeByFileChangeIdConfirmResponse,
    PostApiFileAiChangeByFileChangeIdConfirmError,
    number
  >({
    mutationFn: async (changeId: number) => {
      const opts: Options<PostApiFileAiChangeByFileChangeIdConfirmData> = {
        path: { fileChangeId: changeId.toString() }
      };
      if (!mutationOptions.mutationFn) {
        throw new Error('Mutation function not available');
      }
      return await mutationOptions.mutationFn(opts);
    },
    onSuccess: (data, changeId) => {
      queryClient.invalidateQueries({ queryKey: FILE_CHANGE_KEYS.detail(changeId) });
    },
    onError: (error) => commonErrorHandler(error as unknown as Error),
  });
}