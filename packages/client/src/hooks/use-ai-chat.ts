import { useCallback, useEffect } from 'react';
import { useChat, Message } from '@ai-sdk/react';
import type { AiChatStreamRequest, AiSdkOptions, } from './generated';
import { useGetMessages } from './api/use-chat-api';
import { APIProviders } from 'shared/src/schemas/provider-key.schemas';
import { nanoid } from 'nanoid';
import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants';

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
    // Note: We won't use the default handleSubmit directly if we have custom logic
    // handleSubmit: defaultHandleSubmit,
    isLoading,
    error,
    setMessages,
    append,
    reload,
    stop,
    setInput,
  } = useChat({
    api: `${SERVER_HTTP_ENDPOINT}/ai/chat`,
    id: chatId, // Primarily for SDK internal state management
    initialMessages: [], // Load messages via useEffect
    onError: (err) => {
      // Optionally add more user-friendly error handling (e.g., toast notifications)
      console.error('[useAIChat] API Error:', err);
    },
  });

  // Fetch existing messages from the server (seems correct)
  const {
    data: initialMessagesData,
    refetch: refetchMessages,
    isFetching: isFetchingInitialMessages,
    isError: isErrorFetchingInitial,
  } = useGetMessages(chatId);

  // Effect to load initial messages into useChat state (seems correct)
  useEffect(() => {
    if (initialMessagesData?.data && messages.length === 0 && !isFetchingInitialMessages) {
      const formattedMessages: Message[] = initialMessagesData.data.map(msg => ({
        id: msg.id,
        // Ensure role mapping handles potential future roles if schema changes
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(), // Handle potential date parsing issues
      }));
      // Prevent infinite loops by checking if messages are truly different if needed
      setMessages(formattedMessages);
    }
    // Add isFetchingInitialMessages to dependencies to avoid setting messages while fetching
  }, [initialMessagesData, setMessages, messages.length, isFetchingInitialMessages]);


  // Enhanced `sendMessage` function using `append`
  const sendMessage = useCallback(
    async (messageContent: string, modelSettings?: AiSdkOptions) => {
      if (!messageContent.trim()) return;

      const userMessageId = nanoid(); // Used for optimistic UI and maybe tempId

      // 1. Prepare the message object for the useChat hook's state
      const messageForSdkState: Message = {
        id: userMessageId,
        role: 'user',
        content: messageContent.trim(),
        createdAt: new Date(),
      };

      // 2. Map frontend ChatModelSettings (snake_case) to backend AiSdkOptions (camelCase)
      let sdkOptions: AiSdkOptions | undefined = undefined;
      if (modelSettings) {
        sdkOptions = {
          // Only include fields if they have a value
          ...(modelSettings.temperature !== undefined && { temperature: modelSettings.temperature }),
          ...(modelSettings.maxTokens !== undefined && { maxTokens: modelSettings.maxTokens }),
          ...(modelSettings.topP !== undefined && { topP: modelSettings.topP }),
          ...(modelSettings.frequencyPenalty !== undefined && { frequencyPenalty: modelSettings.frequencyPenalty }),
          ...(modelSettings.presencePenalty !== undefined && { presencePenalty: modelSettings.presencePenalty }),
          ...(modelSettings.provider !== undefined && { provider: modelSettings.provider }),
          ...(modelSettings.model !== undefined && { model: modelSettings.model }),
          // Add mappings for top_k etc. if needed
        };
      }

      // 3. Construct the request body EXACTLY matching AiChatStreamRequestSchema
      //    Use the imported type for compile-time checks!
      const requestBody: AiChatStreamRequest = {
        chatId: chatId,                     // REQUIRED: Get from hook props
        userMessage: messageContent.trim(), // REQUIRED: The actual user message
        // Optional fields:
        tempId: userMessageId,            // Optional: Useful for correlating requests/responses
        ...(systemMessage && { systemMessage: systemMessage }), // Include systemMessage from props if provided
        // options: sdkOptions,
        ...(sdkOptions ? { options: sdkOptions } : {}),
      };

      setInput(''); // Clear input field immediately

      // 4. Call append:
      //    - First argument: The message object to add optimistically to the UI state.
      //    - Second argument: Options object containing the `body` to send to the API.
      await append(messageForSdkState, { body: requestBody });
    },
    // Dependencies: Ensure all values used inside useCallback are listed
    [append, chatId, provider, model, systemMessage, setInput]
  );

  // Create a form handler that uses our enhanced `sendMessage`
  const handleFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // TODO: Get currentModelSettings from your UI state if applicable
      const currentModelSettings: AiSdkOptions | undefined = undefined; // Replace with actual settings if you have them
      sendMessage(input, currentModelSettings);
    },
    [sendMessage, input]
  );

  // Return values needed by the UI
  return {
    messages,
    input,
    handleInputChange,
    handleSubmit: handleFormSubmit, // Use the custom submit handler
    isLoading,
    error,
    setInput,
    reload, // Useful for retrying the last exchange
    stop,   // Useful for stopping the stream
    // append, // Usually not needed directly by the UI if using sendMessage
    // setMessages, // Usually only needed for initial load or manual manipulation
    sendMessage, // Expose the custom sending function
    isFetchingInitialMessages,
    isErrorFetchingInitial,
    refetchMessages, // Allow UI to trigger a refetch of history
  };
}