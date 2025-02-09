import { db } from "@/utils/database";
import { eq, and } from "@db";
import { schema } from "shared";
import { CreatePromptBody, UpdatePromptBody } from "shared";
import { sql } from "drizzle-orm";

const { prompts, promptProjects } = schema;

type Prompt = schema.Prompt;


export async function createPrompt(data: CreatePromptBody): Promise<Prompt> {
    const [newPrompt] = await db.insert(prompts).values({
        name: data.name,
        content: data.content,
    }).returning();
    return newPrompt;
}

export async function addPromptToProject(promptId: string, projectId: string): Promise<void> {
    await db.insert(promptProjects).values({
        promptId,
        projectId,
    });
}

export async function removePromptFromProject(promptId: string, projectId: string): Promise<void> {
    await db.delete(promptProjects)
        .where(and(eq(promptProjects.promptId, promptId), eq(promptProjects.projectId, projectId)));
}

export async function getPromptById(promptId: string): Promise<Prompt | null> {
    const [row] = await db.select().from(prompts).where(eq(prompts.id, promptId)).limit(1);
    return row || null;
}

export async function listAllPrompts(): Promise<Prompt[]> {
    const rows = await db.select().from(prompts);
    return rows;
}

export async function listPromptsByProject(projectId: string): Promise<Prompt[]> {
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

export async function updatePrompt(promptId: string, data: UpdatePromptBody): Promise<Prompt | null> {
    // Get current
    const [existing] = await db.select().from(prompts).where(eq(prompts.id, promptId)).limit(1);
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

export async function deletePrompt(promptId: string): Promise<boolean> {
    const [deleted] = await db.delete(prompts)
        .where(eq(prompts.id, promptId))
        .returning();
    return !!deleted;
}