import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../use-api';
import { CreateChatBody,Chat, ChatMessage } from 'shared'
import { APIProviders, CreateMessageBodyGeneric, UnifiedModel } from 'shared/src/validation/chat-api-validation';


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
const CHAT_KEYS = {
    all: ['chat'] as const,
    chats: () => [...CHAT_KEYS.all, 'chats'] as const,
    chat: (id: string) => [...CHAT_KEYS.chats(), id] as const,
    messages: (chatId: string) => [...CHAT_KEYS.chat(chatId), 'messages'] as const,
    whisperTranscription: () => [...CHAT_KEYS.all, 'whisper-transcription'] as const,
    models: (provider: APIProviders) => [...CHAT_KEYS.all, 'models', provider] as const,
};

async function getChats(api: ReturnType<typeof useApi>['api']): Promise<{ data: Chat[] }> {
    const response = await api.request('/api/ai/chats');
    return response.json();
}

async function getMessages(api: ReturnType<typeof useApi>['api'], chatId: string): Promise<{ data: ChatMessage[] }> {
    const response = await api.request(`/api/ai/chats/${chatId}/messages`);
    return response.json();
}

async function sendMessage<T extends APIProviders>(
    api: ReturnType<typeof useApi>['api'],
    input: SendMessageInput<T>
): Promise<ReadableStream<Uint8Array>> {
    const response = await api.request('/api/ai/chat', {
        method: 'POST',
        body: input
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
    }
    return response.body as ReadableStream<Uint8Array>;
}


async function deleteChat(api: ReturnType<typeof useApi>['api'], chatId: string): Promise<void> {
    const response = await api.request(`/api/ai/chats/${chatId}`, { method: 'DELETE' });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete chat');
    }
}

async function updateChat(api: ReturnType<typeof useApi>['api'], chatId: string, input: UpdateChatInput): Promise<Chat> {
    const response = await api.request(`/api/ai/chats/${chatId}`, {
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


// Add these types near the other type definitions
type WhisperTranscriptionResponse = {
    transcript: string;
    error?: string;
}

type WhisperTranscriptionOptions = {
    prompt?: string;
    language?: string;
    temperature?: number;
    response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
}

// Update the transcribeAudio function
async function transcribeAudio(
    api: ReturnType<typeof useApi>['api'],
    formData: FormData,
    options?: WhisperTranscriptionOptions
): Promise<WhisperTranscriptionResponse> {
    // Add options to formData if provided
    if (options) {
        Object.entries(options).forEach(([key, value]) => {
            if (value !== undefined) {
                formData.append(key, value.toString());
            }
        });
    }

    const response = await api.request('/api/ai/whisper-stream', {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to transcribe audio');
    }

    const result = await response.json();

    if (!result.transcript) {
        throw new Error('No transcript found in response');
    }

    return result;
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

    return useMutation<Chat, Error, CreateChatBody>({
        mutationFn: async (input: CreateChatBody) => {
            const response = await api.request('/api/ai/chats', {
                method: 'POST',
                body: input,

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
    });
};


export const useForkChat = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation<Chat, Error, { chatId: string; excludedMessageIds: string[] }>({
        mutationFn: async ({ chatId, excludedMessageIds }) => {
            const response = await api.request(`/api/ai/chats/${chatId}/fork`, {
                method: 'POST',
                body: { excludedMessageIds }
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fork chat');
            }
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.chats() });
        },
    });
};

export const useForkChatFromMessage = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation<Chat, Error, { chatId: string; messageId: string; excludedMessageIds: string[] }>({
        mutationFn: async ({ chatId, messageId, excludedMessageIds }) => {
            const response = await api.request(`/api/ai/chats/${chatId}/fork/${messageId}`, {
                method: 'POST',
                body: { excludedMessageIds }
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fork chat from message');
            }
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.chats() });
        },
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
    });
};

export const useDeleteMessage = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<void, Error, string>({
        mutationFn: (messageId: string) => deleteMessage(api, messageId),
        onSuccess: (_) => {
            // Invalidate all message queries since we don't know which chat this belonged to
            queryClient.invalidateQueries({
                predicate: (query) => query.queryKey[0] === 'chat' && query.queryKey[2] === 'messages'
            });
        },
    });
};

// Update the useWhisperTranscribe hook
export const useWhisperTranscribe = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<
        WhisperTranscriptionResponse,
        Error,
        { audio: File | Blob; options?: WhisperTranscriptionOptions }
    >({
        mutationFn: async ({ audio, options }) => {
            const formData = new FormData();
            formData.append('audio', audio);
            return transcribeAudio(api, formData, options);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.whisperTranscription() });
        },
    });
};

// Add new function to fetch models using unified endpoint
async function getModels(
    api: ReturnType<typeof useApi>['api'],
    provider: APIProviders
): Promise<ModelsResponse> {
    const response = await api.request(`/api/models?provider=${provider}`);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to fetch ${provider} models`);
    }
    return response.json();
}

// Add new hook to fetch models
export const useGetModels = (provider: APIProviders) => {
    const { api } = useApi();

    return useQuery({
        queryKey: CHAT_KEYS.models(provider),
        queryFn: () => getModels(api, provider),
        // staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });
};
