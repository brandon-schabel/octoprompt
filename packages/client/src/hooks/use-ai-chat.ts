// packages/client/src/components/chat/hooks/use-ai-chat.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { ChatMessage } from 'shared/schema';
import { APIProviders, ChatModelSettings } from 'shared';
import { useGetMessages } from './api/use-chat-api';

interface UseAIChatProps {
  chatId: string;
  provider: APIProviders;
  model: string;
  excludedMessageIds: string[];
  systemMessage?: string;
}

export function useAIChat({
  chatId,
  provider,
  model,
  excludedMessageIds,
  systemMessage,
}: UseAIChatProps) {
  // Fetch existing messages from the server
  const {
    data: messagesData,
    refetch: refetchMessages,
    isFetching,
  } = useGetMessages(chatId);

  // Reference to track if we should update messages after streaming
  const shouldRefetchAfterStreaming = useRef(false);

  // Track pending messages (those not yet saved to DB)
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([]);

  // Initialize Vercel AI SDK's useChat hook
  const {
    messages: aiMessages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
    append,
    reload,
    stop,
    setInput,
  } = useChat({
    api: '/api/ai/chat', // Your Hono endpoint that uses unifiedProvider.processMessage
    id: chatId, // Use chatId as the conversation ID
    initialMessages: [], // We'll populate this from your API
    body: {
      // Additional data to send with each request
      chatId: chatId,
      provider: provider,
      options: {
        model: model,
      },
      excludedMessageIds: excludedMessageIds,
      systemMessage: systemMessage,
    },
    onFinish: async () => {
      // When streaming finishes, mark for refetch
      shouldRefetchAfterStreaming.current = true;
    },
    onError: (error) => {
      console.error('[useAIChat] Error during chat:', error);
    },
  });

  // Effect to refetch messages after streaming completes
  useEffect(() => {
    if (shouldRefetchAfterStreaming.current && !isLoading) {
      refetchMessages();
      shouldRefetchAfterStreaming.current = false;
    }
  }, [isLoading, refetchMessages]);

  // Effect to sync server messages with AI SDK messages when they change
  useEffect(() => {
    if (messagesData?.data && messagesData.data.length > 0) {
      // Convert from your message format to AI SDK format
      const formattedMessages = messagesData.data.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

      // Set the messages in the AI SDK hook
      setMessages(formattedMessages);
    }
  }, [messagesData?.data, setMessages]);

  // Combine server messages with pending messages
  const allMessages = mergeServerAndPendingMessages(
    messagesData?.data || [],
    pendingMessages
  );

  // Enhanced send message function that works with your existing UI
  const sendMessage = useCallback(
    ({ userInput, modelSettings }: { userInput: string; modelSettings: ChatModelSettings }) => {
      if (!userInput.trim()) return;

      // Generate temp IDs for optimistic updates
      const userTempId = `temp-user-${Date.now()}`;
      const assistantTempId = `temp-assistant-${Date.now()}`;

      // Create optimistic message objects
      const userMessage: ChatMessage = {
        id: userTempId,
        role: 'user',
        content: userInput.trim(),
        chatId,
        createdAt: new Date(),
      };

      const assistantMessage: ChatMessage = {
        id: assistantTempId,
        role: 'assistant',
        content: '',
        chatId,
        createdAt: new Date(),
      };

      // Set pending messages for immediate UI feedback
      setPendingMessages((prev) => [...prev, userMessage, assistantMessage]);

      // Submit the message through AI SDK
      handleSubmit(
        {
          // Temporarily comment out options, will be replaced by append logic
          /*
          options: {
            // Pass the model parameters from your settings
            temperature: modelSettings.temperature,
            max_tokens: modelSettings.max_tokens,
            top_p: modelSettings.top_p,
            frequency_penalty: modelSettings.frequency_penalty,
            presence_penalty: modelSettings.presence_penalty,
          },
          */
          // Add tempId for optimistic updates - Commented out as it causes error now
          // tempId: assistantTempId,
        }
      );

      // Clear input
      setInput('');
    },
    [chatId, handleSubmit, setInput]
  );

  // Helper function to merge server and pending messages
  function mergeServerAndPendingMessages(
    serverMsgs: ChatMessage[],
    pending: ChatMessage[]
  ): ChatMessage[] {
    // Filter out any "temp-*" IDs from the server
    const filteredServer = serverMsgs.filter(
      (msg) => !msg.id.startsWith('temp-')
    );
    // Exclude duplicates from local pending - This logic needs adjustment as tempId is removed
    // For now, just return server + pending until this hook is refactored
    // const pendingWithoutDupes = pending.filter(
    //   (p) => !filteredServer.some((s) => s.tempId === p.tempId) 
    // );
    // return [...filteredServer, ...pendingWithoutDupes];
    return [...filteredServer, ...pending]; // Temporary fix
  }

  // Update pending messages when AI SDK messages update during streaming
  useEffect(() => {
    if (isLoading && aiMessages.length > 0) {
      const latestAiMessage = aiMessages[aiMessages.length - 1];
      if (latestAiMessage.role === 'assistant') {
        setPendingMessages((prev) => {
          const updatedPending = [...prev];
          const pendingAssistantIndex = updatedPending.findIndex(
            (m) => m.role === 'assistant' && m.id.startsWith('temp-')
          );

          if (pendingAssistantIndex !== -1) {
            updatedPending[pendingAssistantIndex] = {
              ...updatedPending[pendingAssistantIndex],
              content: latestAiMessage.content,
            };
          }

          return updatedPending;
        });
      }
    }
  }, [aiMessages, isLoading]);

  // Clear pending messages after streaming completes and messages refetch
  useEffect(() => {
    if (!isLoading && shouldRefetchAfterStreaming.current === false && pendingMessages.length > 0) {
      setPendingMessages([]);
    }
  }, [isLoading, pendingMessages.length]);

  return {
    // Return both the AI SDK state and your application state
    // AI SDK state
    input,
    handleInputChange,
    handleSubmit: sendMessage, // Use our enhanced version
    isLoading,
    error,
    aiMessages,

    // Your application state
    messages: allMessages,
    pendingMessages,
    setPendingMessages,
    refetchMessages,
    isFetching,

    // AI SDK methods
    append,
    reload,
    stop,
    setInput,
  };
}