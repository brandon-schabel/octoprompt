import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { AdaptiveChatInput } from '@/components/adaptive-chat-input'
import { useAIChat } from '@/hooks/use-ai-chat'
import { useChatModelParams } from '@/components/chat/hooks/use-chat-model-params'
import { useActiveChatId } from '@/hooks/api/use-state-api'
import { nanoid } from 'nanoid'
import { SlidingSidebar } from '@/components/sliding-sidebar'
import { Input } from '@/components/ui/input'
import { useGetChats, useDeleteChat, useUpdateChat, useCreateChat } from '@/hooks/api/use-chat-api'
import { Chat } from '@/hooks/generated'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@radix-ui/react-scroll-area'
import { MessageSquareIcon, PlusIcon, Check, X, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Copy, GitFork, Trash } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useCopyClipboard } from "@/hooks/utility-hooks/use-copy-clipboard";
import { useDeleteMessage, useForkChatFromMessage } from "@/hooks/api/use-chat-api";
import { Message } from "@ai-sdk/react";
import { useSettings } from "@/hooks/api/global-state/selectors";
import { Card } from '@/components/ui/card'
import { Switch } from '@radix-ui/react-switch'
import { ModelSelector } from '@/components/chat/chat-components/model-selector'
import { ModelSettingsPopover } from '@/components/chat/chat-components/model-settings-popover'
import { APIProviders } from 'shared/src/schemas/provider-key.schemas'
import { useChatModelControl } from '@/components/chat/hooks/use-chat-model-control'

function parseThinkBlock(content: string) {
  if (!content.startsWith("<think>")) {
    return {
      hasThinkBlock: false,
      isThinking: false,
      thinkContent: "",
      mainContent: content,
    };
  }

  const endIndex = content.indexOf("</think>");
  if (endIndex === -1) {
    // No closing tag -> the assistant is "thinking," only partial content is shown
    const thinkContent = content.slice("<think>".length);
    return {
      hasThinkBlock: true,
      isThinking: true,
      thinkContent,
      mainContent: "",
    };
  }

  // Found a complete <think>...</think> block
  const thinkContent = content.slice("<think>".length, endIndex);
  const mainContent = content.slice(endIndex + "</think>".length);

  return {
    hasThinkBlock: true,
    isThinking: false,
    thinkContent,
    mainContent,
  };
}

