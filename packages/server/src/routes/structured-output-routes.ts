import app from '@/server-router';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ApiError, structuredOutputSchemas, StructuredOutputType } from 'shared/index';
import { generateStructuredOutput } from '@/services/structured-output-service';

const structuredOutputRequestSchema = z.object({
    outputType: z.string(),
    userMessage: z.string(),
    systemMessage: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().optional(),
    chatId: z.string().optional()
});

type StructuredOutputRequest = z.infer<typeof structuredOutputRequestSchema>;

app.post(
    '/api/structured-outputs',
    zValidator('json', structuredOutputRequestSchema),
    async (c) => {
        const body = await c.req.valid('json');
        const { outputType, userMessage, ...rest } = body as StructuredOutputRequest;

        // Type-check the outputType to ensure it's a valid StructuredOutputType
        if (!(outputType in structuredOutputSchemas)) {
            throw new ApiError(`Invalid output type: ${outputType}`, 400, 'INVALID_OUTPUT_TYPE');
        }

        try {
            const result = await generateStructuredOutput({
                outputType: outputType as StructuredOutputType,
                userMessage,
                ...rest
            });

            return c.json({ success: true, data: result });
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(
                `Failed to generate structured output: ${String(error)}`,
                500,
                'STRUCTURED_OUTPUT_ERROR'
            );
        }
    }
);