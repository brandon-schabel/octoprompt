import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatMessages } from "@/components/chat/chat-messages";
import { AdaptiveChatInput } from "@/components/adaptive-chat-input";
import { ChatHeader } from "@/components/chat/chat-header";

import { ChatTabManager } from "@/components/tab-managers/chat-tab-manager";
import { ChatProjectSidebar } from "@/components/chat/chat-project-sidebar";
import { InfoTooltip } from "@/components/info-tooltip";

import {
  useCreateChatTab,
  useUpdateActiveChatTab,
} from "@/zustand/updaters";
import {
  useActiveChatTab,
  useAllChatTabs,
} from "@/zustand/selectors";
import { useSendChatMessage, useChatMessages } from "@/components/chat/hooks/chat-hooks";
import { APIProviders, DEFAULT_MODEL_CONFIGS } from "shared/index";
import { useChatModelParams } from "@/components/chat/hooks/use-chat-model-params";


export const Route = createFileRoute("/chat")({
  component: ChatPage,
  validateSearch: (search) => ({
    prefill: Boolean(search.prefill),
  }),
});


const defaultModelConfigs = DEFAULT_MODEL_CONFIGS['default']

function ChatPage() {
  // Global state to check if user has any chat tabs at all
  const { id: activeTabId, tabData: activeChatTabState } = useActiveChatTab();
  const createChatTab = useCreateChatTab();
  const tabs = useAllChatTabs();
  const noChatTabsYet = Object.keys(tabs ?? {}).length === 0;
  const isDefaultTab = activeTabId === "defaultTab";

  const currentChat = activeChatTabState;
  const newMessage = activeChatTabState?.input ?? "";
  const chatId = currentChat?.activeChatId ?? "";

  const { settings: modelSettings } = useChatModelParams();

  // Get messages and pending state management
  const {
    messages,
    pendingMessages,
    setPendingMessages,
    refetchMessages,
    isFetching,
  } = useChatMessages(chatId);

  // Initialize send message hook with proper state management
  const { handleSendMessage } = useSendChatMessage({
    chatId,
    provider: activeChatTabState?.provider as APIProviders ?? defaultModelConfigs.provider,
    model: activeChatTabState?.model ?? defaultModelConfigs.model,
    excludedMessageIds: activeChatTabState?.excludedMessageIds ?? [],
    clearUserInput: () => updateActiveChatTab({ input: "" }),
    pendingMessages,
    setPendingMessages,
    refetchMessages,
  });

  const updateActiveChatTab = useUpdateActiveChatTab();

  // The id of the linked project tab (if any)
  const linkedProjectTabId = currentChat?.linkedProjectTabId || "";

  if (noChatTabsYet) {
    return (
      <div className="p-4">
        <ChatTabManager />
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            You haven't started any chat sessions yet. You can chat with local
            LLMs immediately, but if you add OpenAI or OpenRouter keys on the{" "}
            <strong>Keys</strong> page, you'll unlock extra features like
            summarization, advanced file suggestions, and generated ticket task creation.
          </p>
          <InfoTooltip>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Why add provider keys?</strong>
              </p>
              <ul className="list-disc list-inside">
                <li>Advanced AI completions</li>
                <li>Project summarizations and ticket creation from chat</li>
              </ul>
            </div>
          </InfoTooltip>

          <Button onClick={() => createChatTab({ cleanTab: true })}>
            + Start a Chat
          </Button>
        </div>
      </div>
    );
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
            <h2 className="text-2xl font-bold text-center">
              Welcome to Your Default Chat Tab!
            </h2>
            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <p className="text-center text-muted-foreground">
                This is your default chat tab. You can:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Start chatting right away using the input below</li>
                <li>Create new tabs for different conversations</li>
                <li>Link chats to your projects for context-aware assistance</li>
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
              onSubmit={() => {
                // Example call to a direct "send message" approach:
                console.log("[DefaultTab] Send message: ", newMessage);
              }}
              placeholder="Type your message..."
              disabled={!currentChat}
              className="w-full"
              preserveFormatting
            />
            <Button onClick={() => console.log("Sending message...")} disabled={!currentChat}>
              Send
            </Button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSendWithDebug() {
    // If you had your `handleSendMessage` from `useSendMessageHook`, you could call it here:
    await handleSendMessage({
      userInput: newMessage,
      modelSettings,
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ChatTabManager />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <ChatSidebar />

        {/* Main Chat Area - Modified structure */}
        <div className="flex-1 flex flex-col min-h-0"> {/* Added min-h-0 to ensure proper flex behavior */}
          {currentChat && (
            <>
              {/* Header is now outside the scrollable area */}
              <div className="flex-shrink-0"> {/* Added flex-shrink-0 to prevent header from shrinking */}
                <ChatHeader
                  chatId={chatId}
                  excludedMessageIds={currentChat?.excludedMessageIds ?? []}
                />
              </div>

              {/* Messages container with flex-1 and overflow handling */}
              <div className="flex-1 min-h-0 overflow-hidden"> {/* Added min-h-0 and overflow-hidden */}
                <ChatMessages
                  messages={messages}
                  isFetching={isFetching}
                  excludedMessageIds={currentChat?.excludedMessageIds ?? []}
                />
              </div>
            </>
          )}

          {/* Input area is also outside the scrollable region */}
          <div className="flex-shrink-0 relative mx-2 mb-2"> {/* Added flex-shrink-0 */}
            <div className="flex gap-2 bg-background rounded-md">
              <AdaptiveChatInput
                value={newMessage}
                onChange={(val) => updateActiveChatTab({ input: val })}
                onSubmit={handleSendWithDebug}
                placeholder="Type your message..."
                disabled={!currentChat}
                className="w-full"
                preserveFormatting
              />
              <Button onClick={handleSendWithDebug} disabled={!currentChat}>
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
  );
}