import { serve } from "bun";
import { join } from "node:path";
import { statSync } from "node:fs";
import { router } from "server-router";
import "@/routes/chat-routes";
import "@/routes/project-routes"
import "@/routes/prompt-routes"
import "@/routes/flags-routes"
import "@/routes/provider-key-routes"
import "@/routes/gemini-routes"
import "@/routes/open-ai-routes"
import "@/routes/code-editor-routes"
import "@/routes/promptimizer-routes"

import { globalStateSchema } from "shared";
import { wsManager, WebSocketData } from "@/websocket/websocket-manager";
import { json } from "@bnk/router";

// built client files
const CLIENT_PATH = join(__dirname, "client-dist");

type ServerConfig = {
  port?: number;
};

type Server = ReturnType<typeof serve>;


const DEV_PORT = 3000;
const PROD_PORT = 3579;

const isDevEnv = process.env.DEV === 'true';
const PORT = isDevEnv ? DEV_PORT : PROD_PORT;

export const instantiateServer = ({
  port = PORT
}: ServerConfig = {}): Server => {
  const server: Server = serve<WebSocketData>({
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
            const state = await wsManager.getStateFromDB();
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
            const currentState = await wsManager.getStateFromDB();
            const { key, value } = body as { key: string; value: unknown };

            const newState = { ...currentState, [key]: value };
            const validated = globalStateSchema.parse(newState);

            await wsManager.updateStateInDB(validated);
            wsManager.broadcastState(validated);

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
        return routerResponse
      }


      const frontendEnpoints = ['/projects', '/chat']

      if (routerResponse && routerResponse?.status === 404 && frontendEnpoints.includes(url.pathname)) {
        return serveStatic('index.html');
      }

      return serveStatic('index.html');
    },

    websocket: {
      open: (ws) => wsManager.handleOpen(ws),
      close: (ws) => wsManager.handleClose(ws),
      message: (ws, message) => wsManager.handleMessage(ws, message.toString()),
    }
  });

  console.log(`Server running at http://localhost:${server.port}`);
  return server;
}

// Modify the serveStatic function to handle 404s properly
function serveStatic(path: string): Response {
  try {
    const filePath = join(CLIENT_PATH, path);
    const stat = statSync(filePath);

    if (stat.isFile()) {
      return new Response(Bun.file(filePath));
    }
    // Try serving index.html for directory requests
    return new Response(Bun.file(join(CLIENT_PATH, "index.html")));
  } catch {
    // If file not found, serve index.html for client-side routing
    return new Response(Bun.file(join(CLIENT_PATH, "index.html")));
  }
}

// Only start the server if this file is being run directly
if (import.meta.main) {
  console.log('Starting server...');
  instantiateServer();
}