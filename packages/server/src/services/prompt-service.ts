import { db } from "@/utils/database";
import { schema } from "shared";
import { CreatePromptBody, UpdatePromptBody } from "shared";
import { PromptReadSchema, PromptProjectReadSchema } from "shared/src/utils/database/db-schemas";

type Prompt = schema.Prompt;
type PromptProject = {
    promptId: string;
    projectId: string;
};

export type RawPrompt = {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type RawPromptProject = {
  prompt_id: string;
  project_id: string;
};

export function mapPrompt(row: RawPrompt): Prompt {
    const parsedCreatedAt = !isNaN(Number(row.created_at)) ? Number(row.created_at) : new Date(row.created_at).getTime();
    const parsedUpdatedAt = !isNaN(Number(row.updated_at)) ? Number(row.updated_at) : new Date(row.updated_at).getTime();
    const mapped = {
        id: row.id,
        name: row.name,
        content: row.content,
        createdAt: parsedCreatedAt,
        updatedAt: parsedUpdatedAt
    };
    const prompt = PromptReadSchema.parse(mapped);
    return {
        ...prompt,
        createdAt: new Date(prompt.createdAt),
        updatedAt: new Date(prompt.updatedAt)
    };
}

export function mapPromptProject(row: RawPromptProject): PromptProject {
    const mapped = {
        promptId: row.prompt_id,
        projectId: row.project_id
    };
    return PromptProjectReadSchema.parse(mapped);
}

export async function createPrompt(data: CreatePromptBody): Promise<Prompt> {
    const insertStmt = db.prepare(`
    INSERT INTO prompts (name, content, created_at, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `);
    const created = insertStmt.get(data.name, data.content) as RawPrompt;
    const newPrompt = mapPrompt(created);

    if (data.projectId) {
        await addPromptToProject(newPrompt.id, data.projectId);
    }

    return newPrompt;
}

export async function addPromptToProject(promptId: string, projectId: string): Promise<void> {
    const insertStmt = db.prepare("INSERT INTO prompt_projects (prompt_id, project_id) VALUES (?, ?)");
    insertStmt.run(promptId, projectId);
}

export async function removePromptFromProject(promptId: string, projectId: string): Promise<void> {
    const deleteStmt = db.prepare("DELETE FROM prompt_projects WHERE prompt_id = ? AND project_id = ?");
    deleteStmt.run(promptId, projectId);
}

export async function getPromptById(promptId: string): Promise<Prompt | null> {
    const stmt = db.prepare("SELECT * FROM prompts WHERE id = ? LIMIT 1");
    const found = stmt.get(promptId) as RawPrompt | undefined;
    if (!found) return null;
    return mapPrompt(found);
}

export async function listAllPrompts(): Promise<Prompt[]> {
    const stmt = db.prepare("SELECT * FROM prompts");
    const rows = stmt.all() as RawPrompt[];
    return rows.map(mapPrompt);
}

export async function listPromptsByProject(projectId: string): Promise<Prompt[]> {
    const stmt = db.prepare(`
    SELECT p.* 
    FROM prompts p 
    INNER JOIN prompt_projects pp ON p.id = pp.prompt_id 
    WHERE pp.project_id = ?
  `);
    const rows = stmt.all(projectId) as RawPrompt[];
    return rows.map(mapPrompt);
}

export async function updatePrompt(promptId: string, data: UpdatePromptBody): Promise<Prompt | null> {
    const existing = await getPromptById(promptId);
    if (!existing) return null;

    const updateStmt = db.prepare(`
    UPDATE prompts 
    SET name = ?, content = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
    RETURNING *
  `);
    const updated = updateStmt.get(
        data.name ?? existing.name,
        data.content ?? existing.content,
        promptId
    ) as RawPrompt;
    return mapPrompt(updated);
}

export async function deletePrompt(promptId: string): Promise<boolean> {
    const deleteStmt = db.prepare("DELETE FROM prompts WHERE id = ? RETURNING *");
    const deleted = deleteStmt.get(promptId) as RawPrompt | undefined;
    return !!deleted;
}

export async function getPromptProjects(promptId: string): Promise<PromptProject[]> {
    const stmt = db.prepare("SELECT * FROM prompt_projects WHERE prompt_id = ?");
    const rows = stmt.all(promptId) as RawPromptProject[];
    return rows.map(mapPromptProject);
}