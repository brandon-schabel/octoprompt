import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema } from 'shared/src/schemas/common.schemas'

const EnvironmentInfoSchema = z
  .object({
    NODE_ENV: z.string().nullable(),
    BUN_ENV: z.string().nullable(),
    SERVER_PORT: z.string().nullable()
  })
  .openapi('EnvironmentInfo')

const DatabaseStatsSchema = z
  .object({
    chats: z.object({ count: z.number() }),
    chat_messages: z.object({ count: z.number() }),
    projects: z.object({ count: z.number() }),
    files: z.object({ count: z.number() }),
    prompts: z.object({ count: z.number() }),
    prompt_projects: z.object({ count: z.number() }),
    provider_keys: z.object({ count: z.number() }),
    tickets: z.object({ count: z.number() }),
    ticket_files: z.object({ count: z.number() }),
    ticket_tasks: z.object({ count: z.number() }),
    file_changes: z.object({ count: z.number() })
  })
  .openapi('DatabaseStats')

const ServerInfoSchema = z
  .object({
    version: z.string(),
    bunVersion: z.string(),
    platform: z.string(),
    arch: z.string(),
    memoryUsage: z.object({
      rss: z.number(),
      heapTotal: z.number(),
      heapUsed: z.number(),
      external: z.number(),
      arrayBuffers: z.number()
    }),
    uptime: z.number()
  })
  .openapi('ServerInfo')

const EnvInfoResponseSchema = z
  .object({
    success: z.literal(true),
    environment: EnvironmentInfoSchema,
    serverInfo: ServerInfoSchema,
    databaseStats: DatabaseStatsSchema
  })
  .openapi('EnvInfoResponse')

const SystemStatusResponseSchema = z
  .object({
    success: z.literal(true),
    status: z.string(),
    checks: z.object({
      api: z.string(),
      timestamp: z.string()
    })
  })
  .openapi('SystemStatusResponse')

// Route definitions
const getEnvInfoRoute = createRoute({
  method: 'get',
  path: '/api/admin/env-info',
  tags: ['Admin'],
  summary: 'Get system environment information and database statistics',
  responses: {
    200: {
      content: { 'application/json': { schema: EnvInfoResponseSchema } },
      description: 'Successfully retrieved environment information'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Error retrieving environment information'
    }
  }
})

const getSystemStatusRoute = createRoute({
  method: 'get',
  path: '/api/admin/system-status',
  tags: ['Admin'],
  summary: 'Check system operational status',
  responses: {
    200: {
      content: { 'application/json': { schema: SystemStatusResponseSchema } },
      description: 'Successfully retrieved system status'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Error retrieving system status'
    }
  }
})

export const adminRoutes = new OpenAPIHono()
  .openapi(getEnvInfoRoute, async (c) => {
    try {
      const envInfo = {
        NODE_ENV: process.env.NODE_ENV ?? null,
        BUN_ENV: process.env.BUN_ENV ?? null,
        SERVER_PORT: process.env.PORT ?? null
      }



      const serverInfo = {
        version: process.version,
        bunVersion: Bun.version,
        platform: process.platform,
        arch: process.arch,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }

      const payload: z.infer<typeof EnvInfoResponseSchema> = {
        success: true,
        environment: envInfo,
        serverInfo: serverInfo,
      }
      return c.json(payload, 200)
    } catch (e) {
      console.error('Failed to get environment info:', e)
      const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
        success: false,
        error: {
          message: 'Failed to get environment info',
          code: 'ENV_INFO_ERROR',
          details: {}
        }
      }
      return c.json(errorPayload, 500)
    }
  })
  .openapi(getSystemStatusRoute, async (c) => {
    try {
      // Create properly typed payload
      const payload: z.infer<typeof SystemStatusResponseSchema> = {
        success: true,
        status: 'operational',
        checks: {
          api: 'healthy',
          timestamp: new Date().toISOString()
        }
      }
      return c.json(payload, 200)
    } catch (e) {
      console.error('Failed to get system status:', e)
      const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
        success: false,
        error: {
          message: 'Failed to get system status',
          code: 'SYSTEM_STATUS_ERROR',
          details: {}
        }
      }
      return c.json(errorPayload, 500)
    }
  })

export type AdminRouteTypes = typeof adminRoutes
