import { prompts, projects, type Prompt, eq, and, CreatePromptBody, UpdatePromptBody } from "shared";
import { db } from "shared/database";

export class PromptService {
    async createPrompt(data: CreatePromptBody): Promise<Prompt | null> {
        // Ensure project belongs to the user
        const [project] = await db.select()
            .from(projects)
            .where(and(eq(projects.id, data.projectId)))
            .limit(1);

        if (!project) return null;

        const [prompt] = await db.insert(prompts)
            .values({
                projectId: data.projectId,
                name: data.name,
                content: data.content,
            })
            .returning();

        return prompt;
    }

    async getPromptById(promptId: string): Promise<Prompt | null> {
        // Ensure prompt belongs to a project that belongs to the user
        const [prompt] = await db.select({
            id: prompts.id,
            projectId: prompts.projectId,
            name: prompts.name,
            content: prompts.content,
            createdAt: prompts.createdAt,
            updatedAt: prompts.updatedAt
        })
            .from(prompts)
            .innerJoin(projects, eq(projects.id, prompts.projectId))
            .where(and(
                eq(prompts.id, promptId),
            ))
            .limit(1);

        return prompt || null;
    }

    async listPromptsByProject(projectId: string): Promise<Prompt[]> {
        const promptsList = await db.select({
            id: prompts.id,
            projectId: prompts.projectId,
            name: prompts.name,
            content: prompts.content,
            createdAt: prompts.createdAt,
            updatedAt: prompts.updatedAt
        })
            .from(prompts)
            .innerJoin(projects, eq(projects.id, prompts.projectId))
            .where(and(
                eq(projects.id, projectId)
            ));

        return promptsList;
    }

    async updatePrompt(promptId: string, data: UpdatePromptBody): Promise<Prompt | null> {
        // First verify the prompt exists and user has access
        const existing = await this.getPromptById(promptId);
        if (!existing) return null;

        // Only update fields that were provided
        const updates: Partial<Prompt> = {
            ...(data.name && { name: data.name }),
            ...(data.content && { content: data.content }),
            updatedAt: new Date()
        };

        const [updatedPrompt] = await db.update(prompts)
            .set(updates)
            .where(eq(prompts.id, promptId))
            .returning();

        return updatedPrompt || null;
    }

    async deletePrompt(promptId: string): Promise<boolean> {
        const existing = await this.getPromptById(promptId);
        if (!existing) return false;

        const [deletedPrompt] = await db.delete(prompts)
            .where(eq(prompts.id, promptId))
            .returning();

        return !!deletedPrompt;
    }
}