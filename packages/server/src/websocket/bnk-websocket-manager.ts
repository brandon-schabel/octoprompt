// packages/server/src/websocket/bnk-websocket-manager.ts

import { serve, ServerWebSocket } from "bun";
import { BackendWebSocketManager } from "@bnk/backend-websocket-manager";
import { GlobalState } from "shared";
import { InboundMessage, validateIncomingMessage } from "shared";
import { getState, setState } from "./websocket-config";
import { allWebsocketHandlers } from "./handlers";

// Instantiate BNK manager
export const bnkWsManager = new BackendWebSocketManager<GlobalState, InboundMessage>({
    initialState: await getState(),

    messageHandlers: allWebsocketHandlers,
    validateMessage: validateIncomingMessage,
    // debug: false, // or true if you prefer more logs
    
});

serve({
    port: 3000,

    /**
     * Your `fetch` handler MUST always return a `Response` or `Promise<Response>`.
     * `server.upgrade(req)` returns a boolean, so we can't directly `return server.upgrade(...)`.
     */
    fetch(req, server) {
        const url = new URL(req.url);

        if (url.pathname === "/ws") {
            // Attempt to upgrade to WebSocket
            const upgraded = server.upgrade(req, {
                // Optionally pass any data you want to store on `ws.data`
                data: {
                    // e.g., userId, etc.
                },
            });

            if (upgraded) {
                // The upgrade request succeeded.
                // Return an HTTP 101 Switching Protocols response to satisfy TypeScript.
                // Bun will handle the socket from here.
                return new Response(null, { status: 101 });
            } else {
                // The upgrade request failed.
                return new Response("WebSocket upgrade failed", { status: 400 });
            }
        }

        // Otherwise, respond normally
        return new Response("Hello from Bun!");
    },

    /**
     * The `websocket` property contains the handlers for open, close, and message events.
     * This runs *after* a successful upgrade.
     */
    websocket: {
        open(ws: ServerWebSocket) {
            bnkWsManager.handleOpen(ws);
        },
        close(ws: ServerWebSocket) {
            bnkWsManager.handleClose(ws);
        },
        async message(ws: ServerWebSocket, rawMessage: string | BufferSource | Uint8Array) {
            // BNK manager handles validation + dispatch
            await bnkWsManager.handleMessage(ws, rawMessage.toString());
            // Optionally broadcast new state to all clients
            await bnkWsManager.broadcastState();
        },
    },
});

console.log("Server running at http://localhost:3000");