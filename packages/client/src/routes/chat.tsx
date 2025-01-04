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
import { ChatShortcutsPalette } from '@/components/shortcuts-palette'
import { LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/chat')({
  component: ChatPage,
  validateSearch: (search) => ({
    prefill: Boolean(search.prefill)
  })
})

function ChatPage() {
  const modelControl = useChatModelControl()
  const chatControl = useChatControl()
  const [isLinkedContentOpen, setIsLinkedContentOpen] = useState(false)

  const {
    activeChatTabState,
    handleSendMessage,
    handleForkChat,
    updateActiveChatTab
  } = chatControl

  const currentChat = activeChatTabState
  const newMessage = activeChatTabState?.input ?? ''

  // The id of the linked project tab
  const linkedProjectTabId = currentChat?.linkedProjectTabId || ''

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

          {/* 
            Wrap your chat input area in a relative container 
            and include your new ChatShortcutsPalette above it.
          */}
          <div className="relative mx-2 mb-2">
            {/* <ChatShortcutsPalette>
              <Button size="sm" onClick={() => setIsLinkedContentOpen(!isLinkedContentOpen)}
            variant={isLinkedContentOpen ? 'outline' : 'default'}
              ><LinkIcon className="w-4 h-4" /> Use Linked Content</Button>

            </ChatShortcutsPalette> */}

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