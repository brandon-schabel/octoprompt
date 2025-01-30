import { ServerWebSocket } from "bun";
import { z } from "zod";
import {
  globalStateSchema,
  type GlobalState,
  type InboundMessage,
  ProjectTabState,
} from "shared";
import { mergeDeep } from "shared";

/** Generic type for a message handler of a certain 'type' */
type WebSocketMessageHandler<T extends InboundMessage["type"]> = {
  type: T;
  handle: (
    ws: ServerWebSocket<any>,
    message: Extract<InboundMessage, { type: T }>,
    getState: () => Promise<GlobalState>,
    setState: (updated: GlobalState) => Promise<void>
  ) => Promise<void>;
};

function isMessageHandler<T extends InboundMessage["type"]>(
  handler: WebSocketMessageHandler<any>,
  type: T
): handler is WebSocketMessageHandler<T> {
  return handler.type === type;
}

// ---------------------------------------------------
// Example handlers
// ---------------------------------------------------

export const stateUpdateHandler: WebSocketMessageHandler<"state_update"> = {
  type: "state_update",
  handle: async (ws, message, getState, setState) => {
    const oldState = await getState();
    const newData = globalStateSchema.parse(message.data);
    const merged = mergeDeep(oldState, newData);
    await setState(merged);
  },
};

export const createProjectTabHandler: WebSocketMessageHandler<"create_project_tab"> = {
  type: "create_project_tab",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    await setState({
      ...state,
      projectTabs: {
        ...state.projectTabs,
        [message.tabId]: message.data,
      },
    });
  },
};

export const updateProjectTabHandler: WebSocketMessageHandler<"update_project_tab"> = {
  type: "update_project_tab",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    await setState({
      ...state,
      projectTabs: {
        ...state.projectTabs,
        [message.tabId]: message.data,
      },
    });
  },
};

export const updateProjectTabPartialHandler: WebSocketMessageHandler<"update_project_tab_partial"> = {
  type: "update_project_tab_partial",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    const existingTab = state.projectTabs[message.tabId] || {};
    await setState({
      ...state,
      projectTabs: {
        ...state.projectTabs,
        [message.tabId]: {
          ...existingTab,
          ...message.partial,
        },
      },
    });
  },
};

export const deleteProjectTabHandler: WebSocketMessageHandler<"delete_project_tab"> = {
  type: "delete_project_tab",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    const { [message.tabId]: _, ...remainingTabs } = state.projectTabs;
    await setState({
      ...state,
      projectTabs: remainingTabs,
    });
  },
};

export const createChatTabHandler: WebSocketMessageHandler<"create_chat_tab"> = {
  type: "create_chat_tab",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    await setState({
      ...state,
      chatTabs: {
        ...state.chatTabs,
        [message.tabId]: message.data,
      },
    });
  },
};

export const updateChatTabHandler: WebSocketMessageHandler<"update_chat_tab"> = {
  type: "update_chat_tab",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    await setState({
      ...state,
      chatTabs: {
        ...state.chatTabs,
        [message.tabId]: message.data,
      },
    });
  },
};

export const updateChatTabPartialHandler: WebSocketMessageHandler<"update_chat_tab_partial"> = {
  type: "update_chat_tab_partial",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    const existingTab = state.chatTabs[message.tabId] || {};
    await setState({
      ...state,
      chatTabs: {
        ...state.chatTabs,
        [message.tabId]: {
          ...existingTab,
          ...message.partial,
        },
      },
    });
  },
};

export const deleteChatTabHandler: WebSocketMessageHandler<"delete_chat_tab"> = {
  type: "delete_chat_tab",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    const { [message.tabId]: _, ...remainingTabs } = state.chatTabs;
    await setState({
      ...state,
      chatTabs: remainingTabs,
    });
  },
};

export const setActiveChatTabHandler: WebSocketMessageHandler<"set_active_chat_tab"> = {
  type: "set_active_chat_tab",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    await setState({
      ...state,
      chatActiveTabId: message.tabId,
    });
  },
};

export const updateGlobalStateKeyHandler: WebSocketMessageHandler<"update_global_state_key"> = {
  type: "update_global_state_key",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    const key = message.data.key as keyof GlobalState;
    const currentValue = state[key];
    if (currentValue && typeof currentValue === "object") {
      await setState({
        ...state,
        [key]: {
          ...currentValue,
          ...message.data.partial,
        },
      });
    } else {
      await setState({
        ...state,
        [key]: message.data.partial,
      });
    }
  },
};

export const createProjectTabFromTicketHandler: WebSocketMessageHandler<"create_project_tab_from_ticket"> = {
  type: "create_project_tab_from_ticket",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    // Extend the default if needed:
    const defaultProjectTab: Partial<ProjectTabState> = {
      ticketId: message.ticketId,
      ...message.data,
    };
    await setState({
      ...state,
      // @ts-expect-error: TODO: fix this
      projectTabs: {
        ...state.projectTabs,
        [message.tabId]: {
          ...defaultProjectTab,
        },
      },
    });
  },
};

export const setActiveProjectTabHandler: WebSocketMessageHandler<"set_active_project_tab"> = {
  type: "set_active_project_tab",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    await setState({
      ...state,
      projectActiveTabId: message.tabId,
    });
  },
};

export const updateSettingsHandler: WebSocketMessageHandler<"update_settings"> = {
  type: "update_settings",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    await setState({
      ...state,
      settings: message.data,
    });
  },
};

export const updateSettingsPartialHandler: WebSocketMessageHandler<"update_settings_partial"> = {
  type: "update_settings_partial",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    await setState({
      ...state,
      settings: {
        ...state.settings,
        ...message.partial,
      },
    });
  },
};

export const updateThemeHandler: WebSocketMessageHandler<"update_theme"> = {
  type: "update_theme",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    await setState({
      ...state,
      settings: {
        ...state.settings,
        theme: message.theme,
      },
    });
  },
};

export const updateProviderHandler: WebSocketMessageHandler<"update_provider"> = {
  type: "update_provider",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    const { tabId, provider } = message;
    const existingTab = state.projectTabs[tabId] || {};
    await setState({
      ...state,
      projectTabs: {
        ...state.projectTabs,
        [tabId]: {
          ...existingTab,
          provider,
        },
      },
    });
  },
};

export const updateLinkSettingsHandler: WebSocketMessageHandler<"update_link_settings"> = {
  type: "update_link_settings",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    const existingTab = state.projectTabs[message.tabId] || {};
    await setState({
      ...state,
      projectTabs: {
        ...state.projectTabs,
        [message.tabId]: {
          ...existingTab,
          linkSettings: message.settings,
        },
      },
    });
  },
};

/** Combine all handlers into one array */
export const allWebsocketHandlers = [
  stateUpdateHandler,
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
  setActiveProjectTabHandler,
  updateSettingsHandler,
  updateSettingsPartialHandler,
  updateThemeHandler,
  updateProviderHandler,
  updateLinkSettingsHandler,
] as const;