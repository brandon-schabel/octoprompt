import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import {
    postApiProjectsByProjectIdAgentCoderMutation,
    getApiProjectsByProjectIdFilesQueryKey,
    getApiAgentCoderRunsOptions,
    getApiAgentCoderRunsByAgentJobIdLogsOptions,
    getApiAgentCoderRunsByAgentJobIdDataOptions,
} from '../generated/@tanstack/react-query.gen';
import { toast } from 'sonner';
import {
    type PostApiProjectsByProjectIdAgentCoderError,
    type PostApiProjectsByProjectIdAgentCoderData,
    type AgentCoderRunRequest as AgentCoderRunRequestBody,
    type ProjectFile,
    type GetApiProjectsByProjectIdFilesData,
    type GetApiAgentCoderRunsByAgentJobIdLogsData,
    type GetApiAgentCoderRunsByAgentJobIdDataData,
    type ApiErrorResponse,
} from '../generated/types.gen';
import { type Options } from '../generated/sdk.gen';
import { commonErrorHandler } from './common-mutation-error-handler';
import { type TaskPlan } from 'shared/src/schemas/agent-coder.schemas';

// Corresponds to AgentCoderRunDataSchema in agent-coder-routes.ts
type AgentCoderRunData = {
    updatedFiles: ProjectFile[];
    taskPlan?: TaskPlan | null;
    agentJobId: string;
};

// Corresponds to AgentCoderRunResponseSchema in agent-coder-routes.ts
type AgentCoderRunResponse = {
    success: boolean;
    data?: AgentCoderRunData;
    error?: ApiErrorResponse['error'];
};

export const useRunAgentCoder = (projectId: string) => {
    const queryClient = useQueryClient();
    const mutationOptionsFn = postApiProjectsByProjectIdAgentCoderMutation();

    return useMutation<AgentCoderRunResponse, PostApiProjectsByProjectIdAgentCoderError, Omit<AgentCoderRunRequestBody, 'agentJobId'>>({
        mutationFn: async (variables: AgentCoderRunRequestBody) => {
            const options: Options<PostApiProjectsByProjectIdAgentCoderData> = {
                path: { projectId },
                body: variables
            };
            const mutationFn = mutationOptionsFn.mutationFn;
            if (!mutationFn) {
                throw new Error('Generated mutation function is not available.');
            }
            const result = await mutationFn(options) as AgentCoderRunResponse;
            return result;
        },
        onSuccess: (data: AgentCoderRunResponse, variables) => {
            if (data.success && data.data?.agentJobId) {
                toast.success(`Agent Coder job ${data.data.agentJobId} finished successfully!`);
                console.log('Agent Coder success response:', data);
            } else if (data.success) {
                toast.success('Agent Coder finished successfully!');
                console.log('Agent Coder success response (jobId missing?):', data);
            } else {
                const errorMessage = data.error?.message || 'Agent Coder reported failure.';
                toast.error(`Agent Coder Failed: ${errorMessage}`);
                console.error('Agent Coder failure response:', data.error);
            }

            const queryKey = getApiProjectsByProjectIdFilesQueryKey({ path: { projectId } } as Options<GetApiProjectsByProjectIdFilesData>);
            queryClient.invalidateQueries({ queryKey });
            const runsListQueryKey = getApiAgentCoderRunsOptions().queryKey;
            queryClient.invalidateQueries({ queryKey: runsListQueryKey });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
};

export const useListAgentCoderRuns = () => {
    return useQuery(getApiAgentCoderRunsOptions());
};

export const useGetAgentCoderRunLogs = (agentJobId?: string, options: { enabled?: boolean } = {}) => {
    const pathParams: Options<GetApiAgentCoderRunsByAgentJobIdLogsData>['path'] = { agentJobId: agentJobId ?? '' };

    return useQuery({
        ...getApiAgentCoderRunsByAgentJobIdLogsOptions({
            path: pathParams,
        }),
        enabled: !!agentJobId && (options.enabled ?? true),
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        refetchInterval: false,
    });
};

export const useGetAgentCoderRuns = () => {
    return useQuery(getApiAgentCoderRunsOptions());
}

export const useGetAgentCoderRunData = (agentJobId: string) => {
    const queryOptions = getApiAgentCoderRunsByAgentJobIdDataOptions({ path: { agentJobId } });

    return useQuery(queryOptions);
}
