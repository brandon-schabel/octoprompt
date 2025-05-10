import { db } from "@/utils/database";
import { CreatePromptBody, UpdatePromptBody, Prompt, PromptSchema, PromptProject, PromptProjectSchema } from "shared/src/schemas/prompt.schemas";
import { promptsMap } from '../utils/prompts-map';
import { generateSingleText } from './gen-ai-services';
import { ApiError } from 'shared';

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
    const createdRaw = insertStmt.get(data.name, data.content) as RawPrompt | undefined;
    if (!createdRaw) {
        throw new ApiError(500, "Failed to create prompt", "PROMPT_CREATE_FAILED");
    }
    const newPrompt = PromptSchema.parse({
        ...createdRaw,
        createdAt: formatToISO(createdRaw.created_at),
        updatedAt: formatToISO(createdRaw.updated_at)
    });

    if (data.projectId) {
        await addPromptToProject(newPrompt.id, data.projectId);
    }

    return newPrompt;
}

export async function addPromptToProject(promptId: string, projectId: string): Promise<void> {
    const promptExists = db.prepare("SELECT id FROM prompts WHERE id = ?").get(promptId);
    if (!promptExists) {
        throw new ApiError(404, `Prompt with ID ${promptId} not found.`, 'PROMPT_NOT_FOUND');
    }

    db.prepare("DELETE FROM prompt_projects WHERE prompt_id = ?").run(promptId);

    const insertStmt = db.prepare("INSERT INTO prompt_projects (id, prompt_id, project_id) VALUES (lower(hex(randomblob(16))), ?, ?)");
    const info = insertStmt.run(promptId, projectId);
    if (info.changes === 0) {
        throw new ApiError(500, `Failed to link prompt ${promptId} to project ${projectId}.`, 'PROMPT_LINK_FAILED');
    }
}

export async function removePromptFromProject(promptId: string, projectId: string): Promise<void> {
    const stmt = db.prepare("DELETE FROM prompt_projects WHERE prompt_id = ? AND project_id = ?");
    const info = stmt.run(promptId, projectId);
    if (info.changes === 0) {
        const promptExists = await getPromptById(promptId);
        if (!promptExists) {
             throw new ApiError(404, `Prompt with ID ${promptId} not found.`, 'PROMPT_NOT_FOUND');
        }
        throw new ApiError(404, `Association between prompt ${promptId} and project ${projectId} not found.`, 'PROMPT_PROJECT_LINK_NOT_FOUND');
    }
}

export async function getPromptById(promptId: string): Promise<Prompt> {
    const stmt = db.prepare("SELECT * FROM prompts WHERE id = ? LIMIT 1");
    const found = stmt.get(promptId) as RawPrompt | undefined;
    if (!found) {
        throw new ApiError(404, `Prompt with ID ${promptId} not found.`, "PROMPT_NOT_FOUND");
    }
    return PromptSchema.parse({
        ...found,
        createdAt: formatToISO(found.created_at),
        updatedAt: formatToISO(found.updated_at)
    });
}

export async function listAllPrompts(): Promise<Prompt[]> {
    const stmt = db.prepare("SELECT * FROM prompts");
    const rows = stmt.all() as RawPrompt[];
    if (!rows) {
        return [];
    }
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

export async function updatePrompt(promptId: string, data: UpdatePromptBody): Promise<Prompt> {
    const existing = await getPromptById(promptId);

    const updateStmt = db.prepare(`
    UPDATE prompts 
    SET name = ?, content = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
    RETURNING *
  `);
    const updatedRaw = updateStmt.get(
        data.name ?? existing.name,
        data.content ?? existing.content,
        promptId
    ) as RawPrompt | undefined;

    if (!updatedRaw) {
        throw new ApiError(500, `Failed to update prompt ${promptId} after confirming existence.`, "PROMPT_UPDATE_FAILED");
    }
    return PromptSchema.parse({
        ...updatedRaw,
        createdAt: formatToISO(updatedRaw.created_at),
        updatedAt: formatToISO(updatedRaw.updated_at)
    });
}

export async function deletePrompt(promptId: string): Promise<boolean> {
    db.prepare("DELETE FROM prompt_projects WHERE prompt_id = ?").run(promptId);

    const deleteStmt = db.prepare("DELETE FROM prompts WHERE id = ?");
    const info = deleteStmt.run(promptId);
    return info.changes > 0;
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
`;

    const userMessage = userContext.trim();
    if (!userMessage) {
        return '';
    }

    try {
        const optimizedPrompt = await generateSingleText({
            systemMessage: systemMessage,
            prompt: userMessage,
        });

        return optimizedPrompt.trim();

    } catch (error: any) {
        console.error('[PromptimizerService] Failed to optimize prompt:', error);
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(500, `Failed to optimize prompt: ${error.message || 'AI provider error'}`, 'PROMPT_OPTIMIZE_ERROR', { originalError: error });
    }
}