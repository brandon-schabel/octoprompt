import type { MessageHandler, BaseMessage } from "../websocket-types";

// 1) Define a single union type for all messages
export type ProjectTabMessage =
  | {
      type: "create_project_tab";
      tabId: string;
      title: string;
    }
  | {
      type: "update_project_tab";
      tabId: string;
      content: string;
    };

// Your global or slice-of-state type
export interface MyAppState {
  projectTabs: Record<
    string,
    {
      title: string;
      content: string;
    }
  >;
}

// 2) Each handler is typed with the full union
export const createOrUpdateProjectTabHandler: MessageHandler<
  MyAppState,
  ProjectTabMessage
> = {
  // The manager will match the handler by `type` field:
  // We'll do a runtime check to ensure we only handle the relevant subtype.
  type: "create_project_tab" as ProjectTabMessage["type"],

  async handle(ws, message, getState, setState) {
    const state = await getState();

    // 3) Narrow by checking `message.type`
    if (message.type === "create_project_tab") {
      state.projectTabs[message.tabId] = {
        title: message.title,
        content: "",
      };
    } else if (message.type === "update_project_tab") {
      const tab = state.projectTabs[message.tabId];
      if (tab) {
        tab.content = message.content;
      }
    }

    await setState(state);
  },
};

/**
 * Export an array of handlers, all typed to the union.
 * Each can do its own internal if-check to see if it
 * actually wants to process the message.
 */
export const projectTabHandlers = [createOrUpdateProjectTabHandler];