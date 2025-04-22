import { z } from "zod";
import {
    globalStateSchema,
    projectTabStateSchema,
    providerSchema,
    themeSchema,
    appSettingsSchema,
    type GlobalState
} from "./global-state-schema";

/**
 * Base inbound shape: must have a `type` field.
 */
export const baseInboundMessageSchema = z.object({
    type: z.string(),
});

/**
 * Concrete message schemas.
 * Use .extend({ type: z.literal("...") }) to discriminate by `type`.
 */

// 1) State update
export const stateUpdateMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("state_update"),
    data: globalStateSchema,
});

// 2) Initial state
export const initialStateMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("initial_state"),
    data: globalStateSchema,
});

// 3) Create project tab
export const createProjectTabMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("create_project_tab"),
    tabId: z.string(),
    data: projectTabStateSchema,
});

// 4) Update project tab
export const updateProjectTabMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("update_project_tab"),
    tabId: z.string(),
    data: projectTabStateSchema,
});

// 5) Update project tab partial
export const updateProjectTabPartialMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("update_project_tab_partial"),
    tabId: z.string(),
    partial: projectTabStateSchema.partial().default({}),
});

// 6) Delete project tab
export const deleteProjectTabMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("delete_project_tab"),
    tabId: z.string(),
});

// 7) Set active project tab
export const setActiveProjectTabMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("set_active_project_tab"),
    tabId: z.string(),
});

// 8) Set active chat
export const setActiveChatMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("set_active_chat"),
    chatId: z.string(),
});

// 9) Update chat link settings
export const updateChatLinkSettingsMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("update_chat_link_settings"),
    chatId: z.string(),
    settings: z.object({
        includeSelectedFiles: z.boolean().optional(),
        includePrompts: z.boolean().optional(),
        includeUserPrompt: z.boolean().optional(),
        linkedProjectTabId: z.string().nullable().optional(),
    }).partial(),
});

// 10) Unlink project from chat
export const unlinkProjectFromChatMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("unlink_project_from_chat"),
    chatId: z.string(),
});

// 13) Create project tab from ticket
export const createProjectTabFromTicketSchema = baseInboundMessageSchema.extend({
    type: z.literal("create_project_tab_from_ticket"),
    tabId: z.string(),
    ticketId: z.string(),
    data: projectTabStateSchema.partial().default({}),
});

// 14) Update global state key (generic partial)
export const updateGlobalStateKeyMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("update_global_state_key"),
    data: z.object({
        key: z.string(),
        // Accept any shape, default to {}
        partial: z.record(z.unknown()).optional().default({}),
    }),
});

// 15) Update entire settings
export const updateSettingsMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("update_settings"),
    data: appSettingsSchema,
});

// 16) Update partial settings
export const updateSettingsPartialMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("update_settings_partial"),
    partial: appSettingsSchema.partial().default({}),
});

// 17) Update theme
export const updateThemeMessageSchema = baseInboundMessageSchema.extend({
    type: z.literal("update_theme"),
    theme: themeSchema,
});

/**
 * Combine all into a single discriminated union on "type".
 */
export const inboundMessageSchema = z.discriminatedUnion("type", [
    stateUpdateMessageSchema,
    initialStateMessageSchema,
    createProjectTabMessageSchema,
    updateProjectTabMessageSchema,
    updateProjectTabPartialMessageSchema,
    deleteProjectTabMessageSchema,
    setActiveProjectTabMessageSchema,
    setActiveChatMessageSchema,
    updateChatLinkSettingsMessageSchema,
    unlinkProjectFromChatMessageSchema,
    createProjectTabFromTicketSchema,
    updateGlobalStateKeyMessageSchema,
    updateSettingsMessageSchema,
    updateSettingsPartialMessageSchema,
    updateThemeMessageSchema,
]);

export type InboundMessage = z.infer<typeof inboundMessageSchema>;

/**
 * OPTIONAL: define outbound messages similarly, if needed.
 */
export const outboundMessageSchema = inboundMessageSchema;
export type OutboundMessage = z.infer<typeof outboundMessageSchema>;

/**
 * validateIncomingMessage - used in BNK manager to parse incoming data
 */
export function validateIncomingMessage(raw: unknown): InboundMessage {
    const asJson =
        typeof raw === "string"
            ? JSON.parse(raw)
            : typeof raw === "object"
                ? raw
                : {};
    return inboundMessageSchema.parse(asJson);
}