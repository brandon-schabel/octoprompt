/**
 * packages/shared/src/types/websocket-schemas.ts
 */

import { z } from "zod";
import { 
  globalStateSchema, 
  type GlobalState,
  projectTabStateSchema,
  chatTabStateSchema,
  linkSettingsSchema,
  providerSchema,
  type APIProviders,
  themeSchema,
  type Theme,
  appSettingsSchema,
  type AppSettings,
  type ChatTabState,
  type ProjectTabState
} from "./global-state-schema";

/**
 * A "base" inbound message shape:
 * The BNK manager expects at least a `type` field.
 * If you want other top-level fields, define them below.
 */
export const baseInboundMessageSchema = z.object({
  type: z.string(),
});

/**
 * For partial updates, define a smaller schema that
 * only enforces certain fields as partial. Example:
 */
const partialGlobalStateSchema = globalStateSchema.deepPartial();

/**
 * Example: partial of ProjectTab. 
 * If you want more precise partial schemas for each message type,
 * do so the same way. This is just a demonstration:
 */
// import { projectTabStateSchema } from "../global-state/global-state-schema";
// const partialProjectTabSchema = projectTabStateSchema.deepPartial();

/**
 * Now define each *specific* message schema.
 * We use .extend({ ... }) to ensure they also contain "type: <literal>"
 * so the union can discriminate on "type".
 */

// 1) state_update: the client is providing a new full GlobalState
export const stateUpdateMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("state_update"),
  data: globalStateSchema,
});

// 2) initial_state: the client is providing an initial GlobalState (or requesting it)
export const initialStateMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("initial_state"),
  data: globalStateSchema,
});

// Create a default project tab state
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
};

// 3) create_project_tab
export const createProjectTabMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("create_project_tab"),
  tabId: z.string(),
  data: projectTabStateSchema.default(defaultProjectTab),
});

// 4) update_project_tab
export const updateProjectTabMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("update_project_tab"),
  tabId: z.string(),
  data: projectTabStateSchema,
});

// 5) update_project_tab_partial
export const updateProjectTabPartialMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("update_project_tab_partial"),
  tabId: z.string(),
  partial: projectTabStateSchema.partial().default({}),
});

// ... and so on for each message type you need:

export const deleteProjectTabMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("delete_project_tab"),
  tabId: z.string(),
});

export const setActiveProjectTabMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("set_active_project_tab"),
  tabId: z.string(),
});

// Chat tab messages
export const createChatTabMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("create_chat_tab"),
  tabId: z.string(),
  data: chatTabStateSchema.default({}),
});

export const updateChatTabMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("update_chat_tab"),
  tabId: z.string(),
  data: chatTabStateSchema,
});

export const updateChatTabPartialMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("update_chat_tab_partial"),
  tabId: z.string(),
  partial: chatTabStateSchema.partial().default({}),
});

export const deleteChatTabMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("delete_chat_tab"),
  tabId: z.string(),
});

export const setActiveChatTabMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("set_active_chat_tab"),
  tabId: z.string(),
});

// Example: create_project_tab_from_ticket
export const createProjectTabFromTicketSchema = baseInboundMessageSchema.extend({
  type: z.literal("create_project_tab_from_ticket"),
  tabId: z.string(),
  ticketId: z.string(),
  data: z.record(z.unknown()).default({}),
});

/**
 * If you have messages to do a partial update of the entire GlobalState,
 * you could do something like:
 */
export const updateGlobalStateKeyMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("update_global_state_key"),
  data: z.object({
    key: z.string(),
    partial: z.record(z.unknown()).default({}),
  }),
});

// Add settings related message schemas
export const updateSettingsMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("update_settings"),
  data: appSettingsSchema,
});

export const updateSettingsPartialMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("update_settings_partial"),
  partial: appSettingsSchema.partial(),
});

// Add theme related message schema
export const updateThemeMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("update_theme"),
  theme: themeSchema,
});

// Add provider related message schema
export const updateProviderMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("update_provider"),
  provider: providerSchema,
  tabId: z.string(),
});

// Add link settings related message schema
export const updateLinkSettingsMessageSchema = baseInboundMessageSchema.extend({
  type: z.literal("update_link_settings"),
  tabId: z.string(),
  settings: linkSettingsSchema,
});

/**
 * Combine all the above into a *discriminated union* on "type".
 * This ensures that the .parse() can figure out which shape it is,
 * and you get a strongly typed result.
 */
export const inboundMessageSchema = z.discriminatedUnion("type", [
  stateUpdateMessageSchema,
  initialStateMessageSchema,
  createProjectTabMessageSchema,
  updateProjectTabMessageSchema,
  updateProjectTabPartialMessageSchema,
  deleteProjectTabMessageSchema,
  setActiveProjectTabMessageSchema,

  createChatTabMessageSchema,
  updateChatTabMessageSchema,
  updateChatTabPartialMessageSchema,
  deleteChatTabMessageSchema,
  setActiveChatTabMessageSchema,

  updateGlobalStateKeyMessageSchema,
  createProjectTabFromTicketSchema,
  updateSettingsMessageSchema,
  updateSettingsPartialMessageSchema,
  updateThemeMessageSchema,
  updateProviderMessageSchema,
  updateLinkSettingsMessageSchema,
  // add others as needed...
]);

/**
 * Type for all inbound messages after passing through Zod.
 */
export type InboundMessage = z.infer<typeof inboundMessageSchema>;

/**
 * OPTIONAL: If you have outbound messages from server->client, define them similarly.
 */
export const outboundMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("state_update"),
    data: globalStateSchema,
  }),
  z.object({
    type: z.literal("error"),
    error: z.string(),
    code: z.number().optional(),
  }),
  z.object({
    type: z.literal("success"),
    message: z.string(),
  }),
]);
export type OutboundMessage = z.infer<typeof outboundMessageSchema>;

/**
 * validateIncomingMessage - used in BNK manager to parse incoming data.
 * This ensures the entire message is typed for your handlers.
 */
export function validateIncomingMessage(raw: unknown): InboundMessage {
  // If the raw data is already a string, parse JSON first:
  const asJson =
    typeof raw === "string"
      ? JSON.parse(raw)
      : typeof raw === "object"
      ? raw
      : {};

  return inboundMessageSchema.parse(asJson);
}

// Add type helpers for specific message types
export type UpdateSettingsMessage = z.infer<typeof updateSettingsMessageSchema>;
export type UpdateThemeMessage = z.infer<typeof updateThemeMessageSchema>;
export type UpdateProviderMessage = z.infer<typeof updateProviderMessageSchema>;
export type UpdateLinkSettingsMessage = z.infer<typeof updateLinkSettingsMessageSchema>;

// Add validation helper for specific message types
export const validateSettingsUpdate = (data: unknown): UpdateSettingsMessage => {
  return updateSettingsMessageSchema.parse(data);
};

export const validateThemeUpdate = (data: unknown): UpdateThemeMessage => {
  return updateThemeMessageSchema.parse(data);
};