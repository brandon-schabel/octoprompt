import { router } from "server-router";
import { PromptService } from "@/services/prompt-service";
import { json } from '@bnk/router';
import { promptApiValidation} from "shared";

const promptService = new PromptService();

const API_ERRORS = {
    NOT_FOUND: (details?: unknown) =>
        json.error('Prompt not found', 404, details),
    UNAUTHORIZED: (details?: unknown) =>
        json.error('Unauthorized access', 401, details),
    INTERNAL_ERROR: (error: unknown) => {
        console.error('Internal server error:', error);
        return json.error('Internal server error', 500);
    }
} as const;

// Create prompt
router.post("/api/prompts", {
    validation: promptApiValidation.create,

}, async (req, { body }) => {
    try {
        const prompt = await promptService.createPrompt(body);

        if (!prompt) {
            return API_ERRORS.NOT_FOUND("Project not found or not owned by user");
        }

        return json({ success: true, prompt }, { status: 201 });
    } catch (error) {
        return API_ERRORS.INTERNAL_ERROR(error);
    }
});

// List prompts by project
router.get("/api/projects/:projectId/prompts", {
    validation: promptApiValidation.list,

}, async (req, { params }) => {
    try {
        const prompts = await promptService.listPromptsByProject(params.projectId);
        return json({ success: true, prompts });
    } catch (error) {
        return API_ERRORS.INTERNAL_ERROR(error);
    }
});

// Get single prompt
router.get("/api/prompts/:promptId", {
    validation: promptApiValidation.getOrDelete,

}, async (req, { params }) => {
    try {
        const prompt = await promptService.getPromptById(params.promptId);
        if (!prompt) {
            return API_ERRORS.NOT_FOUND();
        }
        return json({ success: true, prompt });
    } catch (error) {
        return API_ERRORS.INTERNAL_ERROR(error);
    }
});

// Update prompt
router.patch("/api/prompts/:promptId", {
    validation: promptApiValidation.update,

}, async (req, { params, body }) => {
    try {
        const updatedPrompt = await promptService.updatePrompt(params.promptId, body);
        if (!updatedPrompt) {
            return API_ERRORS.NOT_FOUND();
        }
        return json({
            success: true,
            prompt: updatedPrompt
        });
    } catch (error) {
        return API_ERRORS.INTERNAL_ERROR(error);
    }
});

// Delete prompt
router.delete("/api/prompts/:promptId", {
    validation: promptApiValidation.getOrDelete,

}, async (req, { params }) => {
    try {
        const deleted = await promptService.deletePrompt(params.promptId);
        if (!deleted) {
            return API_ERRORS.NOT_FOUND();
        }
        return json({ success: true });
    } catch (error) {
        return API_ERRORS.INTERNAL_ERROR(error);
    }
});