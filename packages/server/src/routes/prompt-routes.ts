import { router } from "server-router";
import { json } from '@bnk/router';
import { ApiError } from 'shared';
import { promptApiValidation } from "shared";
import { z } from "zod";
import { addPromptToProject, createPrompt, deletePrompt, getPromptById, listAllPrompts, listPromptsByProject, removePromptFromProject, updatePrompt } from "@/services/prompt-service";


router.post("/api/prompts", {
    validation: promptApiValidation.create,
}, async (_, { body }) => {
    // 1) Create the prompt
    const createdPrompt = await createPrompt(body);

    // 2) If projectId was given, link it to the project:
    if (body.projectId) {
        await addPromptToProject(createdPrompt.id, body.projectId);
    }

    return json({ success: true, prompt: createdPrompt }, { status: 201 });
});

router.get("/api/prompts", {}, async (_, __) => {
    const all = await listAllPrompts();
    return json({ success: true, prompts: all });
});


router.get("/api/projects/:projectId/prompts", {
    validation: promptApiValidation.list,
}, async (_, { params }) => {
    const projectPrompts = await listPromptsByProject(params.projectId);
    return json({ success: true, prompts: projectPrompts });
});


router.post("/api/projects/:projectId/prompts/:promptId", {
    validation: {
        params: z.object({
            promptId: z.string(),
            projectId: z.string(),
        })
    }
},
    async (_, { params }) => {
        await addPromptToProject(params.promptId, params.projectId);
        return json({ success: true });
    });


// remove prompt from project
router.delete("/api/projects/:projectId/prompts/:promptId", {
    validation: {
        params: z.object({
            promptId: z.string(),
            projectId: z.string(),
        })
    }
},
    async (_, { params }) => {
        await removePromptFromProject(params.promptId, params.projectId);
        return json({ success: true });
    });

router.get("/api/prompts/:promptId", {
    validation: promptApiValidation.getOrDelete,
}, async (_, { params }) => {
    const prompt = await getPromptById(params.promptId);
    if (!prompt) {
        throw new ApiError("Prompt not found", 404, "NOT_FOUND");
    }
    return json({ success: true, prompt });
});

router.patch("/api/prompts/:promptId", {
    validation: promptApiValidation.update,
}, async (_, { params, body }) => {
    const updatedPrompt = await updatePrompt(params.promptId, body);
    if (!updatedPrompt) {
        throw new ApiError("Prompt not found", 404, "NOT_FOUND");
    }
    return json({ success: true, prompt: updatedPrompt });
});

router.delete("/api/prompts/:promptId", {
    validation: promptApiValidation.getOrDelete,
}, async (_, { params }) => {
    const deleted = await deletePrompt(params.promptId);
    if (!deleted) {
        throw new ApiError("Prompt not found", 404, "NOT_FOUND");
    }
    return json({ success: true });
});