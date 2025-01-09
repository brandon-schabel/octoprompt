import { ChatCompletionOptions } from "../provider-types";

export type StreamParams = {
    chatId: string;
    assistantMessageId: string;
    userMessage: string;
    options: ChatCompletionOptions;
    tempId?: string;
};