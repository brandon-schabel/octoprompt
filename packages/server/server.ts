import { serve } from "bun";
import { join } from "node:path";
import { statSync } from "node:fs";
import { router } from "server-router";
import "@/routes/chat-routes";
import "@/routes/project-routes";
import "@/routes/prompt-routes";
import "@/routes/flags-routes";
import "@/routes/provider-key-routes";
import "@/routes/gemini-routes";
import "@/routes/open-ai-routes";
import "@/routes/code-editor-routes";
import "@/routes/promptimizer-routes";
import "@/routes/ticket-routes";

import { globalStateSchema } from "shared";
import { json } from "@bnk/router";
import { WatchersManager } from "@/services/file-services/watchers-manager";
import { FileSyncService } from "@/services/file-services/file-sync-service";
import { FileSummaryService } from "@/services/file-services/file-summary-service";
import { ProjectService } from "@/services/project-service";
import { getState, setState } from "./src/websocket/websocket-config";
import { bnkWsManager } from "./src/websocket/websocket-manager";
import { logger } from "src/utils/logger";

const isDevEnv = process.env.DEV === 'true';
// built client files
const CLIENT_PATH = isDevEnv ? join(import.meta.dir, "client-dist") : "./client-dist";

type ServerConfig = {
  port?: number;
};

type Server = ReturnType<typeof serve>;

const DEV_PORT = 3000;
const PROD_PORT = 3579;
const PORT = isDevEnv ? DEV_PORT : PROD_PORT;

// Instantiate watchers manager
const watchersManager = new WatchersManager(
  new FileSummaryService(),
  new FileSyncService(),
  new ProjectService()
);

export const instantiateServer = ({
  port = PORT
}: ServerConfig = {}): Server => {
  const server: Server = serve<{ clientId: string }>({
    idleTimeout: 255, // 255 seconds, we're dealing with streaming and non streaming llm responses which can take a while.
    port,
    async fetch(req: Request): Promise<Response | undefined> {
      const url = new URL(req.url);

      // Handle base URL request
      if (url.pathname === '/') {
        return new Response(Bun.file(join(CLIENT_PATH, 'index.html')));
      }

      // Handle WebSocket upgrade requests
      if (url.pathname === "/ws") {
        const clientId = crypto.randomUUID();
        const upgraded: boolean = server.upgrade(req, {
          data: { clientId }
        });

        return upgraded
          ? undefined
          : new Response("WebSocket upgrade failed", { status: 400 });
      }

      router.get("/api/health", {}, async () => {
        return json({ success: true });
      });

      // Handle state-related HTTP endpoints
      if (url.pathname === '/api/state') {
        if (req.method === 'GET') {
          try {
            const state = await getState();
            return Response.json(state);
          } catch (error) {
            console.error('Error fetching state:', error);
            return new Response(
              JSON.stringify({ error: "Failed to fetch state" }),
              { status: 500 }
            );
          }
        }

        if (req.method === 'POST') {
          try {
            const body = await req.json();
            const currentState = await getState();
            const { key, value } = body as { key: string; value: unknown };

            const newState = { ...currentState, [key]: value };
            const validated = globalStateSchema.parse(newState);

            await setState(validated);
            bnkWsManager.broadcastState();

            return Response.json(validated);
          } catch (error) {
            console.error('Error updating state:', error);
            return new Response(
              JSON.stringify({ error: String(error) }),
              { status: 400 }
            );
          }
        }
      }

      // Regular HTTP routing
      if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) {
        const routerResponse = await router.handle(req);
        if (routerResponse) return routerResponse;
      }

      const isStaticFile = /\.(js|css|html|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(url.pathname);
      if (isStaticFile) {
        return serveStatic(url.pathname);
      }

      const routerResponse = await router.handle(req);
      if (routerResponse && routerResponse?.status !== 404) {
        return routerResponse;
      }

      const frontendEnpoints = ['/projects', '/chat'];
      if (routerResponse && routerResponse?.status === 404 && frontendEnpoints.includes(url.pathname)) {
        return serveStatic('index.html');
      }

      return serveStatic('index.html');
    },

    websocket: {
      open(ws) {
        logger.debug("New WS connection", { clientId: ws.data.clientId });
        bnkWsManager.handleOpen(ws);
      },
      close(ws) {
        logger.debug("WS closed", { clientId: ws.data.clientId });
        bnkWsManager.handleClose(ws);
      },
      async message(ws, rawMessage) {
        try {
          await bnkWsManager.handleMessage(ws, rawMessage.toString());
        } catch (err) {
          logger.error("Error handling WS message:", err);
        }
        await bnkWsManager.broadcastState();
      },
    },
  });

  // Once the server is up, start watchers for all existing projects
  (async () => {
    const projectService = new ProjectService();
    const allProjects = await projectService.listProjects();
    for (const project of allProjects) {
      watchersManager.startWatchingProject(project, [
        "node_modules",
        "dist",
        ".git",
        "*.tmp",
        "*.db-journal"
      ]);
    }
  })();

  console.log(`Server running at http://localhost:${server.port}`);
  return server;
};

// Modify the serveStatic function to handle 404s properly
function serveStatic(path: string): Response {
  try {
    const filePath = join(CLIENT_PATH, path);
    const stat = statSync(filePath);

    if (stat.isFile()) {
      return new Response(Bun.file(filePath));
    }
    return new Response(Bun.file(join(CLIENT_PATH, "index.html")));
  } catch {
    return new Response(Bun.file(join(CLIENT_PATH, "index.html")));
  }
}

// Only start the server if this file is being run directly
if (import.meta.main) {
  console.log('Starting server...');
  const server = instantiateServer();

  function handleShutdown() {
    console.log('Received kill signal. Shutting down gracefully...');
    watchersManager.stopAll?.();
    server.stop();
    process.exit(0);
  }

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}