import { useCallback, useEffect } from 'react';
import { useChat, Message } from '@ai-sdk/react';
import { ChatModelSettings } from 'shared';
import { useGetMessages } from './api/use-chat-api';
import { APIProviders } from 'shared/src/schemas/provider-key.schemas';
import { nanoid } from 'nanoid';

interface UseAIChatProps {
  chatId: string;
  provider: APIProviders | string;
  model: string;
  systemMessage?: string;
}

export function useAIChat({
  chatId,
  provider,
  model,
  systemMessage,
}: UseAIChatProps) {
  // Initialize Vercel AI SDK's useChat hook
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: defaultHandleSubmit,
    isLoading,
    error,
    setMessages,
    append,
    reload,
    stop,
    setInput,
  } = useChat({
    api: '/api/ai/chat',
    id: chatId,
    initialMessages: [],
    onError: (err) => {
      console.error('[useAIChat] Error:', err);
    },
  });

  // Fetch existing messages from the server
  const {
    data: initialMessagesData,
    refetch: refetchMessages,
    isFetching: isFetchingInitialMessages,
    isError: isErrorFetchingInitial,
  } = useGetMessages(chatId);

  // Effect to load initial messages into useChat state
  useEffect(() => {
    if (initialMessagesData?.data && messages.length === 0) {
      const formattedMessages: Message[] = initialMessagesData.data.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
      }));
      setMessages(formattedMessages);
    }
  }, [initialMessagesData, setMessages, messages.length]);

  // Enhanced `sendMessage` function using `append`
  const sendMessage = useCallback(
    async (messageContent: string, options?: ChatModelSettings) => {
      if (!messageContent.trim()) return;

      const userMessageId = nanoid();

      const messageToSend: Message = {
        id: userMessageId,
        role: 'user',
        content: messageContent.trim(),
        createdAt: new Date(),
      };

      const body = {
        provider,
        model,
        ...(options && { options: { 
          model: model,
          temperature: options.temperature,
          maxTokens: options.max_tokens,
          topP: options.top_p,
          frequencyPenalty: options.frequency_penalty,
          presencePenalty: options.presence_penalty,
        } }),
      };

      setInput('');

      await append(messageToSend, { body });
    },
    [append, provider, model, setInput]
  );

  // Create a form handler that uses our `sendMessage`
  const handleFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const currentModelSettings: ChatModelSettings | undefined = undefined;
      sendMessage(input, currentModelSettings);
    },
    [sendMessage, input]
  );

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit: handleFormSubmit,
    isLoading,
    error,
    setInput,
    reload,
    stop,
    append,
    setMessages,
    sendMessage,
    isFetchingInitialMessages,
    isErrorFetchingInitial,
    refetchMessages,
  };
}