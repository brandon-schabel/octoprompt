import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    postApiProjectsByProjectIdAgentCoderMutation,
    getApiProjectsByProjectIdFilesQueryKey
} from '../generated/@tanstack/react-query.gen';
import { toast } from 'sonner';
import {
    type PostApiProjectsByProjectIdAgentCoderError,
    type PostApiProjectsByProjectIdAgentCoderData,
    type AgentCoderRunRequest,
    type AgentCoderRunResponse,
    type GetApiProjectsByProjectIdFilesData
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
