import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../use-api';
import { CreateChatBody, Chat, ChatMessage, APIProviders } from 'shared'
import { CreateMessageBodyGeneric } from 'shared/src/validation/chat-api-validation';
import { commonErrorHandler } from './common-mutation-error-handler';
import { CreateChatOptions } from '@/components/chat/chat-dialog';


interface UnifiedModel {
    id: string;
    name: string;
    description: string;
}

export type UpdateChatInput = {
    title: string;
};

// Provider-specific message input type
export type SendMessageInput<TProvider extends APIProviders> = CreateMessageBodyGeneric<TProvider>

// Add new types for the unified models API
type ModelsResponse = {
    data: UnifiedModel[];
};

// Add to your existing CHAT_KEYS
export const CHAT_KEYS = {
    all: ['chat'] as const,
    chats: () => [...CHAT_KEYS.all, 'chats'] as const,
    chat: (id: string) => [...CHAT_KEYS.chats(), id] as const,
    messages: (chatId: string) => [...CHAT_KEYS.chat(chatId), 'messages'] as const,
    models: (provider: APIProviders) => [...CHAT_KEYS.all, 'models', provider] as const,
};

async function getChats(api: ReturnType<typeof useApi>['api']): Promise<{ chats: Chat[] }> {
    const response = await api.request('/api/chats');
    return response.json();
}

async function getMessages(api: ReturnType<typeof useApi>['api'], chatId: string): Promise<{ data: ChatMessage[] }> {
    const response = await api.request(`/api/chats/${chatId}/messages`);
    return response.json();
}

async function sendMessage<T extends APIProviders>(
    api: ReturnType<typeof useApi>['api'],
    input: SendMessageInput<T>
): Promise<ReadableStream<Uint8Array>> {
    try {
        console.log(`[sendMessage] Sending message to chatId: ${input.chatId}`);

        const response = await api.request('/api/chat', {
            method: 'POST',
            body: input
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`[sendMessage] Server error:`, errorData);
            throw new Error(errorData.error || `Failed to send message (${response.status})`);
        }

        // Check if the response has a body stream
        if (!response.body) {
            console.error(`[sendMessage] No response body stream available`);
            throw new Error('No response stream available');
        }

        return response.body as ReadableStream<Uint8Array>;
    } catch (error) {
        console.error(`[sendMessage] Exception:`, error);
        throw error;
    }
}


async function deleteChat(api: ReturnType<typeof useApi>['api'], chatId: string): Promise<void> {
    const response = await api.request(`/api/chats/${chatId}`, { method: 'DELETE' });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete chat');
    }
}

async function updateChat(api: ReturnType<typeof useApi>['api'], chatId: string, input: UpdateChatInput): Promise<Chat> {
    const response = await api.request(`/api/chats/${chatId}`, {
        method: 'PATCH',
        body: input,
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update chat');
    }
    const data = await response.json();
    return data.data;
}

async function deleteMessage(api: ReturnType<typeof useApi>['api'], messageId: string): Promise<void> {
    const response = await api.request(`/api/ai/messages/${messageId}`, { method: 'DELETE' });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete message');
    }
}

// Hooks
export const useGetChats = () => {
    const { api } = useApi();
    return useQuery({
        queryKey: CHAT_KEYS.chats(),
        queryFn: () => getChats(api),
    });
};

export const useCreateChat = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<Chat, Error, CreateChatOptions>({
        mutationFn: async (input: CreateChatOptions) => {
            const response = await api.request('/api/chats', {
                method: 'POST',
                body: {
                    title: input.title || 'New Chat',
                    copyExisting: input.copyExisting || false,
                    currentChatId: input.currentChatId
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create chat');
            }

            const data = await response.json();
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.chats() });
        },
        onError: commonErrorHandler
    });
};

export const useGetMessages = (chatId: string) => {
    const { api } = useApi();
    return useQuery({
        queryKey: CHAT_KEYS.messages(chatId),
        queryFn: () => getMessages(api, chatId),
        enabled: !!chatId,
        staleTime: 0,
    });
};

export const useSendMessage = <Provider extends APIProviders>() => {
    const { api } = useApi();

    return useMutation<
        ReadableStream<Uint8Array>,
        Error,
        SendMessageInput<Provider>
    >({
        mutationFn: (input) => sendMessage(api, input),
        onError: commonErrorHandler
    });
};


