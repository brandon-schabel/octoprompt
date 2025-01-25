
import { MessageHandler } from "@bnk/backend-websocket-manager";
import type { GlobalState, InboundMessage, ProjectTabState } from "shared";
import { globalStateSchema } from "shared";
import { logger } from "../utils/logger";
import { TicketService } from "@/services/ticket-service";

const ticketServiceForWS = new TicketService();

/**
 * Helper to build default project tab state
 */
function buildDefaultProjectTabState(partial?: Partial<ProjectTabState>): ProjectTabState {
    return {
        selectedProjectId: null,
        editProjectId: null,
        promptDialogOpen: false,
        editPromptId: null,
        fileSearch: "",
        selectedFiles: [],
        selectedPrompts: [],
        userPrompt: "",
        searchByContent: false,
        displayName: partial?.displayName ?? "Untitled Tab",
        contextLimit: partial?.contextLimit ?? 128000,
        resolveImports: partial?.resolveImports ?? false,
        preferredEditor: partial?.preferredEditor ?? "vscode",
        suggestedFileIds: partial?.suggestedFileIds ?? [],
        bookmarkedFileGroups: partial?.bookmarkedFileGroups ?? {},
        ticketSearch: partial?.ticketSearch ?? "",
        ticketSort: partial?.ticketSort ?? "created_desc",
        ticketStatusFilter: partial?.ticketStatusFilter ?? "all",
        ...partial,
    };
}

/**
 * This is an example of how your typed message handlers can look now.
 * BNK's `handle(...)` receives a strongly-typed `message`.
 */

// State Update Handler
export const stateUpdateHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "state_update",
    async handle(ws, message, getState, setState) {
        const validated = globalStateSchema.parse(message.data);
        await setState(validated);
    },
};

// Initial State Handler
export const initialStateHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "initial_state", 
    async handle(ws, message, getState, setState) {
        const validated = globalStateSchema.parse(message.data);
        await setState(validated);
    },
};

// Project Tab Handlers
export const createProjectTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "create_project_tab",
    async handle(ws, message, getState, setState) {
        const state = await getState();
        const { tabId, data } = message;

        state.projectTabs[tabId] = data;
        state.settings.projectTabIdOrder.push(tabId);
        state.projectActiveTabId = tabId;

        const validated = globalStateSchema.parse(state);
        await setState(validated);
    },
};

export const updateProjectTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "update_project_tab",
    async handle(ws, message, getState, setState) {
        const state = await getState();
        const { tabId, data } = message;

        if (!state.projectTabs[tabId]) {
            logger.warn("Project tab not found:", tabId);
            return;
        }

        state.projectTabs[tabId] = {
            ...state.projectTabs[tabId],
            ...data,
        };

        const validated = globalStateSchema.parse(state);
        await setState(validated);
    },
};

/**
 * Additional handlers for partial updates, deletes, etc.
 * The difference now: each 'message' is guaranteed by Zod to have correct shape.
 */
export const updateProjectTabPartialHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "update_project_tab_partial",
    async handle(ws, message, getState, setState) {
        const state = await getState();
        const { tabId, partial } = message;

        if (!state.projectTabs[tabId]) return;

        state.projectTabs[tabId] = {
            ...state.projectTabs[tabId],
            ...partial,
        };

        const validated = globalStateSchema.parse(state);
        await setState(validated);
    },
};

export const deleteProjectTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "delete_project_tab",
    async handle(ws, message, getState, setState) {
        const state = await getState();
        const { tabId } = message;

        if (Object.keys(state.projectTabs).length <= 1) {
            logger.warn("Cannot delete the last remaining project tab");
            return;
        }

        delete state.projectTabs[tabId];
        state.settings.projectTabIdOrder = state.settings.projectTabIdOrder.filter(
            (id) => id !== tabId
        );
        
        if (state.projectActiveTabId === tabId) {
            const remaining = Object.keys(state.projectTabs);
            state.projectActiveTabId = remaining.length > 0 ? remaining[0] : null;
        }

        const validated = globalStateSchema.parse(state);
        await setState(validated);
    },
};

