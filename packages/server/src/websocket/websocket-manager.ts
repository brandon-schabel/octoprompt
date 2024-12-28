import { ServerWebSocket } from "bun";
import { GlobalState, globalStateSchema, createInitialGlobalState } from "shared";
import { globalStateTable, eq } from "shared";
import { db } from "shared/database";
import { ZodError } from "zod";
import { logger } from "../utils/logger";

export type WebSocketData = {
    clientId: string;
};

export type StateUpdateMessage = {
    type: "state_update";
    data: GlobalState;
};

// ─────────────────────────────────────────────────────────────────────────────
// Project tab messages
// ─────────────────────────────────────────────────────────────────────────────
type CreateProjectTabMessage = {
    type: "create_project_tab";
    tabId: string;
    data: GlobalState["projectTabs"][string];
};

type UpdateProjectTabMessage = {
    type: "update_project_tab";
    tabId: string;
    data: GlobalState["projectTabs"][string]
};

type UpdateProjectTabPartialMessage = {
    type: "update_project_tab_partial";  // you may or may not need this variant
    tabId: string;
    partial: Partial<GlobalState["projectTabs"][string]>;
};

type DeleteProjectTabMessage = {
    type: "delete_project_tab";
    tabId: string;
};

type SetActiveProjectTabMessage = {
    type: "set_active_project_tab";
    tabId: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Chat tab messages
// ─────────────────────────────────────────────────────────────────────────────
type CreateChatTabMessage = {
    type: "create_chat_tab";
    tabId: string;
    data: GlobalState["chatTabs"][string];
};

type UpdateChatTabMessage = {
    type: "update_chat_tab";
    tabId: string;
    data: Partial<GlobalState["chatTabs"][string]>;
};

type UpdateChatTabPartialMessage = {
    type: "update_chat_tab_partial"; // you may or may not need this variant
    tabId: string;
    partial: Partial<GlobalState["chatTabs"][string]>;
};

type DeleteChatTabMessage = {
    type: "delete_chat_tab";
    tabId: string;
};

type SetActiveChatTabMessage = {
    type: "set_active_chat_tab";
    tabId: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Union of all possible inbound messages
// ─────────────────────────────────────────────────────────────────────────────
export type WebSocketMessage =
    | StateUpdateMessage // typically only outbound
    // Project:
    | CreateProjectTabMessage
    | UpdateProjectTabMessage
    | UpdateProjectTabPartialMessage
    | DeleteProjectTabMessage
    | SetActiveProjectTabMessage
    // Chat:
    | CreateChatTabMessage
    | UpdateChatTabMessage
    | UpdateChatTabPartialMessage
    | DeleteChatTabMessage
    | SetActiveChatTabMessage;

export class WebSocketManager {
    private connections: Set<ServerWebSocket<WebSocketData>>;
    private debugMode: boolean;

    constructor(debug = false) {
        this.connections = new Set();
        this.debugMode = debug;
        logger.info("WebSocketManager initialized", { debugMode: debug });
    }

    async getStateFromDB(): Promise<GlobalState> {
        try {
            const row = await db.select()
                .from(globalStateTable)
                .where(eq(globalStateTable.id, "main"))
                .get();

            if (!row) {
                // Insert initial if missing
                const initialState = createInitialGlobalState();
                await db.insert(globalStateTable).values({
                    id: "main",
                    state_json: JSON.stringify(initialState),
                }).run();
                return initialState;
            }

            const parsed = JSON.parse(row.state_json);
            const validatedState = globalStateSchema.parse(parsed);
            return validatedState;
        } catch (error) {
            if (error instanceof ZodError) {
                // If DB state is invalid, reset to initial
                const initialState = createInitialGlobalState();
                await this.updateStateInDB(initialState);
                return initialState;
            }
            throw error;
        }
    }

    async updateStateInDB(newState: GlobalState): Promise<void> {
        const exists = await db.select()
            .from(globalStateTable)
            .where(eq(globalStateTable.id, "main"))
            .get();

        if (!exists) {
            await db.insert(globalStateTable).values({
                id: "main",
                state_json: JSON.stringify(newState),
            }).run();
        } else {
            await db.update(globalStateTable)
                .set({ state_json: JSON.stringify(newState) })
                .where(eq(globalStateTable.id, "main"))
                .run();
        }
    }

    broadcastState(state: GlobalState): void {
        const message: StateUpdateMessage = {
            type: "state_update",
            data: state,
        };
        const messageStr = JSON.stringify(message);
        let successCount = 0;
        let failCount = 0;

        for (const ws of this.connections) {
            try {
                ws.send(messageStr);
                successCount++;
            } catch (error) {
                failCount++;
                logger.error("Failed to broadcast state", {
                    clientId: ws.data.clientId,
                    error
                });
            }
        }

        logger.debug("State broadcast complete", {
            successCount,
            failCount,
            totalConnections: this.connections.size
        });
    }

    handleOpen(ws: ServerWebSocket<WebSocketData>): void {
        this.connections.add(ws);
        logger.debug("New WebSocket connection", {
            clientId: ws.data.clientId,
            totalConnections: this.connections.size
        });

        // Send current state as soon as they connect
        this.getStateFromDB()
            .then((state) => {
                const message: StateUpdateMessage = {
                    type: "state_update",
                    data: state,
                };
                ws.send(JSON.stringify(message));
                logger.debug("Initial state sent", { clientId: ws.data.clientId });
            })
            .catch((err) => {
                logger.error("Failed to send initial state", { clientId: ws.data.clientId, error: err });
                ws.close();
            });
    }

    handleClose(ws: ServerWebSocket<WebSocketData>): void {
        this.connections.delete(ws);
    }

    async handleMessage(ws: ServerWebSocket<WebSocketData>, rawMessage: string): Promise<void> {
        try {
            const parsed = JSON.parse(rawMessage) as WebSocketMessage;
            logger.debug("Received WebSocket message", {
                messageType: parsed.type,
                clientId: ws.data.clientId,
                payload: this.debugMode ? parsed : undefined
            });

            switch (parsed.type) {
                // ───────────────────────────────────────────────────────────
                // PROJECT TABS
                // ───────────────────────────────────────────────────────────
                case "create_project_tab": {
                    const { tabId, data } = parsed;
                    const state = await this.getStateFromDB();

                    // Insert new project tab
                    state.projectTabs[tabId] = data;
                    // Optionally, set it active:
                    state.projectActiveTabId = tabId;

                    const validated = globalStateSchema.parse(state);
                    await this.updateStateInDB(validated);
                    this.broadcastState(validated);
                    break;
                }

                case "update_project_tab": {
                    const { tabId, data } = parsed;
                    const state = await this.getStateFromDB();

                    if (!state.projectTabs[tabId]) {
                        console.warn("Project tab not found:", tabId);
                        return;
                    }
                    state.projectTabs[tabId] = {
                        ...state.projectTabs[tabId],
                        ...data,
                    };

                    const validated = globalStateSchema.parse(state);
                    await this.updateStateInDB(validated);
                    this.broadcastState(validated);
                    break;
                }

                case "update_project_tab_partial": {
                    // In practice, this may be redundant with "update_project_tab"
                    const { tabId, partial: data } = parsed;
                    const state = await this.getStateFromDB();


                    if (!state.projectTabs[tabId]) {
                        console.warn("Project tab not found:", tabId);
                        return;
                    }
                    state.projectTabs[tabId] = {
                        ...state.projectTabs[tabId],
                        ...data,
                    };

                    const validated = globalStateSchema.parse(state);
                    await this.updateStateInDB(validated);
                    this.broadcastState(validated);
                    break;
                }

                case "delete_project_tab": {
                    const { tabId } = parsed;
                    const state = await this.getStateFromDB();

                    // Don't delete if it's the last tab
                    if (Object.keys(state.projectTabs).length <= 1) {
                        console.warn("Cannot delete the last remaining project tab");
                        return;
                    }

                    delete state.projectTabs[tabId];
                    if (state.projectActiveTabId === tabId) {
                        // Switch to any remaining tab
                        const remaining = Object.keys(state.projectTabs);
                        if (remaining.length > 0) {
                            state.projectActiveTabId = remaining[0];
                        } else {
                            state.projectActiveTabId = null;
                        }
                    }

                    const validated = globalStateSchema.parse(state);
                    await this.updateStateInDB(validated);
                    this.broadcastState(validated);
                    break;
                }

                case "set_active_project_tab": {
                    const { tabId } = parsed;
                    const state = await this.getStateFromDB();
                    if (!state.projectTabs[tabId]) {
                        console.warn("Cannot set active project tab; not found:", tabId);
                        return;
                    }

                    state.projectActiveTabId = tabId;
                    const validated = globalStateSchema.parse(state);
                    await this.updateStateInDB(validated);
                    this.broadcastState(validated);
                    break;
                }

                // ───────────────────────────────────────────────────────────
                // CHAT TABS
                // ───────────────────────────────────────────────────────────
                case "create_chat_tab": {
                    const { tabId, data } = parsed;
                    const state = await this.getStateFromDB();

                    // Insert new chat tab
                    state.chatTabs[tabId] = data;
                    // Optionally, set it active
                    state.chatActiveTabId = tabId;

                    const validated = globalStateSchema.parse(state);
                    await this.updateStateInDB(validated);
                    this.broadcastState(validated);
                    break;
                }

                case "update_chat_tab": {
                    const { tabId, data } = parsed;
                    const state = await this.getStateFromDB();

                    if (!state.chatTabs[tabId]) {
                        console.warn("Chat tab not found:", tabId);
                        return;
                    }
                    state.chatTabs[tabId] = {
                        ...state.chatTabs[tabId],
                        ...data,
                    };

                    const validated = globalStateSchema.parse(state);
                    await this.updateStateInDB(validated);
                    this.broadcastState(validated);
                    break;
                }

                case "update_chat_tab_partial": {
                    // Could be redundant with "update_chat_tab" 
                    const { tabId, partial: data } = parsed;
                    const state = await this.getStateFromDB();

                    if (!state.chatTabs[tabId]) {
                        console.warn("Chat tab not found:", tabId);
                        return;
                    }

                    state.chatTabs[tabId] = {
                        ...state.chatTabs[tabId],
                        ...data,
                    };

                    const validated = globalStateSchema.parse(state);
                    await this.updateStateInDB(validated);
                    this.broadcastState(validated);
                    break;
                }

                case "delete_chat_tab": {
                    const { tabId } = parsed;
                    const state = await this.getStateFromDB();

                    // Don't delete if it's the last chat tab
                    if (Object.keys(state.chatTabs).length <= 1) {
                        console.warn("Cannot delete the last remaining chat tab");
                        return;
                    }

                    delete state.chatTabs[tabId];
                    if (state.chatActiveTabId === tabId) {
                        // Switch to any remaining tab
                        const remaining = Object.keys(state.chatTabs);
                        if (remaining.length > 0) {
                            state.chatActiveTabId = remaining[0];
                        } else {
                            state.chatActiveTabId = null;
                        }
                    }

                    const validated = globalStateSchema.parse(state);
                    await this.updateStateInDB(validated);
                    this.broadcastState(validated);
                    break;
                }

                case "set_active_chat_tab": {
                    const { tabId } = parsed;
                    const state = await this.getStateFromDB();
                    if (!state.chatTabs[tabId]) {
                        console.warn("Cannot set active chat tab; not found:", tabId);
                        return;
                    }

                    state.chatActiveTabId = tabId;
                    const validated = globalStateSchema.parse(state);
                    await this.updateStateInDB(validated);
                    this.broadcastState(validated);
                    break;
                }

                default: {
                    console.warn("Unrecognized message type:", parsed);
                    break;
                }
            }
        } catch (error) {
            logger.error("Error handling WebSocket message", {
                clientId: ws.data.clientId,
                error,
                rawMessage: this.debugMode ? rawMessage : undefined
            });
        }
    }
}

export const wsManager = new WebSocketManager();