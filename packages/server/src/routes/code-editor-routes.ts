import { CodeEditorService } from '@/services/model-providers/code-editor/code-editor-service';
import { router } from 'server-router';
import { json } from '@bnk/router';

import { codeEditorApiValidation, type EditFileParams, type EditFileBody } from 'shared';

const codeEditorService = new CodeEditorService();
const AI_BASE_PATH = '/api/ai';

// POST /api/ai/projects/:projectId/files/:fileId/edit
router.post(`${AI_BASE_PATH}/projects/:projectId/files/:fileId/edit`, {
    validation: codeEditorApiValidation.edit,
}, async (_, { params, body }: { params: EditFileParams; body: EditFileBody }) => {
    const { projectId, fileId } = params;
    const { instructions, provider = 'openai' } = body;

    const updatedFile = await codeEditorService.editProjectFile({
        projectId,
        fileId,
        userInstruction: instructions,
        provider
    });

    return json({ data: updatedFile });
});