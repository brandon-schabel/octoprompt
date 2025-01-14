import { router } from "server-router";
import { PromptService } from "@/services/prompt-service";
import { json } from '@bnk/router';
import { ApiError } from 'shared';
import { promptApiValidation } from "shared";
import { z } from "zod";

const promptService = new PromptService();

router.post("/api/prompts", {
    validation: promptApiValidation.create,
}, async (_, { body }) => {
    const created = await promptService.createPrompt(body);
    return json({ success: true, prompt: created }, { status: 201 });
});


router.get("/api/prompts", {}, async (_, __) => {
    const all = await promptService.listAllPrompts();
    return json({ success: true, prompts: all });
});


router.get("/api/projects/:projectId/prompts", {
    validation: promptApiValidation.list,
}, async (_, { params }) => {
    const projectPrompts = await promptService.listPromptsByProject(params.projectId);
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
        await promptService.addPromptToProject(params.promptId, params.projectId);
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
        await promptService.removePromptFromProject(params.promptId, params.projectId);
        return json({ success: true });
    });


router.get("/api/prompts/:promptId", {
    validation: promptApiValidation.getOrDelete,
}, async (_, { params }) => {
    const prompt = await promptService.getPromptById(params.promptId);
    if (!prompt) {
        throw new ApiError("Prompt not found", 404, "NOT_FOUND");
    }
    return json({ success: true, prompt });
});

router.patch("/api/prompts/:promptId", {
    validation: promptApiValidation.update,
}, async (_, { params, body }) => {
    const updatedPrompt = await promptService.updatePrompt(params.promptId, body);
    if (!updatedPrompt) {
        throw new ApiError("Prompt not found", 404, "NOT_FOUND");
    }
    return json({ success: true, prompt: updatedPrompt });
});

router.delete("/api/prompts/:promptId", {
    validation: promptApiValidation.getOrDelete,
}, async (_, { params }) => {
    const deleted = await promptService.deletePrompt(params.promptId);
    if (!deleted) {
        throw new ApiError("Prompt not found", 404, "NOT_FOUND");
    }
    return json({ success: true });
});