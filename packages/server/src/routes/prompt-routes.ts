import app from "@/server-router";
import { zValidator } from '@hono/zod-validator';
import { ApiError } from 'shared';
import { promptApiValidation } from "shared";
import { z } from "zod";
import { addPromptToProject, createPrompt, deletePrompt, getPromptById, listAllPrompts, listPromptsByProject, removePromptFromProject, updatePrompt } from "@/services/prompt-service";

// Create new prompt
app.post("/api/prompts",
    zValidator('json', promptApiValidation.create.body),
    async (c) => {
        const body = await c.req.valid('json');
        
        // 1) Create the prompt
        const createdPrompt = await createPrompt(body);

        // 2) If projectId was given, link it to the project:
        if (body.projectId) {
            await addPromptToProject(createdPrompt.id, body.projectId);
        }

        return c.json({ success: true, prompt: createdPrompt }, 201);
    }
);

// List all prompts
app.get("/api/prompts", async (c) => {
    const all = await listAllPrompts();
    return c.json({ success: true, prompts: all });
});

// List prompts for a project
app.get("/api/projects/:projectId/prompts",
    zValidator('param', promptApiValidation.list.params),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const projectPrompts = await listPromptsByProject(projectId);
        return c.json({ success: true, prompts: projectPrompts });
    }
);

// Add prompt to project
app.post("/api/projects/:projectId/prompts/:promptId",
    zValidator('param', z.object({
        promptId: z.string(),
        projectId: z.string(),
    })),
    async (c) => {
        const { promptId, projectId } = c.req.valid('param');
        await addPromptToProject(promptId, projectId);
        return c.json({ success: true });
    }
);

// Remove prompt from project
app.delete("/api/projects/:projectId/prompts/:promptId",
    zValidator('param', z.object({
        promptId: z.string(),
        projectId: z.string(),
    })),
    async (c) => {
        const { promptId, projectId } = c.req.valid('param');
        await removePromptFromProject(promptId, projectId);
        return c.json({ success: true });
    }
);

// Get prompt by ID
app.get("/api/prompts/:promptId",
    zValidator('param', promptApiValidation.getOrDelete.params),
    async (c) => {
        const { promptId } = c.req.valid('param');
        const prompt = await getPromptById(promptId);
        if (!prompt) {
            throw new ApiError("Prompt not found", 404, "NOT_FOUND");
        }
        return c.json({ success: true, prompt });
    }
);

// Update a prompt
app.patch("/api/prompts/:promptId",
    zValidator('param', promptApiValidation.update.params),
    zValidator('json', promptApiValidation.update.body),
    async (c) => {
        const { promptId } = c.req.valid('param');
        const body = await c.req.valid('json');
        const updatedPrompt = await updatePrompt(promptId, body);
        if (!updatedPrompt) {
            throw new ApiError("Prompt not found", 404, "NOT_FOUND");
        }
        return c.json({ success: true, prompt: updatedPrompt });
    }
);

// Delete a prompt
app.delete("/api/prompts/:promptId",
    zValidator('param', promptApiValidation.getOrDelete.params),
    async (c) => {
        const { promptId } = c.req.valid('param');
        const deleted = await deletePrompt(promptId);
        if (!deleted) {
            throw new ApiError("Prompt not found", 404, "NOT_FOUND");
        }
        return c.json({ success: true });
    }
);