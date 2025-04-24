import { useState, useEffect } from 'react'

import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ChatSidebar } from '@/components/chat/chat-sidebar'
import { ChatMessages } from '@/components/chat/chat-messages'
import { AdaptiveChatInput } from '@/components/adaptive-chat-input'
import { ChatHeader } from '@/components/chat/chat-header'

import { useChatWithAI } from "@/components/chat/hooks/chat-hooks";
import { DEFAULT_MODEL_CONFIGS } from "shared/index";
import { v4 as uuidv4 } from 'uuid'
import { useActiveChatId } from '@/hooks/api/use-state-api'

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  validateSearch: (search) => ({
    prefill: Boolean(search.prefill),
  }),
});

const defaultModelConfigs = DEFAULT_MODEL_CONFIGS['default']

function ChatPage() {
  // Get active chat from Zustand
  const [activeChatId, setActiveChat] = useActiveChatId();
  // const setActiveChat = useSetActiveChat();

  // Add local state to ensure input changes are tracked immediately
  const [localMessage, setLocalMessage] = useState('')

  // Use our enhanced AI chat hook
  const {
    messages,
    handleSendMessage,
    isFetching,
    isLoading,
  } = useChatWithAI({
    chatId: activeChatId || '',
    excludedMessageIds: [],
    clearUserInput: () => setLocalMessage(''),
  });

  // Ensure there's an active chat ID
  useEffect(() => {
    if (!activeChatId) {
      const newChatId = `chat-${uuidv4()}`
      setActiveChat(newChatId)
    }
  }, [activeChatId, setActiveChat])

  // Check if we have an active chat
  const hasActiveChat = Boolean(activeChatId)

  // Handle local input changes
  const handleInputChange = (val: string) => {
    setLocalMessage(val)
  }

  // Handle submit - this is where we send the message
  const handleSubmit = async () => {
    if (!activeChatId || !localMessage?.trim()) return;

    try {
      // Send the message using local state
      await handleSendMessage({
        userInput: localMessage,
      })

      // Clear local message state after sending
      setLocalMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  // Main chat view
  return (
    <div className='flex flex-col h-full overflow-hidden'>
      <div className='flex flex-1 overflow-hidden'>
        {/* Left Sidebar (Assuming this lists different chat sessions now) */}
        <ChatSidebar />

        {/* Main Chat Area */}
        <div className='flex-1 flex flex-col min-h-0'>
          {hasActiveChat ? (
            <>
              {/* Header */}
              <div className='flex-shrink-0'>
                <ChatHeader />
              </div>

              {/* Messages container */}
              <div className='flex-1 min-h-0 overflow-hidden'>
                <ChatMessages
                  messages={messages}
                  isFetching={isFetching}
                  excludedMessageIds={[]}
                />
              </div>
            </>
          ) : (
            // No chat selected state or initial state
            <div className='flex-1 flex items-center justify-center'>
              <div className='text-center space-y-4'>
                <h2 className='text-2xl font-semibold text-muted-foreground'>No Chat Selected</h2>
                <p className='text-sm text-muted-foreground'>
                  Select an existing chat from the sidebar or create a new one to get started.
                </p>
                <Button onClick={() => {
                  const newChatId = `chat-${uuidv4()}`;
                  setActiveChat(newChatId);
                }}>+ Start a Chat</Button>
              </div>
            </div>
          )}

          {/* Input area */}
          {hasActiveChat && (
            <div className='relative mx-2 mb-2'>
              <div className='flex gap-2 bg-background rounded-md'>
                <AdaptiveChatInput
                  value={localMessage}
                  onChange={handleInputChange}
                  onSubmit={handleSubmit}
                  placeholder="Type your message..."
                  disabled={!activeChatId || isLoading}
                  className="w-full"
                  preserveFormatting
                />
                <Button
                  onClick={() => {
                    try {
                      if (!localMessage.trim()) {
                        console.warn("[Send Button] Empty message, not sending");
                        return;
                      }

                      if (!activeChatId) {
                        console.error("[Send Button] No chatId available");
                        return;
                      }

                      handleSendMessage({
                        userInput: localMessage,
                      });
                    } catch (error) {
                      console.error("[Send Button] Error:", error);
                    }
                  }}
                  disabled={!activeChatId || !localMessage?.trim() || isLoading}>
                  {isLoading ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