export const useForkChat = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation<Chat, Error, { chatId: string; excludedMessageIds: string[] }>({
        mutationFn: async ({ chatId, excludedMessageIds }) => {
            try {
                console.log(`[useForkChat] Forking chat: ${chatId}, excluded messages:`, excludedMessageIds);

                const response = await api.request(`/api/chats/${chatId}/fork`, {
                    method: 'POST',
                    body: { excludedMessageIds }
                });

                const data = await response.json();

                if (!response.ok) {
                    console.error(`[useForkChat] Server error:`, data);
                    throw new Error(data.error || `Failed to fork chat (${response.status})`);
                }

                console.log(`[useForkChat] Forked chat response:`, data);
                return data.data;
            } catch (error) {
                console.error(`[useForkChat] Exception:`, error);
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.chats() });
        },
        onError: commonErrorHandler
    });
};

export const useForkChatFromMessage = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation<Chat, Error, { chatId: string; messageId: string; excludedMessageIds: string[] }>({
        mutationFn: async ({ chatId, messageId, excludedMessageIds }) => {
            try {
                console.log(`[useForkChatFromMessage] Forking chat ${chatId} from message ${messageId}, excluded:`, excludedMessageIds);

                const response = await api.request(`/api/chats/${chatId}/fork/${messageId}`, {
                    method: 'POST',
                    body: { excludedMessageIds }
                });

                const data = await response.json();

                if (!response.ok) {
                    console.error(`[useForkChatFromMessage] Server error:`, data);
                    throw new Error(data.error || `Failed to fork chat from message (${response.status})`);
                }

                console.log(`[useForkChatFromMessage] Forked chat response:`, data);
                return data.data;
            } catch (error) {
                console.error(`[useForkChatFromMessage] Exception:`, error);
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.chats() });
        },
        onError: commonErrorHandler
    });
};

export const useDeleteChat = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<void, Error, string>({
        mutationFn: (chatId: string) => deleteChat(api, chatId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.chats() });
        },
        onError: commonErrorHandler
    });
};

export const useUpdateChat = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<Chat, Error, { chatId: string; input: UpdateChatInput }>({
        mutationFn: ({ chatId, input }) => updateChat(api, chatId, input),
        onSuccess: (_, { chatId }) => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.chats() });
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.chat(chatId) });
        },
        onError: commonErrorHandler
    });
};

export const useDeleteMessage = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<void, Error, string>({
        mutationFn: (messageId: string) => deleteMessage(api, messageId),
        onSuccess: () => {
            // Invalidate all message queries
            queryClient.invalidateQueries({
                queryKey: CHAT_KEYS.all,
            });
        },
        onError: commonErrorHandler
    });
};

// Add new function to fetch models using unified endpoint
async function getModels(
    api: ReturnType<typeof useApi>['api'],
    provider: APIProviders
): Promise<ModelsResponse> {
    try {
        console.log(`[getModels] Fetching models for provider: ${provider}`);
        const response = await api.request(`/api/models?provider=${provider}`);

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`[getModels] Error fetching models:`, errorData);
            throw new Error(errorData.error || `Failed to fetch ${provider} models (${response.status})`);
        }

        const data = await response.json();
        console.log(`[getModels] Received models data:`, data);

        // Handle different response formats:
        // 1. New Hono format: { success: true, models: [...] }
        // 2. Original format: { data: [...] }
        // 3. Direct array: [...]

        if (data.success && Array.isArray(data.models)) {
            return { data: data.models };
        } else if (data.data && Array.isArray(data.data)) {
            return { data: data.data };
        } else if (Array.isArray(data)) {
            return { data };
        }

        console.warn(`[getModels] Unexpected response format:`, data);
        return { data: [] };
    } catch (error) {
        console.error(`[getModels] Exception:`, error);
        throw error;
    }
}

// Add new hook to fetch models
export const useGetModels = (provider: APIProviders) => {
    const { api } = useApi();
    return useQuery({
        queryKey: CHAT_KEYS.models(provider),
        queryFn: () => getModels(api, provider),
        enabled: !!provider,
    });
};