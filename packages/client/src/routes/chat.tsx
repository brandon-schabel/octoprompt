import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ChatSidebar } from '@/components/chat/chat-sidebar'
import { ChatMessages } from '@/components/chat/chat-messages'
import { ChatHeader } from '@/components/chat/chat-header'
import { AdaptiveChatInput } from '@/components/adaptive-chat-input'
import { useNavigate } from "@tanstack/react-router"
import { useChatControl } from '@/components/chat/hooks/use-chat-state'
import { useChatModelControl } from '@/components/chat/hooks/use-chat-model-control'
import { useGlobalStateContext } from '@/components/global-state-context'

export const Route = createFileRoute('/chat')({
  component: ChatPage,
  validateSearch: (search) => ({
    prefill: Boolean(search.prefill)
  })
})

function ChatPage() {
  const { state, activeTabState } = useGlobalStateContext()
  const navigate = useNavigate()
  const selectedProjectId = activeTabState?.selectedProjectId
  const modelControl = useChatModelControl()
  // Custom hook that wraps all logic
  const chatControl = useChatControl()
  const {
    currentChat,
    newMessage,
    setNewMessage,
    handleSendMessage,
    handleForkChat,
  } = chatControl

  // If you have logic for the “Back to Projects” button:
  const handleBackToProject = () => {
    navigate({ to: '/projects' })
  }

  return (
    <div className="h-full">
      <div className="flex h-full">
        <ChatSidebar
          modelControl={modelControl}
          chatControl={chatControl}
        />

        <div className="flex-1 flex flex-col p-2 overflow-hidden bg-secondary">
          {!selectedProjectId && <ChatHeader
            selectedProjectId={selectedProjectId ?? ''}
            onForkChat={handleForkChat}
            onBackToProject={selectedProjectId ? handleBackToProject : undefined}
            chatControl={chatControl}
          />}

          {currentChat && (
            <ChatMessages chatControl={chatControl} />
          )}

          <div className="flex gap-2 bg-background p-2 rounded-md">
            <AdaptiveChatInput
              value={newMessage}
              onChange={setNewMessage}
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
    </div>
  )
}
