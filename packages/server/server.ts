import { serve } from "bun";
import { join } from "node:path";
import { statSync } from "node:fs";
import { app } from "./src/app";

import { websocketStateAdapter } from "./src/utils/websocket/websocket-state-adapter";
import { listProjects } from "@/services/project-service";
import { watchersManager } from "@/services/shared-services";
import { createCleanupService } from "@/services/file-services/cleanup-service";
import { initKvStore } from "@/services/kv-service";
import { isDevEnv, SERVER_PORT } from "@/constants/server-config";


// Use the imported watchersManager, remove the local creation
// export const watchersManager = createWatchersManager();
const cleanupService = createCleanupService({
  intervalMs: 5 * 60 * 1000,
});

const CLIENT_PATH = isDevEnv
  ? join(import.meta.dir, "client-dist")
  : "./client-dist";

type ServerConfig = {
  port?: number;
};

type Server = ReturnType<typeof serve>;

export async function instantiateServer({ port = SERVER_PORT }: ServerConfig = {}): Promise<Server> {
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
  console.log(`Server swagger at http://localhost:${server.port}/swagger`);
  console.log(`Server docs at http://localhost:${server.port}/doc`);
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
