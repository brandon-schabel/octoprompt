// websocket-handlers.ts
import { MessageHandler } from "@bnk/websocket-manager";
import { globalStateSchema } from "shared";
import type { InboundMessage, GlobalState } from "shared";
import { logger } from "../utils/logger";

/**
 * Handler for broadcasting entire state updates to all clients
 */
export const stateUpdateHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "state_update",
    async handle(ws, message, getStateFn, setStateFn) {
        const validated = globalStateSchema.parse(message.data);
        await setStateFn(validated);
    },
};

/**
 * Handler for sending initial state to newly connected clients
 */
export const initialStateHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "initial_state",
    async handle(ws, message, getStateFn, setStateFn) {
        const validated = globalStateSchema.parse(message.data);
        await setStateFn(validated);
    },
};

/**
 * Each message handler looks up the relevant part of GlobalState,
 * modifies it, then calls setState(updated).
 * Finally, you can broadcast the new state to all clients.
 */
export const createProjectTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "create_project_tab",
    async handle(ws, message, getStateFn, setStateFn) {
        const { tabId, data } = message;
        const state = await getStateFn();

        // Insert new project tab
        state.projectTabs[tabId] = data;
        // Optionally, set it active
        state.projectActiveTabId = tabId;

        const validated = globalStateSchema.parse(state);
        await setStateFn(validated);
    },
};

export const updateProjectTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "update_project_tab",
    async handle(ws, message, getStateFn, setStateFn) {
        const { tabId, data } = message;
        const state = await getStateFn();

        if (!state.projectTabs[tabId]) {
            logger.warn("Project tab not found:", tabId);
            return;
        }
        state.projectTabs[tabId] = {
            ...state.projectTabs[tabId],
            ...data,
        };

        const validated = globalStateSchema.parse(state);
        await setStateFn(validated);
    },
};

export const updateProjectTabPartialHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "update_project_tab_partial",
    async handle(ws, message, getStateFn, setStateFn) {
        const { tabId, partial } = message;
        const state = await getStateFn();

        if (!state.projectTabs[tabId]) {
            logger.warn("Project tab not found:", tabId);
            return;
        }
        state.projectTabs[tabId] = {
            ...state.projectTabs[tabId],
            ...partial,
        };

        const validated = globalStateSchema.parse(state);
        await setStateFn(validated);
    },
};

export const deleteProjectTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "delete_project_tab",
    async handle(ws, message, getStateFn, setStateFn) {
        const { tabId } = message;
        const state = await getStateFn();

        // e.g. Don’t delete if it’s the last tab
        if (Object.keys(state.projectTabs).length <= 1) {
            logger.warn("Cannot delete the last remaining project tab");
            return;
        }
        delete state.projectTabs[tabId];
        if (state.projectActiveTabId === tabId) {
            const remaining = Object.keys(state.projectTabs);
            if (remaining.length > 0) {
                state.projectActiveTabId = remaining[0];
            } else {
                state.projectActiveTabId = null;
            }
        }

        const validated = globalStateSchema.parse(state);
        await setStateFn(validated);
    },
};

export const setActiveProjectTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "set_active_project_tab",
    async handle(ws, message, getStateFn, setStateFn) {
        const { tabId } = message;
        const state = await getStateFn();

        if (!state.projectTabs[tabId]) {
            logger.warn("Cannot set active project tab; not found:", tabId);
            return;
        }
        state.projectActiveTabId = tabId;

        const validated = globalStateSchema.parse(state);
        await setStateFn(validated);
    },
};

// --------------------------------------------------
// CHAT TAB HANDLERS
// --------------------------------------------------
export const createChatTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "create_chat_tab",
    async handle(ws, message, getStateFn, setStateFn) {
        const { tabId, data } = message;
        const state = await getStateFn();

        state.chatTabs[tabId] = data;
        state.chatActiveTabId = tabId;

        const validated = globalStateSchema.parse(state);
        await setStateFn(validated);
    },
};

export const updateChatTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "update_chat_tab",
    async handle(ws, message, getStateFn, setStateFn) {
        const { tabId, data } = message;
        const state = await getStateFn();

        if (!state.chatTabs[tabId]) {
            logger.warn("Chat tab not found:", tabId);
            return;
        }
        state.chatTabs[tabId] = {
            ...state.chatTabs[tabId],
            ...data,
        };

        const validated = globalStateSchema.parse(state);
        await setStateFn(validated);
    },
};

export const updateChatTabPartialHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "update_chat_tab_partial",
    async handle(ws, message, getStateFn, setStateFn) {
        const { tabId, partial } = message;
        const state = await getStateFn();

        if (!state.chatTabs[tabId]) {
            logger.warn("Chat tab not found:", tabId);
            return;
        }
        state.chatTabs[tabId] = {
            ...state.chatTabs[tabId],
            ...partial,
        };

        const validated = globalStateSchema.parse(state);
        await setStateFn(validated);
    },
};

export const deleteChatTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "delete_chat_tab",
    async handle(ws, message, getStateFn, setStateFn) {
        const { tabId } = message;
        const state = await getStateFn();

        // e.g. Don’t delete if it’s the last chat tab
        if (Object.keys(state.chatTabs).length <= 1) {
            logger.warn("Cannot delete the last remaining chat tab");
            return;
        }
        delete state.chatTabs[tabId];

        if (state.chatActiveTabId === tabId) {
            const remaining = Object.keys(state.chatTabs);
            if (remaining.length > 0) {
                state.chatActiveTabId = remaining[0];
            } else {
                state.chatActiveTabId = null;
            }
        }

        const validated = globalStateSchema.parse(state);
        await setStateFn(validated);
    },
};

export const setActiveChatTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "set_active_chat_tab",
    async handle(ws, message, getStateFn, setStateFn) {
        const { tabId } = message;
        const state = await getStateFn();

        if (!state.chatTabs[tabId]) {
            logger.warn("Cannot set active chat tab; not found:", tabId);
            return;
        }
        state.chatActiveTabId = tabId;

        const validated = globalStateSchema.parse(state);
        await setStateFn(validated);
    },
};

// --------------------------------------------------
// Update a top-level key in GlobalState
// --------------------------------------------------
export const updateGlobalStateKeyHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "update_global_state_key",
    async handle(ws, message, getStateFn, setStateFn) {
        const { key, partial } = message.data;
        const state = await getStateFn();

        const currentValue = state[key];
        // If it's an object, merge partial. Otherwise, just replace.
        if (typeof currentValue === "object" && currentValue !== null) {
            state[key] = { ...currentValue, ...partial } as any;
        } else {
            state[key] = partial as any;
        }

        const validated = globalStateSchema.parse(state);
        await setStateFn(validated);
    },
};

// --------------------------------------------------
// Combine all message handlers into a single array
// --------------------------------------------------
export const allWebsocketHandlers = [
    stateUpdateHandler,
    initialStateHandler,
    createProjectTabHandler,
    updateProjectTabHandler,
    updateProjectTabPartialHandler,
    deleteProjectTabHandler,
    setActiveProjectTabHandler,

    createChatTabHandler,
    updateChatTabHandler,
    updateChatTabPartialHandler,
    deleteChatTabHandler,
    setActiveChatTabHandler,

    updateGlobalStateKeyHandler,
];