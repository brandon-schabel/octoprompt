import { useMutation } from '@tanstack/react-query';
import { useApi } from '../use-api';
import { APIProviders, ProjectFile } from 'shared';
import { commonErrorHandler } from './common-mutation-error-handler';

const CODE_EDITOR_KEYS = {
    all: ['code-editor'] as const,
    edits: () => [...CODE_EDITOR_KEYS.all, 'edits'] as const,
    edit: (projectId: string, fileId: string) => 
        [...CODE_EDITOR_KEYS.edits(), projectId, fileId] as const,
} as const;

type EditFileInput = {
    projectId: string;
    fileId: string;
    instructions: string;
    provider?: APIProviders;
};

type EditFileResponse = {
    data: ProjectFile;
};

async function editFile(
    api: ReturnType<typeof useApi>['api'],
    input: EditFileInput
): Promise<EditFileResponse> {
    const { projectId, fileId, instructions, provider } = input;
    const response = await api.request(
        `/api/ai/projects/${projectId}/files/${fileId}/edit`,
        {
            method: 'POST',
            body: { instructions, provider },
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to edit file');
    }

    return response.json();
}

export const useEditFile = () => {
    const { api } = useApi();

    return useMutation<EditFileResponse, Error, EditFileInput>({
        mutationFn: (input) => editFile(api, input),
        onError: commonErrorHandler
    });
}; 