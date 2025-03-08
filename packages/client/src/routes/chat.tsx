import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ChatSidebar } from '@/components/chat/chat-sidebar'
import { ChatMessages } from '@/components/chat/chat-messages'
import { AdaptiveChatInput } from '@/components/adaptive-chat-input'
import { ChatHeader } from '@/components/chat/chat-header'

import { ChatTabManager } from '@/components/tab-managers/chat-tab-manager'
import { ChatProjectSidebar } from '@/components/chat/chat-project-sidebar'
import { InfoTooltip } from '@/components/info-tooltip'

import { useCreateChatTab, useUpdateActiveChatTab } from '@/zustand/updaters'
import { useActiveChatTab, useAllChatTabs } from '@/zustand/selectors'
import { useSendChatMessage, useChatMessages } from '@/components/chat/hooks/chat-hooks'
import { APIProviders, DEFAULT_MODEL_CONFIGS } from 'shared/index'
import { useChatModelParams } from '@/components/chat/hooks/use-chat-model-params'
import { useState, useEffect, useRef } from 'react'

const defaultModelConfigs = DEFAULT_MODEL_CONFIGS['default']

// Define the component first before exporting it
function ChatPage() {
  // Global state
  const { id: activeTabId, tabData: activeChatTabState } = useActiveChatTab()
  const createChatTab = useCreateChatTab()
  const tabs = useAllChatTabs()
  const noChatTabsYet = Object.keys(tabs ?? {}).length === 0
  const isDefaultTab = activeTabId === 'defaultTab'

  const currentChat = activeChatTabState
  const newMessage = activeChatTabState?.input ?? ''
  const chatId = currentChat?.activeChatId ?? ''

  const updateActiveChatTab = useUpdateActiveChatTab()

  // Add local state to ensure input changes are tracked immediately
  const [localMessage, setLocalMessage] = useState(newMessage)
  
  // Use a ref to track if local changes are in progress to avoid circular updates
  const isLocalUpdateRef = useRef(false)

  // Sync global -> local, but only when not in the middle of a local update
  useEffect(() => {
    if (!isLocalUpdateRef.current && newMessage !== localMessage) {
      setLocalMessage(newMessage)
    }
  }, [newMessage])

  // Ensure there's an active chat ID
  useEffect(() => {
    if (currentChat && !chatId && Object.keys(tabs ?? {}).length > 0) {
      const createChatMutation = async () => {
        try {
          const newChatId = `chat-${Date.now()}`
          updateActiveChatTab({ activeChatId: newChatId })
        } catch (error) {
          console.error('[ChatPage] Failed to create chat:', error)
        }
      }
      createChatMutation()
    }
  }, [currentChat, chatId, tabs, updateActiveChatTab])

  const { settings: modelSettings } = useChatModelParams()

  // Get messages and pending state management
  const { messages, pendingMessages, setPendingMessages, refetchMessages, isFetching } = useChatMessages(chatId)

  // Initialize send message hook with proper state management
  const { handleSendMessage } = useSendChatMessage({
    chatId,
    provider: (activeChatTabState?.provider as APIProviders) ?? defaultModelConfigs.provider,
    model: activeChatTabState?.model ?? defaultModelConfigs.model,
    excludedMessageIds: activeChatTabState?.excludedMessageIds ?? [],
    clearUserInput: () => updateActiveChatTab({ input: '' }),
    pendingMessages,
    setPendingMessages,
    refetchMessages
  })

  // The id of the linked project tab (if any)
  const linkedProjectTabId = currentChat?.linkedProjectTabId || ''

  // Check if we have an active chat
  const hasActiveChat = Boolean(chatId)

  // Handle local input changes without immediately updating global state
  const handleInputChange = (val: string) => {
    // Flag that we're doing a local update to prevent the useEffect from
    // immediately overwriting our local value with the global one
    isLocalUpdateRef.current = true
    setLocalMessage(val)
    isLocalUpdateRef.current = false
  }

  // Handle submit - this is where we update the global state
  const handleSubmit = async () => {
    if (!chatId || !localMessage?.trim()) return;
    
    try {
      // Update global state with current local state
      updateActiveChatTab({ input: localMessage })
      
      // Send the message
      await handleSendMessage({
        userInput: localMessage,
        modelSettings
      })
      
      // Clear local message state after sending
      setLocalMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  if (noChatTabsYet) {
    return (
      <div className='p-4'>
        <ChatTabManager />
        <div className='mt-4 flex flex-col items-start gap-3'>
          <p className='text-sm text-muted-foreground'>
            You haven't started any chat sessions yet. You can chat with local LLMs immediately, but if you add OpenAI
            or OpenRouter keys on the <strong>Keys</strong> page, you'll unlock extra features like summarization,
            advanced file suggestions, and generated ticket task creation.
          </p>
          <InfoTooltip>
            <div className='space-y-2 text-sm'>
              <p>
                <strong>Why add provider keys?</strong>
              </p>
              <ul className='list-disc list-inside'>
                <li>Advanced AI completions</li>
                <li>Project summarizations and ticket creation from chat</li>
              </ul>
            </div>
          </InfoTooltip>

          <Button onClick={() => createChatTab({ cleanTab: true })}>+ Start a Chat</Button>
        </div>
      </div>
    )
  }

  // -----------------------------------------------
  // DEFAULT TAB: Show welcome message
  // -----------------------------------------------
  if (isDefaultTab && (!currentChat?.messages || currentChat.messages.length === 0)) {
    return (
      <div className='flex flex-col h-full overflow-hidden'>
        <ChatTabManager />
        <div className='flex-1 p-4'>
          <div className='max-w-2xl mx-auto mt-8 space-y-6'>
            <h2 className='text-2xl font-bold text-center'>Welcome to Your Default Chat Tab!</h2>
            <div className='bg-muted/50 rounded-lg p-6 space-y-4'>
              <p className='text-center text-muted-foreground'>This is your default chat tab. You can:</p>
              <ul className='list-disc list-inside space-y-2 text-muted-foreground'>
                <li>Start chatting right away using the input below</li>
                <li>Create new tabs for different conversations</li>
                <li>Link chats to your projects for context-aware assistance</li>
              </ul>
              <div className='flex justify-center mt-4'>
                <Button onClick={() => createChatTab({ cleanTab: true })} variant='outline'>
                  Create New Chat Tab
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className='relative mx-2 mb-2'>
          <div className='flex gap-2 bg-background rounded-md'>
            <AdaptiveChatInput
              value={localMessage}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              placeholder='Type a message...'
            />
            <Button
              size='sm'
              onClick={handleSubmit}
              disabled={!currentChat || !localMessage?.trim()}
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='flex flex-col h-full overflow-hidden'>
      <ChatTabManager />

      <div className='flex flex-1 overflow-hidden'>
        {/* Left Sidebar */}
        <ChatSidebar />

        {/* Main Chat Area */}
        <div className='flex-1 flex flex-col min-h-0'>
          {hasActiveChat ? (
            <>
              {/* Header */}
              <div className='flex-shrink-0'>
                <ChatHeader chatId={chatId} excludedMessageIds={currentChat?.excludedMessageIds ?? []} />
              </div>

              {/* Messages container */}
              <div className='flex-1 min-h-0 overflow-hidden'>
                <ChatMessages
                  messages={messages}
                  isFetching={isFetching}
                  excludedMessageIds={currentChat?.excludedMessageIds ?? []}
                />
              </div>
            </>
          ) : (
            // No chat selected state
            <div className='flex-1 flex items-center justify-center'>
              <div className='text-center space-y-4'>
                <h2 className='text-2xl font-semibold text-muted-foreground'>No Chat Selected</h2>
                <p className='text-sm text-muted-foreground'>
                  Select an existing chat from the sidebar or create a new one to get started.
                </p>
              </div>
            </div>
          )}

          {/* Input area */}
          <div className='relative mx-2 mb-2'>
            <div className='flex gap-2 bg-background rounded-md'>
              <AdaptiveChatInput
                value={localMessage}
                onChange={handleInputChange}
                onSubmit={handleSubmit}
                placeholder='Type a message...'
              />
              <Button
                size='sm'
                onClick={handleSubmit}
                disabled={!currentChat || !localMessage?.trim()}
              >
                Send
              </Button>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Only show if linked to a project */}
        {linkedProjectTabId && <ChatProjectSidebar linkedProjectTabId={linkedProjectTabId} />}
      </div>
    </div>
  )
}

// Now export the route with the component
export const Route = createFileRoute('/chat')({
  component: ChatPage,
  validateSearch: (search) => ({
    prefill: Boolean(search.prefill)
  })
})
