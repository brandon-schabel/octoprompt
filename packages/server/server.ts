import { serve } from "bun";
import { join } from "node:path";
import { statSync } from "node:fs";
import app from "@/server-router";
import "@/routes/chat-routes";
import "@/routes/project-routes";
import "@/routes/prompt-routes";
import "@/routes/provider-key-routes";
import "@/routes/promptimizer-routes";
import "@/routes/ticket-routes";
import "@/routes/suggest-files-routes";
import "@/routes/kv-routes";
import "@/routes/structured-output-routes";
import "@/routes/ai-file-change-routes";
import "@/routes/summarize-files-routes";
import "@/routes/admin-routes";

import { globalStateSchema } from "shared";

import { websocketStateAdapter } from "./src/utils/websocket/websocket-state-adapter";
import { listProjects } from "@/services/project-service";
import { watchersManager } from "@/services/shared-services";
import { createCleanupService } from "@/services/file-services/cleanup-service";
import { initKvStore } from "@/services/kv-service";

// Use the imported watchersManager, remove the local creation
// export const watchersManager = createWatchersManager();
const cleanupService = createCleanupService({
  intervalMs: 5 * 60 * 1000,
});

const isDevEnv = process.env.DEV === "true";
const CLIENT_PATH = isDevEnv
  ? join(import.meta.dir, "client-dist")
  : "./client-dist";

type ServerConfig = {
  port?: number;
};

type Server = ReturnType<typeof serve>;

const DEV_PORT = 3000;
const PROD_PORT = 3579;
const PORT = isDevEnv ? DEV_PORT : PROD_PORT;

// Register simple health check route
app.get("/api/health", (c) => c.json({ success: true }));

// Register API state endpoint
app.get("/api/state", async (c) => {
  try {
    const currentState = websocketStateAdapter.getState();
    return c.json(currentState);
  } catch (error) {
    console.error("Error fetching state:", error);
    return c.json({ error: "Failed to fetch state" }, 500);
  }
});

app.post("/api/state", async (c) => {
  try {
    const body = await c.req.json();
    const { key, value } = body as { key: string; value: unknown };
    const currentState = websocketStateAdapter.getState();

    // Shallow update
    const newState = { ...currentState, [key]: value };
    const validated = globalStateSchema.parse(newState);

    // Set & broadcast
    await websocketStateAdapter.setState(validated, true);

    return c.json(validated);
  } catch (error) {
    console.error("Error updating state:", error);
    return c.json({ error: String(error) }, 400);
  }
});

export async function instantiateServer({ port = PORT }: ServerConfig = {}): Promise<Server> {
  const server: Server = serve<{ clientId: string }>({
    idleTimeout: 255,
    port,
    async fetch(req: Request): Promise<Response | undefined> {
      const url = new URL(req.url);

      if (url.pathname === "/") {
        return new Response(Bun.file(join(CLIENT_PATH, "index.html")));
      }

      if (url.pathname === "/ws") {
        const clientId = crypto.randomUUID();
        const upgraded: boolean = server.upgrade(req, { data: { clientId } });
        return upgraded ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
      }

      if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) {
        // Handle the request using Hono
        const honoResponse = await app.fetch(req);
        if (honoResponse && honoResponse.status !== 404) {
          return honoResponse;
        }
      }

      const isStaticFile =
        /\.(js|css|html|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(url.pathname);
      if (isStaticFile) {
        return serveStatic(url.pathname);
      }

      // Handle all other routes with Hono
      const honoResponse = await app.fetch(req);
      if (honoResponse && honoResponse.status !== 404) {
        return honoResponse;
      }

      const frontendEnpoints = ["/projects", "/chat"];
      if (honoResponse?.status === 404 && frontendEnpoints.includes(url.pathname)) {
        return serveStatic("index.html");
      }

      return serveStatic("index.html");
    },

    websocket: {
      async open(ws) {
        console.debug("New WS connection", { clientId: ws.data.clientId });
        websocketStateAdapter.handleOpen(ws);
        // broadcast current state to newly connected client
        await websocketStateAdapter.broadcastState();
      },
      close(ws) {
        console.debug("WS closed", { clientId: ws.data.clientId });
        websocketStateAdapter.handleClose(ws);
      },
      async message(ws, rawMessage) {
        try {
          await websocketStateAdapter.handleMessage(ws, rawMessage.toString());
          await websocketStateAdapter.broadcastState();
        } catch (err) {
          console.error("Error handling WS message:", err);
        }
      },
    },
  });

  // Start watchers for existing projects
  (async () => {
    const allProjects = await listProjects();
    for (const project of allProjects) {
      watchersManager.startWatchingProject(project, [
        "node_modules",
        "dist",
        ".git",
        "*.tmp",
        "*.db-journal",
      ]);
    }
    
    cleanupService.start();
  })();

  console.log(`Server running at http://localhost:${server.port}`);
  return server;
}

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

if (import.meta.main) {
  console.log("Starting server...");
  (async () => {
    await initKvStore();
    const server = await instantiateServer();
    function handleShutdown() {
      console.log("Received kill signal. Shutting down gracefully...");
      watchersManager.stopAll?.();
      server.stop();
      process.exit(0);
    }
    process.on("SIGINT", handleShutdown);
    process.on("SIGTERM", handleShutdown);
  })();
}