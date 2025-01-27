import { z } from "zod";
import { createBodySchema, type ModelOptions } from "./model-options-schema";
import type { APIProviders } from "../global-state/global-state-schema";

export const chatApiValidation = {
    create: {
        body: createBodySchema
    },
    createChat: {
        body: z.object({
            title: z.string().min(1),
            copyExisting: z.boolean().optional(),
            currentChatId: z.string().optional()
        })
    },
    getMessages: {
        params: z.object({
            chatId: z.string()
        })
    },
    forkChat: {
        params: z.object({
            chatId: z.string()
        }),
        body: z.object({
            excludedMessageIds: z.array(z.string()).default([])
        })
    },
    forkChatFromMessage: {
        params: z.object({
            chatId: z.string(),
            messageId: z.string()
        }),
        body: z.object({
            excludedMessageIds: z.array(z.string()).default([])
        })
    },
    updateChat: {
        params: z.object({
            chatId: z.string()
        }),
        body: z.object({
            title: z.string().min(1)
        })
    },
    deleteChat: {
        params: z.object({
            chatId: z.string()
        })
    },
    deleteMessage: {
        params: z.object({
            messageId: z.string()
        })
    },
    fileSearchValidation: {
        body: z.union([
            z.object({
                projectId: z.string().min(1),
                query: z.string().optional()
            }),
            z.any()
        ]),
    }
} as const // satisfies ApiValidationSchemaRecord;

export type CreateMessageBody = z.infer<typeof chatApiValidation.create.body>;
export type CreateChatBody = z.infer<typeof chatApiValidation.createChat.body>;
export type GetMessagesParams = z.infer<typeof chatApiValidation.getMessages.params>;
export type ForkChatParams = z.infer<typeof chatApiValidation.forkChat.params>;
export type ForkChatBody = z.infer<typeof chatApiValidation.forkChat.body>;
export type ForkChatFromMessageParams = z.infer<typeof chatApiValidation.forkChatFromMessage.params>;
export type ForkChatFromMessageBody = z.infer<typeof chatApiValidation.forkChatFromMessage.body>;
export type UpdateChatParams = z.infer<typeof chatApiValidation.updateChat.params>;
export type UpdateChatBody = z.infer<typeof chatApiValidation.updateChat.body>;
export type DeleteChatParams = z.infer<typeof chatApiValidation.deleteChat.params>;
export type DeleteMessageParams = z.infer<typeof chatApiValidation.deleteMessage.params>;
export type FileSearchValidationBody = z.infer<typeof chatApiValidation.fileSearchValidation.body>;


export type CreateMessageBodyGeneric<TProvider extends APIProviders> = {
    message: string;
    chatId: string;
    excludedMessageIds?: string[];
    tempId?: string;
} & ModelOptions<TProvider>;

