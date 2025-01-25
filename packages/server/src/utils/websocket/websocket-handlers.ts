import { ServerWebSocket } from "bun";
import { 
  type GlobalState, 
  type InboundMessage,
  type ProjectTabState,
  stateUpdateMessageSchema,
  createProjectTabMessageSchema,
  updateProjectTabMessageSchema,
  updateProjectTabPartialMessageSchema,
  deleteProjectTabMessageSchema,
  createChatTabMessageSchema,
  updateChatTabMessageSchema,
  updateChatTabPartialMessageSchema,
  deleteChatTabMessageSchema,
  setActiveChatTabMessageSchema,
  updateGlobalStateKeyMessageSchema,
  createProjectTabFromTicketSchema,
  globalStateSchema
} from "shared";
import { z } from "zod";
import { mergeDeep } from "./merge-deep";

type StateUpdateMessage = z.infer<typeof stateUpdateMessageSchema>;
type CreateProjectTabMessage = z.infer<typeof createProjectTabMessageSchema>;
type UpdateProjectTabMessage = z.infer<typeof updateProjectTabMessageSchema>;
type UpdateProjectTabPartialMessage = z.infer<typeof updateProjectTabPartialMessageSchema>;
type DeleteProjectTabMessage = z.infer<typeof deleteProjectTabMessageSchema>;
type CreateChatTabMessage = z.infer<typeof createChatTabMessageSchema>;
type UpdateChatTabMessage = z.infer<typeof updateChatTabMessageSchema>;
type UpdateChatTabPartialMessage = z.infer<typeof updateChatTabPartialMessageSchema>;
type DeleteChatTabMessage = z.infer<typeof deleteChatTabMessageSchema>;
type SetActiveChatTabMessage = z.infer<typeof setActiveChatTabMessageSchema>;
type UpdateGlobalStateKeyMessage = z.infer<typeof updateGlobalStateKeyMessageSchema>;
type CreateProjectTabFromTicketMessage = z.infer<typeof createProjectTabFromTicketSchema>;

type MessageHandler<TState, TMessage extends InboundMessage> = {
  type: TMessage["type"];
  handle: (
    ws: ServerWebSocket<any>,
    message: TMessage,
    getState: () => Promise<TState>,
    setState: (updated: TState) => Promise<void>
  ) => Promise<void>;
};


/** State update handler */
export const stateUpdateHandler: MessageHandler<GlobalState, StateUpdateMessage> = {
  type: "state_update",
  handle: async (ws, message, getState, setState) => {
    const oldState = await getState();
    const newData = globalStateSchema.parse(message.data);
    console.log("[stateUpdateHandler] Merging new state with old state");
    const merged = mergeDeep(oldState, newData);
    await setState(merged);
  },
};


/** Create project tab handler */
export const createProjectTabHandler: MessageHandler<GlobalState, CreateProjectTabMessage> = {
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

/** Update project tab handler */
export const updateProjectTabHandler: MessageHandler<GlobalState, UpdateProjectTabMessage> = {
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

/** Update project tab partial handler */
export const updateProjectTabPartialHandler: MessageHandler<GlobalState, UpdateProjectTabPartialMessage> = {
  type: "update_project_tab_partial",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    await setState({
      ...state,
      projectTabs: {
        ...state.projectTabs,
        [message.tabId]: {
          ...state.projectTabs[message.tabId],
          ...message.partial,
        },
      },
    });
  },
};

/** Delete project tab handler */
export const deleteProjectTabHandler: MessageHandler<GlobalState, DeleteProjectTabMessage> = {
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

/** Create chat tab handler */
export const createChatTabHandler: MessageHandler<GlobalState, CreateChatTabMessage> = {
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

/** Update chat tab handler */
export const updateChatTabHandler: MessageHandler<GlobalState, UpdateChatTabMessage> = {
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

/** Update chat tab partial handler */
export const updateChatTabPartialHandler: MessageHandler<GlobalState, UpdateChatTabPartialMessage> = {
  type: "update_chat_tab_partial",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    await setState({
      ...state,
      chatTabs: {
        ...state.chatTabs,
        [message.tabId]: {
          ...state.chatTabs[message.tabId],
          ...message.partial,
        },
      },
    });
  },
};

/** Delete chat tab handler */
export const deleteChatTabHandler: MessageHandler<GlobalState, DeleteChatTabMessage> = {
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

/** Set active chat tab handler */
export const setActiveChatTabHandler: MessageHandler<GlobalState, SetActiveChatTabMessage> = {
  type: "set_active_chat_tab",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    await setState({
      ...state,
      chatActiveTabId: message.tabId,
    });
  },
};

/** Update global state key handler */
export const updateGlobalStateKeyHandler: MessageHandler<GlobalState, UpdateGlobalStateKeyMessage> = {
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
    }
  },
};

/** Create project tab from ticket handler */
export const createProjectTabFromTicketHandler: MessageHandler<GlobalState, CreateProjectTabFromTicketMessage> = {
  type: "create_project_tab_from_ticket",
  handle: async (ws, message, getState, setState) => {
    const state = await getState();
    const defaultProjectTab = {
      selectedProjectId: null,
      editProjectId: null,
      promptDialogOpen: false,
      editPromptId: null,
      fileSearch: '',
      selectedFiles: null,
      selectedPrompts: [],
      userPrompt: '',
      searchByContent: false,
      contextLimit: 128000,
      resolveImports: false,
      preferredEditor: 'vscode' as const,
      suggestedFileIds: [],
      bookmarkedFileGroups: {},
      ticketSearch: '',
      ticketSort: 'created_desc' as const,
      ticketStatusFilter: 'all' as const,
      ticketId: message.ticketId,
      ...message.data,
    } satisfies ProjectTabState;

    await setState({
      ...state,
      projectTabs: {
        ...state.projectTabs,
        [message.tabId]: defaultProjectTab,
      },
    });
  },
};

/** Combined handlers array */
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
] as const as MessageHandler<GlobalState, InboundMessage>[]