import { router } from "server-router";
import { ProjectService } from "@/services/project-service";
import { json } from '@bnk/router';

import { projectsApiValidation, ApiError } from "shared";
import { z } from "zod";
import { FileSummaryService } from "@/services/file-summary-service";
import { UnifiedProviderService } from "@/services/model-providers/providers/unified-provider-service";

const projectService = new ProjectService();
const fileSummaryService = new FileSummaryService();
const unifiedProviderService = new UnifiedProviderService();

router.post("/api/projects", {
    validation: projectsApiValidation.create,
}, async (_, { body }) => {
    const project = await projectService.createProject(body);
    return json({ success: true, project }, { status: 201 });
});

router.get("/api/projects", {}, async () => {
    const projects = await projectService.listProjects();
    return json({ success: true, projects });
});

router.get("/api/projects/:projectId", {
    validation: projectsApiValidation.getOrDelete
}, async (_, { params }) => {
    const project = await projectService.getProjectById(params.projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json({ success: true, project });
});

router.patch("/api/projects/:projectId", {
    validation: projectsApiValidation.update
}, async (_, { params, body }) => {
    const updatedProject = await projectService.updateProject(params.projectId, body);
    if (!updatedProject) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json({ success: true, project: updatedProject });
});

router.delete("/api/projects/:projectId", {
    validation: projectsApiValidation.getOrDelete
}, async (_, { params }) => {
    const deleted = await projectService.deleteProject(params.projectId);
    if (!deleted) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json({ success: true });
});

router.post("/api/projects/:projectId/sync", {
    validation: projectsApiValidation.sync
}, async (_, { params }) => {
    const result = await projectService.syncProject(params.projectId);
    if (!result) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json(result);
});

router.get("/api/projects/:projectId/files", {
    validation: projectsApiValidation.getFiles
}, async (_, { params }) => {
    const files = await projectService.getProjectFiles(params.projectId);
    if (!files) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json({ success: true, files });
});

/**
 * Updated: no longer referencing fileSummaries table. Now uses combined fields in `files`.
 */
router.get("/api/projects/:projectId/file-summaries", {
    validation: {
        params: projectsApiValidation.getFiles.params,
        query: z.object({
            fileIds: z.string().optional(),
        }).optional(),
    },
}, async (_, { params, query }) => {
    const { projectId } = params;
    const fileIds = query?.fileIds?.split(',').filter(Boolean);

    const summaries = await fileSummaryService.getFileSummaries(projectId, fileIds);
    return json({
        success: true,
        summaries,
    });
});

router.post("/api/projects/:projectId/summarize", {
    validation: {
        body: z.object({
            fileIds: z.array(z.string()).nonempty(),
        }),
        params: projectsApiValidation.sync.params,
    },
}, async (_, { params, body }) => {
    const { projectId } = params;
    const { fileIds } = body;

    const project = await projectService.getProjectById(projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }

    const result = await projectService.summarizeSelectedFiles(projectId, fileIds);
    return json({
        success: true,
        ...result,
    });
});

router.post("/api/projects/:projectId/suggest-files", {
    validation: {
        body: z.object({
            userInput: z.string().min(1),
        }),
        params: z.object({
            projectId: z.string(),
        }),
    },
}, async (_, { params, body }) => {
    const { projectId } = params;
    const { userInput } = body;

    const project = await projectService.getProjectById(projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }

    const allSummaries = await fileSummaryService.getFileSummaries(projectId);
    if (!allSummaries.length) {
        return json({
            success: false,
            message: "No summaries available. Please summarize files first."
        });
    }

    let combinedSummaries = "<all_summaries>\n";
    for (const f of allSummaries) {
        combinedSummaries += `File: ${f.id}\n${f.summary}\n\n`;
    }
    combinedSummaries += "</all_summaries>\n";

    const systemPrompt = `
    You are a code assistant that recommends relevant files based on user input.
    You have a list of file summaries and a user request.
    
    **IMPORTANT**: Return only valid JSON containing an array of file IDs in the shape:
    { "fileIds": ["abc123", "def456", ...] }
    
    No markdown, no code fences, no additional text.
    If you are unsure, return an empty array.

    Additionally, consider whether the user’s request indicates creating or modifying a particular type of file (e.g., services, components). In such cases, also include related or similar files that may provide helpful patterns or contextual information.
    `;

    const userMessage = `
    User Query: ${userInput}
    List of files with summaries:
    ${combinedSummaries}
    `;

    console.log("finding suggestions for user input:", userInput);
    console.log("systemPrompt", systemPrompt);
    console.log("userMessage", userMessage);

    try {
        const stream = await unifiedProviderService.processMessage({
            chatId: "fileSuggester",
            userMessage,
            provider: 'openrouter',
            options: {
                model: 'deepseek/deepseek-chat',
                max_tokens: 1024,
                temperature: 0.2,
            },
            systemMessage: systemPrompt,
        });

        const reader = stream.getReader();
        let rawLLMOutput = "";
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            rawLLMOutput += decoder.decode(value);
        }

        // Strip out code fences if present
        let cleanedOutput = rawLLMOutput.trim();
        const tripleBacktickRegex = /```(?:json)?([\s\S]*?)```/;
        const matched = cleanedOutput.match(tripleBacktickRegex);
        if (matched) {
            cleanedOutput = matched[1].trim();
        }

        let recommendedFileIds: string[] = [];
        try {
            const parsed = JSON.parse(cleanedOutput);
            if (
                typeof parsed === 'object' &&
                Array.isArray(parsed.fileIds) &&
                parsed.fileIds.every((id: unknown) => typeof id === 'string')
            ) {
                recommendedFileIds = parsed.fileIds;
            }
        } catch (error) {
            console.error('Failed to parse JSON from LLM:', error);
        }

        return json({
            success: true,
            recommendedFileIds,
            rawLLMOutput,
        });
    } catch (error) {
        console.error("Suggest-files error:", error);
        throw new ApiError("Failed to suggest files", 500, "INTERNAL_ERROR");
    }
});

router.post("/api/projects/:projectId/resummarize-all", {}, async (_, { params }) => {
    const project = await projectService.getProjectById(params.projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    await projectService.resummarizeAllFiles(params.projectId);

    return json({
        success: true,
        message: "All files have been force-resummarized."
    });
});