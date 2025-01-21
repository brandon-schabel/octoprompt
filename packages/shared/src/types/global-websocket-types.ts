import type { BaseMessage } from "@bnk/backend-websocket-manager";
import type { GlobalState } from "../global-state/global-state-schema";
import type { Ticket } from "../..";

/** Outbound message to broadcast the entire GlobalState */
export interface StateUpdateMessage extends BaseMessage {
    type: "state_update";
    data: GlobalState;
}

/** Initial state message sent when client first connects */
export interface InitialStateMessage extends BaseMessage {
    type: "initial_state";
    data: GlobalState;
}

// PROJECT TAB MESSAGES
export interface CreateProjectTabMessage extends BaseMessage {
    type: "create_project_tab";
    tabId: string;
    data: GlobalState["projectTabs"][string];
}

export interface UpdateProjectTabMessage extends BaseMessage {
    type: "update_project_tab";
    tabId: string;
    data: GlobalState["projectTabs"][string];
}

export interface UpdateProjectTabPartialMessage extends BaseMessage {
    type: "update_project_tab_partial";
    tabId: string;
    partial: Partial<GlobalState["projectTabs"][string]>;
}

export interface DeleteProjectTabMessage extends BaseMessage {
    type: "delete_project_tab";
    tabId: string;
}

export interface SetActiveProjectTabMessage extends BaseMessage {
    type: "set_active_project_tab";
    tabId: string;
}

// CHAT TAB MESSAGES
export interface CreateChatTabMessage extends BaseMessage {
    type: "create_chat_tab";
    tabId: string;
    data: GlobalState["chatTabs"][string];
}

export interface UpdateChatTabMessage extends BaseMessage {
    type: "update_chat_tab";
    tabId: string;
    data: Partial<GlobalState["chatTabs"][string]>;
}

export interface UpdateChatTabPartialMessage extends BaseMessage {
    type: "update_chat_tab_partial";
    tabId: string;
    partial: Partial<GlobalState["chatTabs"][string]>;
}

export interface DeleteChatTabMessage extends BaseMessage {
    type: "delete_chat_tab";
    tabId: string;
}

export interface SetActiveChatTabMessage extends BaseMessage {
    type: "set_active_chat_tab";
    tabId: string;
}

/** Generic message to update a top-level key in GlobalState. */
export interface UpdateGlobalStateKeyMessage extends BaseMessage {
    type: "update_global_state_key";
    data: {
        key: keyof GlobalState;
        partial: Partial<GlobalState[keyof GlobalState]>;
    };
}


export interface TicketCreatedMessage extends BaseMessage {
    type: "ticket_created";
    ticket: Ticket;
}

export interface TicketUpdatedMessage extends BaseMessage {
    type: "ticket_updated";
    ticket: Ticket;
}

export interface TicketDeletedMessage extends BaseMessage {
    type: "ticket_deleted";
    ticketId: string;
    projectId: string; // so clients know which project's ticket was deleted
}

export interface CreateProjectTabFromTicketMessage extends BaseMessage {
    type: "create_project_tab_from_ticket";
    tabId: string;
    ticketId: string;
    data: GlobalState["projectTabs"][string];
}

/** 
 * Union of all possible inbound messages. 
 * Both state_update and initial_state are included since they can be 
 * handled on both client and server sides.
 */
export type InboundMessage =
    | StateUpdateMessage
    | InitialStateMessage
    | CreateProjectTabMessage
    | UpdateProjectTabMessage
    | UpdateProjectTabPartialMessage
    | DeleteProjectTabMessage
    | SetActiveProjectTabMessage
    | CreateChatTabMessage
    | UpdateChatTabMessage
    | UpdateChatTabPartialMessage
    | DeleteChatTabMessage
    | SetActiveChatTabMessage
    | UpdateGlobalStateKeyMessage
    | TicketCreatedMessage
    | TicketUpdatedMessage
    | TicketDeletedMessage
    | CreateProjectTabFromTicketMessage

export type { BaseMessage }