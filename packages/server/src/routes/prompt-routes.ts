import { router } from "server-router";
import { PromptService } from "@/services/prompt-service";
import { json } from '@bnk/router';
import { ApiError } from 'shared';
import { promptApiValidation } from "shared";

const promptService = new PromptService();

router.post("/api/prompts", {
    validation: promptApiValidation.create,
}, async (_, { body }) => {
    const prompt = await promptService.createPrompt(body);
    if (!prompt) {
        throw new ApiError("Project not found or not owned by user", 404, "NOT_FOUND");
    }
    return json({ success: true, prompt }, { status: 201 });
});

router.get("/api/projects/:projectId/prompts", {
    validation: promptApiValidation.list,
}, async (_, { params }) => {
    const prompts = await promptService.listPromptsByProject(params.projectId);
    return json({ success: true, prompts });
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