import { serve } from 'bun'
import { join } from 'node:path'
import { statSync } from 'node:fs'
import { app } from './src/app'

import { listProjects } from '@octoprompt/services'
import { isDevEnv, SERVER_PORT } from '@octoprompt/services'
import { watchersManager, createCleanupService } from '@octoprompt/services'

// Use the imported watchersManager, remove the local creation
// export const watchersManager = createWatchersManager();
const cleanupService = createCleanupService({
  intervalMs: 5 * 60 * 1000
})

// in dev client dist is relative to the server file so it would be server/client-dist
// in build it is relative to the root so it would be dist/client-dist
const CLIENT_PATH = isDevEnv ? join(import.meta.dir, 'client-dist') : './client-dist'

type ServerConfig = {
  port?: number
}

type Server = ReturnType<typeof serve>

export async function instantiateServer({ port = SERVER_PORT }: ServerConfig = {}): Promise<Server> {
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
        return await app.fetch(req)
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
        console.debug('New WS connection', { clientId: ws.data.clientId })
      },
      close(ws) {
        console.debug('WS closed', { clientId: ws.data.clientId })
      },
      async message(ws, rawMessage) {
        try {
        } catch (err) {
          console.error('Error handling WS message:', err)
        }
      }
    }
  })

  // Start watchers for existing projects
  ;(async () => {
    const allProjects = await listProjects()
    for (const project of allProjects) {
      // TODO: this seems to slow down server startup sometimes, so this this should be done async/in a different process
      watchersManager.startWatchingProject(project, ['node_modules', 'dist', '.git', '*.tmp', '*.db-journal'])
    }

    cleanupService.start()
  })()

  console.log(`Server running at http://localhost:${server.port}`)
  console.log(`Server swagger at http://localhost:${server.port}/swagger`)
  console.log(`Server docs at http://localhost:${server.port}/doc`)
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
  console.log('Starting server...')
  ;(async () => {
    const server = await instantiateServer()
    function handleShutdown() {
      console.log('Received kill signal. Shutting down gracefully...')
      watchersManager.stopAllWatchers?.()
      server.stop()
      process.exit(0)
    }
    process.on('SIGINT', handleShutdown)
    process.on('SIGTERM', handleShutdown)
  })()
}
