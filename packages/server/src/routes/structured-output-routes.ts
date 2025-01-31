/**
 * packages/server/src/routes/structured-output-routes.ts
 */
import { json } from '@bnk/router';
import { z } from 'zod';
import { ApiError, structuredOutputSchemas, StructuredOutputType } from 'shared/index';
import { structuredOutputsService } from '../services/structured-output-service';
import { router } from 'server-router';

// Define the request schema using Zod
const structuredOutputRequestSchema = z.object({
    outputType: z.string(),
    userMessage: z.string(),
    systemMessage: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().optional(),
    chatId: z.string().optional()
});

type StructuredOutputRequest = z.infer<typeof structuredOutputRequestSchema>;

/**
 * POST /api/structured-outputs
 * Generate structured output based on the provided type and message
 */
router.post(
    '/api/structured-outputs',
    {
        validation: {
            body: structuredOutputRequestSchema,
        },
    },
    async (_, { body }) => {
        const { outputType, userMessage, ...rest } = body as StructuredOutputRequest;

        // Type-check the outputType to ensure it's a valid StructuredOutputType
        if (!(outputType in structuredOutputSchemas)) {
            throw new ApiError(`Invalid output type: ${outputType}`, 400, 'INVALID_OUTPUT_TYPE');
        }

        try {
            const result = await structuredOutputsService.generate({
                outputType: outputType as StructuredOutputType,
                userMessage,
                ...rest
            });
            
            return json({ success: true, data: result });
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