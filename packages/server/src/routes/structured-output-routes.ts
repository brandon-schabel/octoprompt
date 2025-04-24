import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { ApiError, structuredOutputSchemas, StructuredOutputType } from 'shared/index';
import { generateStructuredOutput } from '@/services/structured-output-service';
import { ApiErrorResponseSchema } from 'shared/src/schemas/common.schemas';

// Request schema
const StructuredOutputRequestSchema = z.object({
    outputType: z.string().openapi({ example: 'TaskList', description: 'Type of structured output to generate' }),
    userMessage: z.string().openapi({ example: 'Create tasks for implementing user auth.', description: 'User prompt for generating the output' }),
    systemMessage: z.string().optional().openapi({ example: 'You generate lists of tasks.', description: 'Optional system prompt' }),
    model: z.string().optional().openapi({ example: 'gpt-4o', description: 'Optional model to use' }),
    temperature: z.number().optional().openapi({ example: 0.5, description: 'Optional temperature parameter' }),
    chatId: z.string().optional().openapi({ example: 'chat-123-tasks', description: 'Optional chat ID for tracking' })
}).openapi('StructuredOutputRequest');

// Response schema - generic to handle different output types
const StructuredOutputResponseSchema = z.object({
    success: z.literal(true),
    data: z.any() // The actual type depends on outputType
}).openapi('StructuredOutputResponse');

// Create route definition
const generateStructuredOutputRoute = createRoute({
    method: 'post',
    path: '/api/structured-outputs',
    tags: ['AI', 'Structured Output'],
    summary: 'Generate structured output based on a specific schema',
    request: {
        body: { content: { 'application/json': { schema: StructuredOutputRequestSchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: StructuredOutputResponseSchema } }, description: 'Successfully generated structured output' },
        400: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Invalid request or unsupported output type' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Error generating structured output' },
    },
});

export const structuredOutputRoutes = new OpenAPIHono()
    .openapi(generateStructuredOutputRoute, async (c) => {
        const { outputType, userMessage, ...rest } = c.req.valid('json');

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

            // Explicitly type the success payload
            const payload: z.infer<typeof StructuredOutputResponseSchema> = {
                success: true,
                data: result
            };
            return c.json(payload, 200); // Explicitly add status code
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
    });

export type StructuredOutputRouteTypes = typeof structuredOutputRoutes;