import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { ApiError } from 'shared';
import { chatRoutes } from './routes/chat-routes';
import { structuredOutputRoutes } from './routes/structured-output-routes';
import { ticketRoutes } from './routes/ticket-routes';
import { projectRoutes } from './routes/project-routes';
import { promptimizerRoutes } from './routes/promptimizer-routes';
import { providerKeyRoutes } from './routes/provider-key-routes';
import { stateRoutes } from './routes/state-routes';
import { adminRoutes } from './routes/admin-routes';
import { aiFileChangeRoutes } from './routes/ai-file-change-routes';
import { promptRoutes } from './routes/prompt-routes';
import { OpenAPIHono, z } from '@hono/zod-openapi';
import packageJson from '../package.json'
import { corsConfig } from './constants/server-config';
import { swaggerUI } from '@hono/swagger-ui'
import { ApiErrorResponseSchema } from 'shared/src/validation/chat-api-validation';

// Helper to format Zod errors for more readable responses
const formatZodErrors = (error: z.ZodError) => {
    return error.flatten().fieldErrors;
};

// Initialize the Hono app with default error handling for validation
export const app = new OpenAPIHono({
    defaultHook: (result, c) => {
        if (!result.success) {
            console.error('Validation Error:', JSON.stringify(result.error.issues, null, 2));
            return c.json(
                {
                    success: false,
                    error: 'Validation Failed',
                    code: 'VALIDATION_ERROR',
                    details: formatZodErrors(result.error),
                } satisfies z.infer<typeof ApiErrorResponseSchema>,
                422
            );
        }
    },
});

// Add CORS middleware
app.use('*', cors(corsConfig));

// Add logger middleware
app.use('*', logger());

app.get("/api/health", (c) => c.json({ success: true }));

// register all hono routes
app.route('/', chatRoutes)
app.route('/', structuredOutputRoutes)
app.route('/', ticketRoutes)
app.route('/', projectRoutes)
app.route('/', promptimizerRoutes)
app.route('/', providerKeyRoutes)
app.route('/', stateRoutes)
app.route('/', adminRoutes)
app.route('/', aiFileChangeRoutes)
app.route('/', promptRoutes)

// Global error handler
app.onError((err, c) => {
    console.error("[ErrorHandler]", err);

    let statusCode = 500;
    let responseBody: z.infer<typeof ApiErrorResponseSchema>;

    if (err instanceof ApiError) {
        console.error(`[ErrorHandler] ApiError: ${err.status} - ${err.code} - ${err.message}`);
        statusCode = err.status;
        responseBody = {
            success: false,
            error: err.message,
            code: err.code || 'API_ERROR',
            details: err.details
        };
    } else if (err instanceof z.ZodError) {
        console.error("[ErrorHandler] ZodError (fallback):", err.issues);
        statusCode = 422;
        responseBody = {
            success: false,
            error: 'Invalid Data Provided',
            code: 'VALIDATION_ERROR',
            details: formatZodErrors(err),
        };
    } else if (err instanceof Error) {
        console.error(`[ErrorHandler] Generic Error: ${err.message}`);
        // Handle not found errors
        if (err.message.includes('not found') || 
            err.message.toLowerCase().includes('does not exist') ||
            err.message.toLowerCase().includes('cannot find')) {
            statusCode = 404;
            responseBody = {
                success: false,
                error: err.message,
                code: 'NOT_FOUND',
            };
        } else {
            // Default internal server error
            responseBody = {
                success: false,
                error: 'Internal Server Error',
                code: 'INTERNAL_SERVER_ERROR',
                details: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
            };
        }
    } else {
        // Non-Error object thrown
        console.error("[ErrorHandler] Unknown throwable:", err);
        responseBody = {
            success: false,
            error: 'An unexpected error occurred',
            code: 'UNKNOWN_ERROR',
        };
    }

    return c.json(responseBody, statusCode as any);
});

// server swagger ui at /swagger
app.get('/swagger', swaggerUI({ url: '/doc' }))

app.doc('/doc', {
    openapi: '3.1.1',
    info: {
        description: "OctoPrompt OpenAPI Server Spec",
        version: packageJson.version,
        title: packageJson.name,
    }
})