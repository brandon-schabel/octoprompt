import { serve } from 'bun'
import { join } from 'node:path'
import { statSync } from 'node:fs'
import { app } from './src/app'

import { listProjects, getJobQueue, createLogger } from '@promptliano/services'
import { getServerConfig } from '@promptliano/config'
import { watchersManager, createCleanupService } from '@promptliano/services'
import { gitWorktreeHandlers } from '@promptliano/services/src/job-handlers/git-worktree-handlers'
import { getWebSocketManager } from './src/services/websocket-manager'

const logger = createLogger('Server')

const serverConfig = getServerConfig()

// Use the imported watchersManager, remove the local creation
// export const watchersManager = createWatchersManager();
const cleanupService = createCleanupService({
  intervalMs: 5 * 60 * 1000
})

// in dev client dist is relative to the server file so it would be server/client-dist
// in build it is relative to the root so it would be dist/client-dist
const CLIENT_PATH = serverConfig.isDevEnv ? join(import.meta.dir, 'client-dist') : './client-dist'

type ServerConfig = {
  port?: number
}

type Server = ReturnType<typeof serve>

export async function instantiateServer({ port = serverConfig.serverPort }: ServerConfig = {}): Promise<Server> {
  logger.info(`Starting server initialization on port ${port}...`)
  const server = serve({
    idleTimeout: 255,
    port,
    async fetch(req: Request): Promise<Response | undefined> {
      const url = new URL(req.url)

      if (url.pathname === '/') {
        return new Response(Bun.file(join(CLIENT_PATH, 'index.html')))
      }

      if (url.pathname === '/ws') {
        const clientId = crypto.randomUUID()
        const upgraded: boolean = server.upgrade(req, { data: { clientId } })
        return upgraded ? undefined : new Response('WebSocket upgrade failed', { status: 400 })
      }

      // FIXED: Always return API responses for API routes, regardless of status code
      if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) {
        logger.debug(`Routing ${req.method} ${url.pathname} to Hono app`)
        const response = await app.fetch(req)
        logger.debug(`Hono response status: ${response.status}`)
        return response
      }

      const isStaticFile = /\.(js|css|html|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(url.pathname)
      if (isStaticFile) {
        return serveStatic(url.pathname)
      }

      // For non-API routes, try Hono first, then fallback to frontend
      const honoResponse = await app.fetch(req)
      if (honoResponse && honoResponse.status !== 404) {
        return honoResponse
      }

      const frontendEnpoints = ['/projects', '/chat']
      if (frontendEnpoints.includes(url.pathname)) {
        return serveStatic('index.html')
      }

      return serveStatic('index.html')
    },

    websocket: {
      async open(ws) {
        const wsManager = getWebSocketManager()
        wsManager.addClient(ws)
      },
      close(ws) {
        const wsManager = getWebSocketManager()
        wsManager.removeClient((ws.data as any).clientId)
      },
      async message(ws, rawMessage) {
        try {
          const wsManager = getWebSocketManager()
          const message = typeof rawMessage === 'string' ? rawMessage : rawMessage.toString()
          wsManager.handleMessage(ws, message)
        } catch (err) {
          logger.error('Error handling WS message', err)
        }
      }
    }
  })

  // Start watchers for existing projects
  ;(async () => {
    logger.info('Starting project watchers...')
    try {
      const allProjects = await listProjects()
      logger.info(`Found ${allProjects.length} projects to watch`)
      for (const project of allProjects) {
        // TODO: this seems to slow down server startup sometimes, so this this should be done async/in a different process
        watchersManager.startWatchingProject(project, ['node_modules', 'dist', '.git', '*.tmp', '*.db-journal'])
      }
      logger.info('Project watchers started')
    } catch (error) {
      logger.error('Error starting project watchers', error)
    }

    cleanupService.start()

    // Initialize job queue
    logger.info('Initializing job queue...')
    const jobQueue = getJobQueue()

    // Register git worktree handlers
    for (const handler of gitWorktreeHandlers) {
      jobQueue.registerHandler(handler)
    }

    // Connect job events to WebSocket
    const wsManager = getWebSocketManager()
    jobQueue.on('job-event', (event) => {
      wsManager.sendJobEvent(event)
    })

    // Start job processing
    jobQueue.startProcessing()
    logger.info('Job queue started')
  })()

  logger.info(`Server running at http://localhost:${server.port}`)
  logger.info(`Server swagger at http://localhost:${server.port}/swagger`)
  logger.info(`Server docs at http://localhost:${server.port}/doc`)

  // Flush stdout to ensure Tauri can read the output
  if (process.stdout.isTTY) {
    process.stdout.write('')
  }

  return server
}

function serveStatic(path: string): Response {
  try {
    const filePath = join(CLIENT_PATH, path)
    const stat = statSync(filePath)
    if (stat.isFile()) {
      return new Response(Bun.file(filePath))
    }
    return new Response(Bun.file(join(CLIENT_PATH, 'index.html')))
  } catch {
    return new Response(Bun.file(join(CLIENT_PATH, 'index.html')))
  }
}

if (import.meta.main) {
  ;(async () => {
    // Parse command line arguments
    const args = process.argv.slice(2)

    // Check if we should start in MCP stdio mode
    if (args.includes('--mcp-stdio')) {
      // Import and start MCP stdio server directly
      logger.info('Starting Promptliano MCP server in stdio mode...')
      if (process.platform === 'win32') {
        logger.info('Running on Windows - ensuring compatible stdio handling')
      }
      await import('./src/mcp-stdio-server.js')
      return
    }

    let port = serverConfig.serverPort

    // Look for --port argument
    const portIndex = args.indexOf('--port')
    if (portIndex !== -1 && args[portIndex + 1]) {
      const parsedPort = parseInt(args[portIndex + 1], 10)
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort < 65536) {
        port = parsedPort
      }
    }

    // Start normal HTTP server
    logger.info('Starting server...')
    try {
      const server = await instantiateServer({ port })
      logger.info('Server instantiated successfully')

      function handleShutdown() {
        logger.info('Received kill signal. Shutting down gracefully...')
        watchersManager.stopAllWatchers?.()
        getJobQueue().stopProcessing()
        server.stop()
        process.exit(0)
      }
      process.on('SIGINT', handleShutdown)
      process.on('SIGTERM', handleShutdown)
    } catch (error) {
      logger.error('Failed to start server', error)
      process.exit(1)
    }
  })()
}
