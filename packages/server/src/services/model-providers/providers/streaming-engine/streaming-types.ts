import { ChatService } from "../../chat/chat-service";
import { ChatCompletionOptions } from "../provider-types";

export type StreamParams = {
    chatId: string;
    assistantMessageId: string;
    userMessage: string;
    chatService: ChatService;
    options: ChatCompletionOptions;
    tempId?: string;
};