// Chat Tab Handlers
export const createChatTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "create_chat_tab",
    async handle(ws, message, getState, setState) {
        const state = await getState();
        const { tabId, data } = message;

        state.chatTabs[tabId] = data;
        state.settings.chatTabIdOrder.push(tabId);
        state.chatActiveTabId = tabId;

        const validated = globalStateSchema.parse(state);
        await setState(validated);
    },
};

export const updateChatTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "update_chat_tab",
    async handle(ws, message, getState, setState) {
        const state = await getState();
        const { tabId, data } = message;

        if (!state.chatTabs[tabId]) {
            logger.warn("Chat tab not found:", tabId);
            return;
        }

        state.chatTabs[tabId] = {
            ...state.chatTabs[tabId],
            ...data,
        };

        const validated = globalStateSchema.parse(state);
        await setState(validated);
    },
};

export const updateChatTabPartialHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "update_chat_tab_partial",
    async handle(ws, message, getState, setState) {
        const state = await getState();
        const { tabId, partial } = message;

        if (!state.chatTabs[tabId]) {
            logger.warn("Chat tab not found:", tabId);
            return;
        }

        state.chatTabs[tabId] = {
            ...state.chatTabs[tabId],
            ...partial,
        };

        const validated = globalStateSchema.parse(state);
        await setState(validated);
    },
};

export const deleteChatTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "delete_chat_tab",
    async handle(ws, message, getState, setState) {
        const state = await getState();
        const { tabId } = message;

        if (Object.keys(state.chatTabs).length <= 1) {
            logger.warn("Cannot delete the last remaining chat tab");
            return;
        }

        state.settings.chatTabIdOrder = state.settings.chatTabIdOrder.filter(id => id !== tabId);
        delete state.chatTabs[tabId];

        if (state.chatActiveTabId === tabId) {
            const remaining = Object.keys(state.chatTabs);
            state.chatActiveTabId = remaining.length > 0 ? remaining[0] : null;
        }

        const validated = globalStateSchema.parse(state);
        await setState(validated);
    },
};

export const setActiveChatTabHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "set_active_chat_tab",
    async handle(ws, message, getState, setState) {
        const state = await getState();
        const { tabId } = message;

        if (!state.chatTabs[tabId]) {
            logger.warn("Cannot set active chat tab; not found:", tabId);
            return;
        }

        state.chatActiveTabId = tabId;
        const validated = globalStateSchema.parse(state);
        await setState(validated);
    },
};

// Global State Handler
export const updateGlobalStateKeyHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "update_global_state_key",
    async handle(ws, message, getState, setState) {
        const state = await getState();
        const { key, partial } = message.data;

        const currentValue = state[key];
        if (typeof currentValue === "object" && currentValue !== null) {
            state[key] = { ...currentValue, ...partial } as any;
        } else {
            state[key] = partial as any;
        }

        const validated = globalStateSchema.parse(state);
        await setState(validated);
    },
};

// Create Project Tab from Ticket Handler
export const createProjectTabFromTicketHandler: MessageHandler<GlobalState, InboundMessage> = {
    type: "create_project_tab_from_ticket",
    async handle(ws, message, getState, setState) {
        const state = await getState();
        const { tabId, ticketId, data } = message;

        if (state.projectTabs[tabId]) {
            throw new Error(`Project tab ${tabId} already exists`);
        }

        const newTabData = buildDefaultProjectTabState(data);
        state.projectTabs[tabId] = newTabData;
        state.settings.projectTabIdOrder.push(tabId);
        state.projectActiveTabId = tabId;

        const validated = globalStateSchema.parse(state);
        await setState(validated);
    },
};

/** Combined handlers array */
export const allWebsocketHandlers: Array<MessageHandler<GlobalState, InboundMessage>> = [
    stateUpdateHandler,
    initialStateHandler,
    createProjectTabHandler,
    updateProjectTabHandler,
    updateProjectTabPartialHandler,
    deleteProjectTabHandler,
    createChatTabHandler,
    updateChatTabHandler,
    updateChatTabPartialHandler,
    deleteChatTabHandler,
    setActiveChatTabHandler,
    updateGlobalStateKeyHandler,
    createProjectTabFromTicketHandler,
];