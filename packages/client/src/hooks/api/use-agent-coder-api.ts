import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    postApiProjectsByProjectIdAgentCoderMutation,
    getApiProjectsByProjectIdFilesQueryKey,
    getApiAgentCoderLogsOptions,
    getApiAgentCoderLogsListOptions
} from '../generated/@tanstack/react-query.gen';
import { toast } from 'sonner';
import {
    type PostApiProjectsByProjectIdAgentCoderError,
    type PostApiProjectsByProjectIdAgentCoderData,
    type AgentCoderRunRequest,
    type AgentCoderRunResponse,
    type GetApiProjectsByProjectIdFilesData,
    GetApiAgentCoderLogsData
} from '../generated';
import { type Options } from '../generated/sdk.gen';
import { commonErrorHandler } from './common-mutation-error-handler';

export const useRunAgentCoder = (projectId?: string) => {
    const queryClient = useQueryClient();
    const mutationOptionsFn = postApiProjectsByProjectIdAgentCoderMutation();

    return useMutation<AgentCoderRunResponse, PostApiProjectsByProjectIdAgentCoderError, AgentCoderRunRequest>({
        // Define the mutation function explicitly
        mutationFn: async (variables: AgentCoderRunRequest) => {
            if (!projectId) {
                throw new Error('Project ID is required to run the agent coder.');
            }
            // Construct the options object expected by the generated mutation function
            const options: Options<PostApiProjectsByProjectIdAgentCoderData> = {
                path: { projectId },
                body: variables
            };

            // Get the actual mutation function from the generated options
            const mutationFn = mutationOptionsFn.mutationFn;
            if (!mutationFn) {
                throw new Error('Generated mutation function is not available.');
            }
            // Call the generated function
            return mutationFn(options);
        },
        onSuccess: (data, variables) => {
            toast.success('Agent Coder finished successfully!');
            console.log('Agent Coder success response:', data);

            // Invalidate project files query using the generated key
            if (projectId) {
                const queryKey = getApiProjectsByProjectIdFilesQueryKey({ path: { projectId } } as Options<GetApiProjectsByProjectIdFilesData>);
                queryClient.invalidateQueries({ queryKey });
            }
        },
        // Use the common error handler
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
};
// Hook to get the list of available agent coder log files
export const useGetAgentCoderLogList = () => {
    const queryOptions = getApiAgentCoderLogsListOptions();
    return useQuery({
        ...queryOptions,
        // Optional: Add staleTime or other options if needed
        // staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

// Hook to get a specific agent coder log file by ID (or the latest if ID is omitted)
export const useGetAgentCoderLog = (logId?: string, options: { enabled?: boolean } = {}) => {
    // Construct query parameters: only include logId if it's provided
    const queryParams: Options<GetApiAgentCoderLogsData>['query'] = logId ? { logId } : undefined;

    // Get the generated query options, including the dynamic query parameters
    const queryOptions = getApiAgentCoderLogsOptions({
        query: queryParams,
    } as Options<GetApiAgentCoderLogsData>); // Need to cast because query can be undefined

    return useQuery({
        ...queryOptions,
        // Control fetching based on the passed `enabled` option
        enabled: options.enabled ?? true, // Default to true if not provided
        refetchOnWindowFocus: false, // Example: disable refetch on focus for logs
        refetchOnMount: true, // Example: refetch when component mounts
        // if there is no log id, this is live, refetch every 250ms
        refetchInterval: !logId && (options.enabled ?? true) ? 250 : false, // Only refetch latest if enabled
    });
};