import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChatSidebar } from '@/components/chat/chat-sidebar'
import { ChatMessages } from '@/components/chat/chat-messages'
import { ChatHeader } from '@/components/chat/chat-header'
import { AdaptiveChatInput } from '@/components/adaptive-chat-input'
import { useChatControl } from '@/components/chat/hooks/use-chat-state'
import { useChatModelControl } from '@/components/chat/hooks/use-chat-model-control'
import { ChatTabManager } from '@/components/tab-managers/chat-tab-manager'
import { ChatProjectSidebar } from '@/components/chat/chat-project-sidebar'
import { InfoTooltip } from '@/components/info-tooltip'
import { useCreateChatTab } from '@/components/global-state/global-helper-hooks'
import { useActiveChatTab, useAllChatTabs } from '@/components/global-state/websocket-selector-hoooks'

export const Route = createFileRoute('/chat')({
  component: ChatPage,
  validateSearch: (search) => ({
    prefill: Boolean(search.prefill)
  })
})

function ChatPage() {
  // Global state to check if user has any chat tabs at all
  const { id: activeTabId } = useActiveChatTab()
  const createChatTab = useCreateChatTab()
  const tabs = useAllChatTabs()
  const noChatTabsYet = Object.keys(tabs ?? {}).length === 0
  const isDefaultTab = activeTabId === 'defaultTab'

  // Basic model & chat control
  const modelControl = useChatModelControl()
  const chatControl = useChatControl()

  const {
    activeChatTabState,
    handleSendMessage,
    handleForkChat,
    updateActiveChatTab
  } = chatControl

  const currentChat = activeChatTabState
  const newMessage = activeChatTabState?.input ?? ''

  // The id of the linked project tab (if any)
  const linkedProjectTabId = currentChat?.linkedProjectTabId || ''

  // -----------------------------------------------
  // EMPTY STATE: brand new user with no chat tabs
  // -----------------------------------------------
  if (noChatTabsYet) {
    return (
      <div className="p-4">
        <ChatTabManager />
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            You haven't started any chat sessions yet. You can chat with local LLMs immediately,
            but if you add OpenAI or OpenRouter keys on the <strong>Keys</strong> page,
            you'll unlock extra features like summarization, advanced file suggestions,
            and voice input (using Whisper).
          </p>
          <InfoTooltip>
            <div className="space-y-2 text-sm">
              <p><strong>Why add provider keys?</strong></p>
              <ul className="list-disc list-inside">
                <li>Advanced AI completions</li>
                <li>Project summarizations and ticket creation from chat</li>
                <li>Voice interactions with Whisper</li>
              </ul>
            </div>
          </InfoTooltip>

          <Button onClick={() => createChatTab({ cleanTab: true })}>
            + Start a Chat
          </Button>
        </div>
      </div>
    )
  }

  // -----------------------------------------------
  // DEFAULT TAB: Show welcome message
  // -----------------------------------------------
  if (isDefaultTab && (!currentChat?.messages || currentChat.messages.length === 0)) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <ChatTabManager />
        <div className="flex-1 p-4">
          <div className="max-w-2xl mx-auto mt-8 space-y-6">
            <h2 className="text-2xl font-bold text-center">Welcome to Your Default Chat Tab!</h2>
            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <p className="text-center text-muted-foreground">
                This is your default chat tab. You can:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Start chatting right away using the input below</li>
                <li>Create new tabs for different conversations</li>
                <li>Link chats to your projects for context-aware assistance</li>
                <li>Use voice input with Whisper (requires OpenAI key)</li>
              </ul>
              <div className="flex justify-center mt-4">
                <Button onClick={() => createChatTab({ cleanTab: true })} variant="outline">
                  Create New Chat Tab
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="relative mx-2 mb-2">
          <div className="flex gap-2 bg-background rounded-md">
            <AdaptiveChatInput
              value={newMessage}
              onChange={(val) => updateActiveChatTab({ input: val })}
              onSubmit={handleSendMessage}
              placeholder="Type your message..."
              disabled={!currentChat}
              className="w-full"
              preserveFormatting={true}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!currentChat}
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ChatTabManager />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <ChatSidebar />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatHeader
            onForkChat={handleForkChat}
            chatControl={chatControl}
            modelControl={modelControl}
          />

          {currentChat && (
            <ChatMessages chatControl={chatControl} />
          )}

          <div className="relative mx-2 mb-2">
            <div className="flex gap-2 bg-background rounded-md">
              <AdaptiveChatInput
                value={newMessage}
                onChange={(val) => updateActiveChatTab({ input: val })}
                onSubmit={handleSendMessage}
                placeholder="Type your message..."
                disabled={!currentChat}
                className="w-full"
                preserveFormatting={true}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!currentChat}
              >
                Send
              </Button>
            </div>
          </div>
        </div>

        {/* Right Sidebar - only if there's a linked project */}
        {linkedProjectTabId && (
          <ChatProjectSidebar linkedProjectTabId={linkedProjectTabId} />
        )}
      </div>
    </div>
  )
}