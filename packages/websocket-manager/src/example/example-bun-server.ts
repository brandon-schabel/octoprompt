// server.ts
import { serve } from "bun";
import { join } from "path";
import { WebSocketManager } from "../generic-websocket-manager";
import { counterHandlers, type MyAppState, type CounterMessage } from "./counter-handlers";
import { initializeDatabase, loadInitialStateFromDb, saveStateToDb } from "./database";

/**
 * Initialize the database and tables before anything else.
 */
initializeDatabase();

/**
 * Load the initial state from the database.
 */
let currentState: MyAppState = await loadInitialStateFromDb();

/**
 * 1) Implement getState / setState for the manager config.
 */
async function getStateFromMemory(): Promise<MyAppState> {
    return structuredClone(currentState);
}

async function setStateInMemory(newState: MyAppState): Promise<void> {
    currentState = structuredClone(newState);
}

/**
 * 2) Combine all message handlers needed for your domain.
 */
type MyMessages = CounterMessage;
const allHandlers = [...counterHandlers];

/**
 * 3) Create the WebSocket Manager.
 */
const wsManager = new WebSocketManager<MyAppState, MyMessages>({
    getState: getStateFromMemory,
    setState: setStateInMemory,
    messageHandlers: allHandlers,
    debug: true,
});

/**
 * Optionally, set up an interval to persist state to the DB
 * so we're not always writing on every change.
 */
const SAVE_INTERVAL_MS = 10_000; // 10 seconds (adjust as you like)

const saveInterval = setInterval(async () => {
    try {
        const stateToSave = await getStateFromMemory();
        await saveStateToDb(stateToSave);
        console.log("[Server] State saved to DB on interval.");
    } catch (error) {
        console.error("[Server] Failed to save state to DB:", error);
    }
}, SAVE_INTERVAL_MS);

/**
 * 4) Start your Bun server.
 */
serve({
    port: 3005,
    async fetch(req, server) {
        const url = new URL(req.url);

        if (url.pathname === "/ws") {
            const upgraded = server.upgrade(req, {
                data: { someContext: "hello" },
            });
            return upgraded
                ? undefined
                : new Response("Failed to upgrade", { status: 400 });
        }

        // Serve index.html for any non-websocket route
        return new Response(Bun.file(join(import.meta.dir, "index.html")));
    },
    websocket: {
        open(ws) {
            console.log("[Server] WebSocket opened!");
            wsManager.handleOpen(ws);
        },
        close(ws) {
            console.log("[Server] WebSocket closed!");
            wsManager.handleClose(ws);
        },
        async message(ws, msg) {

            try {
                await wsManager.handleMessage(ws, msg.toString())
                    .then(() => {
                        // Optionally broadcast the new state to all connected clients:
                    })

            } catch (error) {
                console.error("[Server] Error handling message:", error);
            }


            await wsManager.broadcastState();
        },
    },
});

console.log(`Server running at http://localhost:3005`);

// Optional cleanup if your process stops (e.g. SIGTERM)
// clearInterval(saveInterval);