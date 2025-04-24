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

// Input type for file change generation
export type GenerateChangeInput = {
  filePath: string;
  prompt: string;
};

// Type alias for the response, assuming the generated type wraps the actual data
// Adjust if GetApiFileAiChangeByFileChangeIdResponse directly holds the data
type FileChangeDetailsResponse = GetApiFileAiChangeByFileChangeIdResponse; // Assuming direct response or adjust as needed

// Query keys for file changes
const FILE_CHANGE_KEYS = {
  all: ['fileChange'] as const,
  detail: (changeId: number) => getApiFileAiChangeByFileChangeIdQueryKey({ path: { fileChangeId: changeId.toString() } } as Options<GetApiFileAiChangeByFileChangeIdData>),
};

// Generate AI file change
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

// Get file change details
export function useGetFileChange(changeId: number | null) {
  const queryKey = changeId ? FILE_CHANGE_KEYS.detail(changeId) : [...FILE_CHANGE_KEYS.all, null]; // Use a consistent key structure

  return useQuery<
    FileChangeDetailsResponse | null, // TQueryFnData
    Error,                       // TError
    FileChangeDetailsResponse | null, // TData
    typeof queryKey              // TQueryKey - Use the derived queryKey type
  >({
    queryKey: queryKey,
    queryFn: async ({ signal }) => { // Destructure signal from context
      if (!changeId) return null;

      try {
        const options = getApiFileAiChangeByFileChangeIdOptions({
          path: { fileChangeId: changeId.toString() }
        } as Options<GetApiFileAiChangeByFileChangeIdData>); // Cast needed here?

        // Check if options and queryFn exist
        if (!options?.queryFn) {
          console.error('Generated query options or queryFn not found');
          return null; // Or throw an error
        }

        // Call the generated queryFn, passing the signal
        // Assert queryKey type as we know changeId is not null here
        const result = await options.queryFn({
          signal,
          queryKey: queryKey as ReturnType<typeof getApiFileAiChangeByFileChangeIdQueryKey>,
          meta: undefined
        });

        return result;
      } catch (error) {
        // Check specifically for 404 errors to return null
        if (error instanceof Error && error.message.includes('404')) {
          return null;
        }
        // Rethrow other errors
        console.error('Error fetching file change:', error);
        commonErrorHandler(error as Error); // Handle error consistently
        throw error; // Ensure react-query knows it failed
      }
    },
    enabled: changeId !== null, // Only enable the query if changeId is provided
    retry: (failureCount, error) => {
      // Don't retry on 404 errors
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      // Standard retry logic for other errors (e.g., 3 times)
      return failureCount < 3;
    },
    refetchOnWindowFocus: false, // Avoid refetching just because window focus changes
  });
}

// Confirm file change
export function useConfirmFileChange() {
  const queryClient = useQueryClient();
  const mutationOptions = postApiFileAiChangeByFileChangeIdConfirmMutation();

  return useMutation<
    PostApiFileAiChangeByFileChangeIdConfirmResponse, // TData
    PostApiFileAiChangeByFileChangeIdConfirmError,    // TError
    number                                          // TVariables (changeId)
  >({
    mutationFn: async (changeId: number) => {
      const opts: Options<PostApiFileAiChangeByFileChangeIdConfirmData> = {
        path: { fileChangeId: changeId.toString() }
      };
      // Ensure mutationFn exists before calling
      if (!mutationOptions.mutationFn) {
        throw new Error('Mutation function not available');
      }
      return await mutationOptions.mutationFn(opts);
      // return result.success; // Return the whole response for onSuccess
    },
    onSuccess: (data, changeId) => {
      // Invalidate based on the specific changeId key structure
      queryClient.invalidateQueries({ queryKey: FILE_CHANGE_KEYS.detail(changeId) });
      // Consider invalidating related queries if needed
    },
    onError: (error) => commonErrorHandler(error as unknown as Error),
  });
}