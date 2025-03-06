import app from "@/server-router";
import { zValidator } from "@hono/zod-validator";
import { ApiError } from "shared";
import { z } from "zod";
import { fetchStructuredOutput } from "@/utils/structured-output-fetcher";
import { getFullProjectSummary } from "@/utils/get-full-project-summary";
import { DEFAULT_MODEL_CONFIGS } from "shared";
import { openRouterProvider } from "@/services/model-providers/providers/open-router-provider";

export const FileSuggestionsZodSchema = z.object({
    fileIds: z.array(z.string())
});

export const FileSuggestionsJsonSchema = {
    type: "object",
    properties: {
        fileIds: {
            type: "array",
            items: { type: "string" },
            description: "An array of file IDs relevant to the user input"
        }
    },
    required: ["fileIds"],
    additionalProperties: false
};

app.post(
    "/api/projects/:projectId/suggest-files",
    zValidator('param', z.object({
        projectId: z.string()
    })),
    zValidator('json', z.object({
        userInput: z.string().min(1)
    })),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const { userInput } = await c.req.valid('json');

        const projectSummary = await getFullProjectSummary(projectId);

        // The system prompt instructs the model to recommend relevant files
        const systemPrompt = `
      You are a code assistant that recommends relevant files based on user input.
      You have a list of file summaries and a user request.

      Return only valid JSON with the shape: {"fileIds": ["abc123", "def456"]}

      Guidelines:
      - For simple tasks: return max 5 files
      - For complex tasks: return max 10 files
      - For very complex tasks: return max 20 files
      - Do not add comments in your response
      - Strictly follow the JSON schema, do not add any additional properties or comments
    `;

        // Combine the user's question with the newly built, filtered summaries
        const userMessage = `
      User Query: ${userInput}

      Below is a combined summary of project files:
      ${projectSummary}
    `;

        try {
            const cfg = DEFAULT_MODEL_CONFIGS['suggest-code-files'];
            // 1) Use our structured-output-fetcher to get guaranteed-JSON from the LLM
            const result = await fetchStructuredOutput(openRouterProvider, {
                userMessage,
                systemMessage: systemPrompt,
                zodSchema: FileSuggestionsZodSchema,
                // @ts-ignore
                jsonSchema: FileSuggestionsJsonSchema,
                schemaName: "FileSuggestions",
                model: cfg.model,
                temperature: cfg.temperature,
                chatId: `project-${projectId}-suggest-files`
            });

            // 2) Return structured response
            return c.json({
                success: true,
                recommendedFileIds: result.fileIds,
                // Optionally, you could include the final combined summaries in your response if desired:
                combinedSummaries: projectSummary
            });
        } catch (error) {
            console.error("[SuggestFiles] Error:", error);
            throw new ApiError("Failed to suggest files", 500, "INTERNAL_ERROR");
        }
    }
);