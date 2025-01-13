// websocket-manager.ts
import { BackendWebSocketManager } from "@bnk/backend-websocket-manager";
import type { GlobalState } from "shared";
import type { InboundMessage } from "shared";
import { allWebsocketHandlers } from "./websocket-handlers";
import { getState, setState } from "./websocket-config";

/**
 * BNK's BackendWebSocketManager needs:
 *  1) getState: returns the current GlobalState (in-memory)
 *  2) setState: updates the in-memory state (and optionally syncs DB)
 *  3) messageHandlers: an array of typed message handlers
 *  4) debug?: enable/disable logging
 */
export const bnkWsManager = new BackendWebSocketManager<GlobalState, InboundMessage>({
    getState,
    setState,
    messageHandlers: allWebsocketHandlers,
    debug: true, // or false if you prefer less logging
});

/**
 * BNK: Broadcasting updated state to all clients
 * can be done via bnkWsManager.broadcastState().
 * This internally calls getState(), then sends it to all connections as:
 *  { type: "state_update", data: ... }
 *
 * If you want to customize the broadcast message shape, you can do so by
 * manually implementing your own broadcast function.
 * For now, we'll just use `broadcastState()` which automatically sends:
 *   { type: "state_update", data: GlobalState }
 */

// Example custom broadcast (if you want more control):
// import { ServerWebSocket } from "bun";
// export async function broadcastState(): Promise<void> {
//   const newState = await getState();
//   const message = {
//     type: "state_update",
//     data: newState,
//   };
//   await bnkWsManager.broadcast(message);
// }