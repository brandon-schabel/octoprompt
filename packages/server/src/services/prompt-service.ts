import { db } from "shared/database";
import { prompts, promptProjects, projects, type Prompt, eq, and, CreatePromptBody, UpdatePromptBody } from "shared";
import { sql } from "drizzle-orm";

export class PromptService {
    async createPrompt(data: CreatePromptBody): Promise<Prompt> {
        // "data.projectId" is no longer mandatory. 
        // If you want to handle it for backward-compatibility, do so:
        const [newPrompt] = await db.insert(prompts).values({
            name: data.name,
            content: data.content,
        }).returning();
        return newPrompt;
    }

    /** 
     * Associate an existing prompt with a project. 
     */
    async addPromptToProject(promptId: string, projectId: string): Promise<void> {
        await db.insert(promptProjects).values({
            promptId,
            projectId,
        });
    }

    /**
     * Disassociate a prompt from a project. 
     */
    async removePromptFromProject(promptId: string, projectId: string): Promise<void> {
        await db.delete(promptProjects)
            .where(and(eq(promptProjects.promptId, promptId), eq(promptProjects.projectId, projectId)));
    }

    /**
     * Return a prompt by ID.
     */
    async getPromptById(promptId: string): Promise<Prompt | null> {
        const [row] = await db.select().from(prompts).where(eq(prompts.id, promptId)).limit(1);
        return row || null;
    }

    /**
     * List all prompts in the system (regardless of project).
     * Potentially filter or search if you like.
     */
    async listAllPrompts(): Promise<Prompt[]> {
        const rows = await db.select().from(prompts);
        return rows;
    }

    /**
     * List all prompts that are associated with a given project.
     */
    async listPromptsByProject(projectId: string): Promise<Prompt[]> {
        return await db.select()
            .from(prompts)
            .innerJoin(promptProjects, eq(prompts.id, promptProjects.promptId))
            .where(eq(promptProjects.projectId, projectId))
            .then(rows => rows.map(row => ({
                id: row.prompts.id,
                name: row.prompts.name,
                content: row.prompts.content,
                createdAt: row.prompts.createdAt,
                updatedAt: row.prompts.updatedAt
            })));
    }

    /**
     * Update a prompt's name or content.
     */
    async updatePrompt(promptId: string, data: UpdatePromptBody): Promise<Prompt | null> {
        const existing = await this.getPromptById(promptId);
        if (!existing) return null;

        const updates: Partial<Prompt> = {
            ...(data.name && { name: data.name }),
            ...(data.content && { content: data.content }),
        };
        const [updated] = await db.update(prompts)
            .set({
                ...updates,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(prompts.id, promptId))
            .returning();
        return updated || null;
    }

    async deletePrompt(promptId: string): Promise<boolean> {
        const [deleted] = await db.delete(prompts)
            .where(eq(prompts.id, promptId))
            .returning();
        return !!deleted;
    }
}