import { zValidator } from '@hono/zod-validator';
import { OpenAPIHono, z } from '@hono/zod-openapi';
import { ApiError, structuredOutputSchemas, StructuredOutputType } from 'shared/index';
import { generateStructuredOutput } from '@/services/structured-output-service';

const structuredOutputRequestSchema = z.object({
    outputType: z.string().openapi({ example: 'TaskList' }), // Example for documentation
    userMessage: z.string().openapi({ example: 'Create tasks for implementing user auth.' }),
    systemMessage: z.string().optional().openapi({ example: 'You generate lists of tasks.' }),
    model: z.string().optional().openapi({ example: 'gpt-4o' }),
    temperature: z.number().optional().openapi({ example: 0.5 }),
    chatId: z.string().optional().openapi({ example: 'chat-123-tasks' })
});

type StructuredOutputRequest = z.infer<typeof structuredOutputRequestSchema>;

// Create a new Hono instance for structured output routes
export const structuredOutputRoutes = new OpenAPIHono().post(
    '/api/structured-outputs',
    zValidator('json', structuredOutputRequestSchema),
    async (c) => {
        const body = c.req.valid('json');
        const { outputType, userMessage, ...rest } = body as StructuredOutputRequest; // Type assertion is fine here

        // Validate outputType against known schemas
        if (!(outputType in structuredOutputSchemas)) {
            throw new ApiError(400, `Invalid output type specified: ${outputType}. Valid types are: ${Object.keys(structuredOutputSchemas).join(', ')}`, 'INVALID_OUTPUT_TYPE');
        }

        try {
            const result = await generateStructuredOutput({
                // Cast to the specific union type after the check
                outputType: outputType as StructuredOutputType,
                userMessage,
                ...rest
            });

            return c.json({ success: true, data: result });
        } catch (error) {
            console.error(`Error generating structured output (${outputType}):`, error);
            // Re-throw specific ApiErrors, wrap others
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(
                500,
                `Failed to generate structured output: ${String(error)}`,
                'STRUCTURED_OUTPUT_ERROR'
            );
        }
    }
);

// Export the type for the frontend client
export type StructuredOutputRouteTypes = typeof structuredOutputRoutes;