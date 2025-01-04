import { router } from "server-router";
import { ProjectService } from "@/services/project-service";
import { json } from '@bnk/router';

import { projectsApiValidation, ApiError } from "shared";
import { z } from "zod";
import { FileSummaryService } from "@/services/file-summary-service";
import { ProviderChatService } from "@/services/model-providers/chat/provider-chat-service";

const projectService = new ProjectService();
const fileSummaryService = new FileSummaryService()
const providerChatService = new ProviderChatService()

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

    const fileSummaryService = new FileSummaryService();
    const summaries = await fileSummaryService.getFileSummaries(projectId, fileIds);

    return json({
        success: true,
        summaries,
    });
});

router.post("/api/projects/:projectId/summarize", {
    validation: {
        // We expect an array of file IDs in the body
        body: z.object({
            fileIds: z.array(z.string()).nonempty(),
        }),
        // Reuse the projectId param checks
        params: projectsApiValidation.sync.params,
    },
}, async (_, { params, body }) => {
    const { projectId } = params
    const { fileIds } = body

    // 1. Check if project exists
    const project = await projectService.getProjectById(projectId)
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND")
    }

    // 2. Summarize the selected files
    const result = await projectService.summarizeSelectedFiles(projectId, fileIds)

    return json({
        success: true,
        ...result,
    })
})

// We create a new endpoint to handle "find suggested files"
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
    const { projectId } = params
    const { userInput } = body

    // 1) Ensure the project exists
    const project = await projectService.getProjectById(projectId)
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND")
    }

    // 2) Retrieve all file summaries for the project
    const allSummaries = await fileSummaryService.getFileSummaries(projectId)

    // If no summaries exist, you might want to run summarize first or just bail out
    if (!allSummaries.length) {
        return json({
            success: false,
            message: "No summaries available. Please summarize files first."
        })
    }

    // 3) Build a single combined template with all summary content + file paths
    //    Format it however you want. For example:
    let combinedSummaries = "<all_summaries>\n"
    for (const summary of allSummaries) {
        combinedSummaries += `File: ${summary.fileId}\n${summary.summary}\n\n`
    }
    combinedSummaries += "</all_summaries>\n"

    // 4) Now we call OpenRouter (or other LLM) to figure out recommended files
    //    We'll pass the user’s input + the combinedSummaries to the model
    //    In the best scenario, your prompt or systemMessage instructs the model to return an array of recommended fileIds.
    const systemPrompt = `
    You are a code assistant that recommends relevant files based on user input.
    You have a list of file summaries and a user request.
     
    **IMPORTANT**: Return only valid JSON containing an array of file IDs in the shape:
    { "fileIds": ["abc123", "def456", ...] }
    
    No markdown, no code fences, no additional text.
    If you are unsure, return an empty array.
    `
    const userMessage = `
    User Query: ${userInput}
    
    List of files with summaries:
    ${combinedSummaries}
    `

    try {
        // 4a) Use your existing ProviderChatService or whichever is appropriate:
        const stream = await providerChatService.processMessage({
            chatId: "fileSuggester",
            userMessage,
            provider: 'openrouter',
            options: {
                model: 'deepseek/deepseek-chat',
                max_tokens: 1024,
                temperature: 0.2,
                // debug: true
            },
            systemMessage: systemPrompt,
        })

        // 4b) Accumulate the streamed text
        const reader = stream.getReader()
        let rawLLMOutput = ""
        const decoder = new TextDecoder()
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            rawLLMOutput += decoder.decode(value)
        }

        // 4c) Try to parse the LLM result as JSON. 
        // The LLM might not always return valid JSON, so handle errors gracefully.
        let recommendedFileIds: string[] = []
        try {
            // parse rawLLMOutput as JSON
            const parsed = JSON.parse(rawLLMOutput.trim())
            if (
                typeof parsed === 'object' &&
                Array.isArray(parsed.fileIds) &&
                parsed.fileIds.every((id: any) => typeof id === 'string')
            ) {
                recommendedFileIds = parsed.fileIds
            }
        } catch (error) {
            console.error('Failed to parse JSON from LLM:', error)
        }

        return json({
            success: true,
            recommendedFileIds,
            rawLLMOutput,
        })
    } catch (error) {
        console.error("Suggest-files error:", error)
        throw new ApiError("Failed to suggest files", 500, "INTERNAL_ERROR")
    }
})