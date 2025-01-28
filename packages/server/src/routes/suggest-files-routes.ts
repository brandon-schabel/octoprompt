import { router } from "server-router";
import { json } from "@bnk/router";
import { ApiError } from "shared";
import { z } from "zod";
import { fetchStructuredOutput } from "@/utils/structured-output-fetcher";
import { OpenRouterProviderService } from "@/services/model-providers/providers/open-router-provider";
import { getFullProjectSummary } from "@/utils/get-full-project-summary";

const openRouterProviderService = new OpenRouterProviderService();

/**
 * Zod schema for our final structured response:
 * { fileIds: string[] }
 */
export const FileSuggestionsZodSchema = z.object({
    fileIds: z.array(z.string())
});

/**
 * JSON Schema counterpart, passed to the model to enforce valid JSON output.
 */
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

router.post(
    "/api/projects/:projectId/suggest-files",
    {
        validation: {
            body: z.object({
                userInput: z.string().min(1)
            }),
            params: z.object({
                projectId: z.string()
            })
        }
    },
    async (_, { params, body }) => {
        const { projectId } = params;
        const { userInput } = body;

        const projectSummary = await getFullProjectSummary(projectId)


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
            // 1) Use our structured-output-fetcher to get guaranteed-JSON from the LLM
            const result = await fetchStructuredOutput(openRouterProviderService, {
                userMessage,
                systemMessage: systemPrompt,
                zodSchema: FileSuggestionsZodSchema,
                // @ts-ignore
                jsonSchema: FileSuggestionsJsonSchema,
                schemaName: "FileSuggestions",
                model: "deepseek/deepseek-r1",
                // model: "qwen/qvq-72b-preview",
                temperature: 0.2,
                chatId: `project-${projectId}-suggest-files`
            });

            // 2) Return structured response
            return json({
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