function ChatMessageItem(props: {
  msg: Message;
  excluded: boolean;
  rawView: boolean;
  onCopyMessage: () => void;
  onForkMessage: () => void;
  onDeleteMessage: () => void;
  onToggleExclude: () => void;
  onToggleRawView: () => void;
  copyToClipboard: (text: string) => void;
}) {
  const {
    msg,
    excluded,
    rawView,
    onCopyMessage,
    onForkMessage,
    onDeleteMessage,
    onToggleExclude,
    onToggleRawView,
    copyToClipboard,
  } = props;

  const isUser = msg.role === "user";

  // If "Raw View" is on, show raw text in a <pre> block and skip Markdown
  if (rawView) {
    return (
      <div
        className={`relative rounded-lg p-3 ${isUser ? "bg-muted" : "bg-muted/50"
          } ${excluded ? "opacity-50" : ""}`}
      >
        {/* Heading row: "You" vs. "Assistant" */}
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">{isUser ? "You" : "Assistant"}</div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs opacity-70 hover:opacity-100"
              >
                Options
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {/* Copy */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onCopyMessage}
                    title="Copy message"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  {/* Fork */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onForkMessage}
                    title="Fork from here"
                  >
                    <GitFork className="h-3 w-3" />
                  </Button>
                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onDeleteMessage}
                    title="Delete message"
                  >
                    <Trash className="h-3 w-3" />
                  </Button>
                </div>
                {/* Exclude / Raw View switches */}
                <div className="flex items-center justify-between gap-2 border-t pt-2">
                  <div className="flex items-center gap-1">
                    <Switch checked={excluded} onCheckedChange={onToggleExclude} />
                    <span className="text-xs text-muted-foreground">Exclude</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={rawView} onCheckedChange={onToggleRawView} />
                    <span className="text-xs text-muted-foreground">Raw View</span>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Raw content block */}
        <pre className="whitespace-pre-wrap text-sm font-mono p-2 bg-background/50 rounded">
          {msg.content}
        </pre>
      </div>
    );
  }

  const { hasThinkBlock, isThinking, thinkContent, mainContent } = parseThinkBlock(msg.content);

  return (
    <div
      className={`relative rounded-lg p-3 ${isUser ? "bg-muted" : "bg-muted/50"
        } ${excluded ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">{isUser ? "You" : "Assistant"}</div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs opacity-70 hover:opacity-100"
            >
              Options
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" side="bottom">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {/* Copy (main content only) */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onCopyMessage}
                  title="Copy message"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                {/* Fork */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onForkMessage}
                  title="Fork from here"
                >
                  <GitFork className="h-3 w-3" />
                </Button>
                {/* Delete */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onDeleteMessage}
                  title="Delete message"
                >
                  <Trash className="h-3 w-3" />
                </Button>
              </div>
              {/* Exclude / Raw View switches */}
              <div className="flex items-center justify-between gap-2 border-t pt-2">
                <div className="flex items-center gap-1">
                  <Switch checked={excluded} onCheckedChange={onToggleExclude} />
                  <span className="text-xs text-muted-foreground">Exclude</span>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={rawView} onCheckedChange={onToggleRawView} />
                  <span className="text-xs text-muted-foreground">Raw View</span>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {hasThinkBlock ? (
        <div className="text-sm space-y-2">
          {isThinking ? (
            <div className="p-2 bg-secondary text-secondary-foreground rounded">
              <div className="font-semibold mb-1">Thinking...</div>
              <div className="animate-pulse text-xs">{thinkContent}</div>
            </div>
          ) : (
            <details className="bg-secondary/50 text-secondary-foreground rounded p-2">
              <summary className="cursor-pointer text-sm font-semibold">
                View Hidden Reasoning
              </summary>
              <div className="mt-2 text-xs whitespace-pre-wrap break-words">
                {thinkContent}
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(thinkContent)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Think Text
                  </Button>
                </div>
              </div>
            </details>
          )}
          <MarkdownRenderer content={mainContent} copyToClipboard={copyToClipboard} />
        </div>
      ) : (
        <MarkdownRenderer content={msg.content} copyToClipboard={copyToClipboard} />
      )}
    </div>
  );
}

interface ChatMessagesProps {
  chatId: string | null;
  messages: Message[];
  isLoading: boolean;
  excludedMessageIds: string[];
}

export function ChatMessages(props: ChatMessagesProps) {
  const { chatId, messages, isLoading, excludedMessageIds = [] } = props;
  const { copyToClipboard } = useCopyClipboard();
  const excludedSet = new Set(excludedMessageIds);
  const deleteMessageMutation = useDeleteMessage();
  const forkChatMutation = useForkChatFromMessage();
  const [rawMessageIds, setRawMessageIds] = useState<Set<string>>(new Set());
  const { autoScrollEnabled = true } = useSettings()
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScrollEnabled) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScrollEnabled]);

  const handleToggleExclude = (messageId: string) => {
    console.warn("Exclude toggle needs implementation based on external state management.");
  };

  const handleForkFromMessage = async (messageId: string) => {
    try {
      if (!chatId) {
        toast.error("Cannot fork: Chat ID not available.");
        return;
      }

      const result = await forkChatMutation.mutateAsync({
        chatId,
        messageId,
        body: {
          excludedMessageIds: Array.from(excludedSet)
        }
      });
      toast.success("Chat forked successfully");
    } catch (error) {
      console.error("Error forking chat:", error);
      toast.error("Failed to fork chat");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!messageId) {
      toast.error("Invalid message ID");
      return;
    }

    const confirmDelete = window.confirm("Are you sure you want to delete this message?");
    if (!confirmDelete) return;

    try {
      await deleteMessageMutation.mutateAsync(messageId);
      toast.success("Message deleted successfully");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
    }
  };

  const handleToggleRawView = (messageId: string) => {
    setRawMessageIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  if (!messages) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="h-full flex items-center justify-center">
          <Card className="p-6 max-w-md text-center">
            <h3 className="text-lg font-semibold mb-2">No Chat Selected</h3>
            <p className="text-muted-foreground">
              Select a chat from the sidebar or create a new one to start messaging.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-sm text-muted-foreground">Loading messages...</div>
      </div>
    );
  }
  if (!messages.length) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="h-full flex items-center justify-center">
          <Card className="p-6 max-w-md text-center">
            <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
            <p className="text-muted-foreground">
              Start the conversation by typing your message below.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((msg) => {
            if (!msg.id) {
              console.warn("Message missing ID:", msg);
              return null;
            }
            const excluded = excludedSet.has(msg.id);
            const rawView = rawMessageIds.has(msg.id);

            return (
              <ChatMessageItem
                key={msg.id}
                msg={msg}
                excluded={excluded}
                rawView={rawView}
                copyToClipboard={copyToClipboard}
                onCopyMessage={() => copyToClipboard(msg.content)}
                onForkMessage={() => handleForkFromMessage(msg.id!)}
                onDeleteMessage={() => handleDeleteMessage(msg.id!)}
                onToggleExclude={() => handleToggleExclude(msg.id!)}
                onToggleRawView={() => handleToggleRawView(msg.id!)}
              />
            );
          })}
        </div>
        <div ref={bottomRef} />
      </ScrollArea>
    </div>
  );
}



export function ChatSidebar() {
  const [activeChatId, setActiveChatId] = useActiveChatId();

  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const activeChatRef = useRef<HTMLDivElement>(null);

  const { data: chatsData, isLoading: isLoadingChats } = useGetChats();
  const deleteChat = useDeleteChat();
  const updateChat = useUpdateChat();
  const createChat = useCreateChat();

  const sortedChats = useMemo(() => {
    const chats: Chat[] = chatsData?.data ?? [];
    return [...chats].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [chatsData]);

  const visibleChats = useMemo(() => {
    return sortedChats.slice(0, visibleCount);
  }, [sortedChats, visibleCount]);

  async function handleCreateNewChat() {
    const defaultTitle = `Chat ${new Date().toLocaleTimeString()}`;
    try {
      const newChat = await createChat.mutateAsync({
        title: defaultTitle,
        copyExisting: false,
      }) as Chat;
      toast.success('New chat created');
      setActiveChatId(newChat?.id ?? null);
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error('Failed to create chat');
    }
    setEditingTitle('');
  }

  async function handleDeleteChat(chatId: string) {
    if (!window.confirm('Are you sure you want to delete this chat?')) return;
    try {
      await deleteChat.mutateAsync(chatId);
      // If deleted chat was active, clear active chat
      if (activeChatId === chatId) {
        setActiveChatId(null);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  }

  function startEditingChat(chat: Chat) {
    setEditingChatId(chat.id);
    setEditingTitle(chat.title ?? 'No Title');
  }

  async function handleUpdateChat(chatId: string) {
    try {
      await updateChat.mutateAsync({
        chatId,
        data: { title: editingTitle },
      });
      setEditingChatId(null);
    } catch (error) {
      console.error('Error updating chat:', error);
    }
  }

  function cancelEditing() {
    setEditingChatId(null);
    setEditingTitle('');
  }

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(':scope > div[style*="overflow: scroll"]');
    if (activeChatRef.current && viewport) {
      activeChatRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeChatId, visibleChats]);

  return (
    <SlidingSidebar
      width={340}
      icons={{
        openIcon: MessageSquareIcon
      }}
    >
      <div className="p-2 border-b mb-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleCreateNewChat}
        >
          <PlusIcon className="h-4 w-4" /> New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1 mt-2" ref={scrollAreaRef}>
        <div className="text-xl font-bold px-2 mb-2">
          Chat History
        </div>
        {isLoadingChats ? (
          <div>Loading chats...</div>
        ) : (
          visibleChats.map((chat) => {
            const isActive = activeChatId === chat.id;

            return (
              <div
                key={chat.id}
                ref={isActive ? activeChatRef : null}
                className={cn(
                  'flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md group',
                  {
                    'bg-gray-100 dark:bg-gray-800': isActive,
                  }
                )}
              >
                {editingChatId === chat.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateChat(chat.id);
                        else if (e.key === 'Escape') cancelEditing();
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleUpdateChat(chat.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={cancelEditing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        className={cn(
                          'max-w-[180px] w-full text-left truncate',
                          isActive ? 'font-bold' : ''
                        )}
                        onClick={() => {
                          setActiveChatId(chat.id);
                        }}
                        title={chat.title ?? 'No Title'}
                      >
                        {chat.title}
                      </button>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEditingChat(chat)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteChat(chat.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
        {sortedChats.length > visibleCount && (
          <div className="p-2 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount(prev => prev + 50)}
            >
              Show More
            </Button>
          </div>
        )}
      </ScrollArea>
    </SlidingSidebar>
  );
}



export function ChatHeader() {
  const [activeChatId] = useActiveChatId();
  const { data: chats } = useGetChats();
  const activeChatData = useMemo(() => chats?.data?.find((c) => c.id === activeChatId), [chats, activeChatId]);
  const { provider, setProvider, currentModel, setCurrentModel } = useChatModelControl();

  if (!activeChatId) {
    return null;
  }

  return (
    <div className="flex justify-between items-center bg-background px-4 pt-2 pb-2 border-b">
      {/* Left side: Chat Title */}
      <div className="flex items-center gap-4">
        <span className="font-bold text-xl">
          {activeChatData?.title || "Loading Chat..."}
        </span>
      </div>

      {/* Right side: Model Controls */}
      <div className="flex items-center gap-2">
        <ModelSelector
          className="flex-row"
          provider={provider as APIProviders}
          currentModel={currentModel}
          onProviderChange={setProvider}
          onModelChange={setCurrentModel}
        />

        <ModelSettingsPopover />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  validateSearch: (search) => ({
    prefill: Boolean(search.prefill),
  }),
});

function ChatPage() {
  const [activeChatId, setActiveChat] = useActiveChatId();
  const { settings: modelSettings } = useChatModelParams();
  const provider = modelSettings.provider;
  const model = modelSettings.model;

  const {
    messages,
    input,
    handleInputChange: sdkHandleInputChange,
    handleSubmit: sdkHandleSubmit,
    isLoading,
    isFetchingInitialMessages,
  } = useAIChat({
    chatId: activeChatId || '',
    provider: provider || 'openrouter',
    model: model || 'deepseek/deepseek-chat-v3-0324:free',
  });

  useEffect(() => {
    if (!activeChatId) {
      setActiveChat(nanoid());
    }
  }, [activeChatId, setActiveChat]);

  const hasActiveChat = Boolean(activeChatId);

  const handleChatInputChange = (value: string) => {
    const event = { target: { value } } as React.ChangeEvent<HTMLInputElement>;
    sdkHandleInputChange(event);
  };

  const handleFormSubmit = sdkHandleSubmit;

  return (
    <div className='flex flex-col h-full overflow-hidden'>
      <div className='flex flex-1 overflow-hidden'>
        <ChatSidebar />
        <div className='flex-1 flex flex-col min-h-0'>
          {hasActiveChat ? (
            <>
              <ChatHeader />
              <div className='flex-1 min-h-0 overflow-hidden'>
                <ChatMessages
                  chatId={activeChatId}
                  messages={messages}
                  isLoading={isLoading || isFetchingInitialMessages}
                  excludedMessageIds={[]}
                />
              </div>
            </>
          ) : (
            <div className='flex-1 flex items-center justify-center'>
              <div className='text-center space-y-4'>
                <h2 className='text-2xl font-semibold text-muted-foreground'>No Chat Selected</h2>
                <p className='text-sm text-muted-foreground'>
                  Select or create a chat.
                </p>
                <Button onClick={() => setActiveChat(nanoid())}>+ Start a Chat</Button>
              </div>
            </div>
          )}
          {hasActiveChat && (
            <form onSubmit={handleFormSubmit} className='relative mx-2 mb-2'>
              <div className='flex gap-2 bg-background rounded-md items-end'>
                <AdaptiveChatInput
                  value={input}
                  onChange={handleChatInputChange}
                  placeholder="Type your message..."
                  disabled={!activeChatId || isLoading}
                  className="w-full"
                  preserveFormatting
                />
                <Button
                  type="submit"
                  disabled={!activeChatId || !input?.trim() || isLoading}>
                  {isLoading ? "Sending..." : "Send"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

