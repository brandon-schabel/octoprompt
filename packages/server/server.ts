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
import "@/routes/code-editor-routes";
import "@/routes/promptimizer-routes";
import "@/routes/ticket-routes";
import "@/routes/suggest-files-routes";
import "@/routes/kv-routes";
import "@/routes/structured-output-routes";
import "@/routes/ai-file-change-routes";

import { json } from "@bnk/router";
import { WatchersManager } from "@/services/file-services/watchers-manager";
import { FileSyncService } from "@/services/file-services/file-sync-service";
import { FileSummaryService } from "@/services/file-services/file-summary-service";
import { ProjectService } from "@/services/project-service";
import { CleanupService } from "@/services/file-services/cleanup-service";
import { initKvStore } from "@/services/kv-service";

import {
  globalStateSchema,
} from "shared";

import { websocketStateAdapter, initialGlobalState } from "./src/utils/websocket/websocket-state-adapter";



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

const fileSyncService = new FileSyncService();
const fileSummaryService = new FileSummaryService();
const projectService = new ProjectService();
const watchersManager = new WatchersManager(
  fileSummaryService,
  fileSyncService,
  projectService
);

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

      router.get("/api/health", {}, async () => json({ success: true }));

      if (url.pathname === "/api/state") {
        if (req.method === "GET") {
          try {
            const currentState = websocketStateAdapter.getState();
            return Response.json(currentState);
          } catch (error) {
            console.error("Error fetching state:", error);
            return new Response(JSON.stringify({ error: "Failed to fetch state" }), { status: 500 });
          }
        }
        if (req.method === "POST") {
          try {
            const body = await req.json();
            const { key, value } = body as { key: string; value: unknown };
            const currentState = websocketStateAdapter.getState();

            // Shallow update
            const newState = { ...currentState, [key]: value };
            const validated = globalStateSchema.parse(newState);

            // Set & broadcast
            await websocketStateAdapter.setState(validated, true);

            return Response.json(validated);
          } catch (error) {
            console.error("Error updating state:", error);
            return new Response(JSON.stringify({ error: String(error) }), { status: 400 });
          }
        }
      }

      if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) {
        const routerResponse = await router.handle(req);
        if (routerResponse) return routerResponse;
      }

      const isStaticFile =
        /\.(js|css|html|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(url.pathname);
      if (isStaticFile) {
        return serveStatic(url.pathname);
      }

      const routerResponse = await router.handle(req);
      if (routerResponse && routerResponse?.status !== 404) {
        return routerResponse;
      }

      const frontendEnpoints = ["/projects", "/chat"];
      if (routerResponse?.status === 404 && frontendEnpoints.includes(url.pathname)) {
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
    const allProjects = await projectService.listProjects();
    for (const project of allProjects) {
      watchersManager.startWatchingProject(project, [
        "node_modules",
        "dist",
        ".git",
        "*.tmp",
        "*.db-journal",
      ]);

      const cleanupService = new CleanupService(fileSyncService, projectService, {
        intervalMs: 5 * 60 * 1000,
      });
      cleanupService.start();
    }
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