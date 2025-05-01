import { db } from "@/utils/database";
import { CreatePromptBody, UpdatePromptBody, Prompt, PromptSchema, PromptProject, PromptProjectSchema } from "shared/src/schemas/prompt.schemas";
import { promptsMap } from '../utils/prompts-map';
import { generateSingleText } from './gen-ai-services';

const formatToISO = (sqlDate: string) => new Date(sqlDate).toISOString();

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


export function mapPromptProject(row: RawPromptProject): PromptProject {
    const mapped = {
        promptId: row.prompt_id,
        projectId: row.project_id
    };
    return PromptProjectSchema.parse(mapped);
}

export async function createPrompt(data: CreatePromptBody): Promise<Prompt> {
    const insertStmt = db.prepare(`
    INSERT INTO prompts (id, name, content, created_at, updated_at) 
    VALUES (lower(hex(randomblob(16))), ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `);
    const created = insertStmt.get(data.name, data.content) as RawPrompt;
    const newPrompt = PromptSchema.parse({
        ...created,
        createdAt: formatToISO(created.created_at),
        updatedAt: formatToISO(created.updated_at)
    });

    if (data.projectId) {
        await addPromptToProject(newPrompt.id, data.projectId);
    }

    return newPrompt;
}

export async function addPromptToProject(promptId: string, projectId: string): Promise<void> {
    // Remove any existing association for the prompt
    const deleteStmt = db.prepare("DELETE FROM prompt_projects WHERE prompt_id = ?");
    deleteStmt.run(promptId);

    // Insert the new association
    const insertStmt = db.prepare("INSERT INTO prompt_projects (id, prompt_id, project_id) VALUES (lower(hex(randomblob(16))), ?, ?)");
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
    return PromptSchema.parse({
        ...found,
        createdAt: formatToISO(found.created_at),
        updatedAt: formatToISO(found.updated_at)
    });
}

export async function listAllPrompts(): Promise<Prompt[]> {
    const stmt = db.prepare("SELECT * FROM prompts");
    const rows = stmt.all() as RawPrompt[];
    return rows.map(row => PromptSchema.parse({
        ...row,
        createdAt: formatToISO(row.created_at),
        updatedAt: formatToISO(row.updated_at)
    }));
}

export async function listPromptsByProject(projectId: string): Promise<Prompt[]> {
    const stmt = db.prepare(`
    SELECT p.* 
    FROM prompts p 
    INNER JOIN prompt_projects pp ON p.id = pp.prompt_id 
    WHERE pp.project_id = ?
  `);
    const rows = stmt.all(projectId) as RawPrompt[];
    return rows.map(row => PromptSchema.parse({
        ...row,
        createdAt: formatToISO(row.created_at),
        updatedAt: formatToISO(row.updated_at)
    }));
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
    // Fix 6: Convert dates before parsing
    return PromptSchema.parse({
        ...updated,
        createdAt: formatToISO(updated.created_at),
        updatedAt: formatToISO(updated.updated_at)
    });
}

export async function deletePrompt(promptId: string): Promise<boolean> {
    const deleteStmt = db.prepare("DELETE FROM prompts WHERE id = ? RETURNING *");
    const deleted = deleteStmt.get(promptId) as RawPrompt | undefined;
    return !!deleted;
}

export async function getPromptProjects(promptId: string): Promise<PromptProject[]> {
    const stmt = db.prepare("SELECT * FROM prompt_projects WHERE prompt_id = ?");
    const rows = stmt.all(promptId) as RawPromptProject[];
    return rows.map(row => PromptProjectSchema.parse(row));
}

/**
 * Takes the user's original context/intent/prompt and uses a model
 * to generate a refined (optimized) version of that prompt.
 */
export async function optimizePrompt(userContext: string): Promise<string> {
    const systemMessage = `
<SystemPrompt>
You are the Promptimizer, a specialized assistant that refines or rewrites user queries into
more effective prompts. Given the user's context or goal, output ONLY the single optimized prompt.
No additional commentary, no extraneous text, no markdown formatting.
</SystemPrompt>

<Reasoning>
Follow the style guidelines and key requirements below:
${promptsMap.contemplativePrompt}
</Reasoning>
`; // Ensure promptsMap.contemplativePrompt is loaded

    const userMessage = userContext.trim();
    if (!userMessage) {
        return '';
    }

    try {
        // Use generateSingleText for non-streaming prompt generation
        const optimizedPrompt = await generateSingleText({
            systemMessage: systemMessage,
            prompt: userMessage, // User context is the prompt here
        });

        return optimizedPrompt.trim();

    } catch (error) {
        console.error('[PromptimizerService] Failed to optimize prompt:', error);
        // Fallback to the original user message on error
        return userMessage;
    }
}