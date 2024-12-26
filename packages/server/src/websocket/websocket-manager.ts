import { ServerWebSocket } from "bun";
import { GlobalState, globalStateSchema, createInitialGlobalState, type TabState } from "shared";
import { globalStateTable, eq } from "shared";
import { db } from "shared/database"
import { ZodError } from "zod";

export type WebSocketData = {
    clientId: string;
};

export type StateUpdateMessage = {
    type: 'state_update';
    data: GlobalState;
};

type CreateTabMessage = {
    type: 'create_tab';
    tabId: string;
    data: TabState;
};

type UpdateTabStateMessage = {
    type: 'update_tab_state';
    tabId: string;
    key: keyof TabState;
    value: TabState[keyof TabState];
};

type SetActiveTabMessage = {
    type: 'set_active_tab';
    tabId: string;
};

type UpdateTabPartialMessage = {
    type: 'update_tab_partial';
    tabId: string;
    data: Partial<TabState>;
};

type DeleteTabMessage = {
    type: 'delete_tab';
    tabId: string;
};

export type WebSocketMessage =
    | StateUpdateMessage
    | CreateTabMessage
    | UpdateTabStateMessage
    | SetActiveTabMessage
    | UpdateTabPartialMessage
    | DeleteTabMessage;

export class WebSocketManager {
    private connections: Set<ServerWebSocket<WebSocketData>>;

    constructor() {
        this.connections = new Set();
    }

    async getStateFromDB(): Promise<GlobalState> {
        try {
            const row = await db.select().from(globalStateTable)
                .where(eq(globalStateTable.id, "main"))
                .get();

            if (!row) {
                const initialState = createInitialGlobalState();
                await db.insert(globalStateTable).values({
                    id: "main",
                    state_json: JSON.stringify(initialState)
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
                state_json: JSON.stringify(newState)
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
            type: 'state_update',
            data: state
        };

        for (const ws of this.connections) {
            try {
                ws.send(JSON.stringify(message));
            } catch {
            }
        }
    }


    handleOpen(ws: ServerWebSocket<WebSocketData>): void {
        this.connections.add(ws);

        // Send current state as soon as they connect
        this.getStateFromDB()
            .then(state => {
                const message: StateUpdateMessage = {
                    type: 'state_update',
                    data: state
                };
                ws.send(JSON.stringify(message));
            })
            .catch(err => {
                ws.close();
            });
    }


    handleClose(ws: ServerWebSocket<WebSocketData>): void {
        this.connections.delete(ws);
    }

    async handleMessage(ws: ServerWebSocket<WebSocketData>, message: string): Promise<void> {
        try {

            const parsed = JSON.parse(message) as WebSocketMessage;


            switch (parsed.type) {
                case 'create_tab': {
                    const { tabId, data: tabData } = parsed;
                    const currentState = await this.getStateFromDB();


                    currentState.tabs[tabId] = tabData;
                    currentState.activeTabId = tabId;

                    const validated = globalStateSchema.parse(currentState);
                    await this.updateStateInDB(validated);

                    this.broadcastState(validated);
                    break;
                }

                case 'update_tab_state': {
                    const { tabId, key, value } = parsed;
                    const currentState = await this.getStateFromDB();


                    if (!currentState.tabs[tabId]) {
                        console.warn('[WebSocketManager] Tab not found:', tabId);
                        break;
                    }

                    const tab = currentState.tabs[tabId];
                    // Type-safe update
                    if (key in tab) {
                        (tab as any)[key] = value;
                    } else {
                        console.warn('[WebSocketManager] Invalid key for tab state:', key);
                        break;
                    }

                    try {
                        const validated = globalStateSchema.parse(currentState);
                        await this.updateStateInDB(validated);

                        this.broadcastState(validated);
                    } catch (error) {
                        console.error('[WebSocketManager] Validation error:', error);
                    }
                    break;
                }

                case 'set_active_tab': {

                    const { tabId } = parsed;
                    const currentState = await this.getStateFromDB();

                    if (!currentState.tabs[tabId]) {
                        console.warn('[WebSocketManager] Tab not found for activation:', tabId);
                        break;
                    }

                    currentState.activeTabId = tabId;

                    const validated = globalStateSchema.parse(currentState);
                    await this.updateStateInDB(validated);

                    this.broadcastState(validated);
                    break;
                }

                case 'update_tab_partial': {


                    const { tabId, data } = parsed;
                    const currentState = await this.getStateFromDB();


                    if (!currentState.tabs[tabId]) {
                        console.warn('[WebSocketManager] Tab not found:', tabId);
                        break;
                    }

                    // Merge the partial update with existing tab state
                    currentState.tabs[tabId] = {
                        ...currentState.tabs[tabId],
                        ...data
                    };

                    try {
                        const validated = globalStateSchema.parse(currentState);
                        await this.updateStateInDB(validated);

                        this.broadcastState(validated);
                    } catch (error) {
                        console.error('[WebSocketManager] Validation error:', error);
                    }
                    break;
                }

                case 'delete_tab': {

                    const { tabId } = parsed;
                    const currentState = await this.getStateFromDB();

                    // Don't delete if it's the last tab
                    if (Object.keys(currentState.tabs).length <= 1) {
                        console.warn('[WebSocketManager] Cannot delete the last remaining tab');
                        break;
                    }

                    // Delete the tab
                    delete currentState.tabs[tabId];

                    // If we're deleting the active tab, switch to another one
                    if (currentState.activeTabId === tabId) {
                        const remainingTabs = Object.keys(currentState.tabs);
                        if (remainingTabs.length > 0) {
                            currentState.activeTabId = remainingTabs[0];
                        }
                    }

                    try {
                        const validated = globalStateSchema.parse(currentState);
                        await this.updateStateInDB(validated);

                        this.broadcastState(validated);
                    } catch (error) {
                        console.error('[WebSocketManager] Validation error:', error);
                    }
                    break;
                }

                default:
                    console.warn('[WebSocketManager] Unrecognized message type:', parsed.type);
                    break;
            }

        } catch (error) {
            console.error('[WebSocketManager] Error handling message:', error);
        }
    }
}

export const wsManager = new WebSocketManager();