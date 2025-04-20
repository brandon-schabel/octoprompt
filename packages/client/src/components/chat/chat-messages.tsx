import { Copy, GitFork, Trash } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useCopyClipboard } from "@/hooks/utility-hooks/use-copy-clipboard";
import { ChatMessage } from "shared/schema";
import { useDeleteMessage, useForkChatFromMessage } from "@/hooks/api/use-chat-api";
import { useUpdateActiveChatTab } from "@/zustand/updaters";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { useSettingsField } from "@/zustand/zustand-utility-hooks"

/**
 * Helper function to parse out <think> blocks in the assistant message.
 * - If there's an opening <think> but no closing </think>, we treat the block as "still thinking."
 * - If the <think> is fully closed, we allow the user to expand it.
 */
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

/**
 * ChatMessageItem
 * Renders a single message, including:
 * - "Options" popover with Copy, Fork, Delete, Exclude, Raw View toggles
 * - Handling for <think> blocks, shown or hidden
 * - Raw vs. Markdown rendering
 */
function ChatMessageItem(props: {
    msg: ChatMessage;
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

    // Otherwise, parse the message for <think> blocks and render as Markdown
    const { hasThinkBlock, isThinking, thinkContent, mainContent } = parseThinkBlock(msg.content);

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

            {/* If a <think> block is present, handle it specially */}
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
                // No <think> block, render the entire message
                <MarkdownRenderer content={msg.content} copyToClipboard={copyToClipboard} />
            )}
        </div>
    );
}

interface ChatMessagesProps {
    messages: ChatMessage[]; // Already merged local + server messages
    isFetching: boolean;
    excludedMessageIds: string[]; // For marking "excluded" messages
}

/**
 * ChatMessages
 * Renders all messages with the "raw view" toggle at the individual message level,
 * plus a global "Auto Scroll" toggle (Ticket 1.3) at the top.
 */
export function ChatMessages(props: ChatMessagesProps) {
    const { messages, isFetching, excludedMessageIds = [] } = props;

    // For copying text to clipboard
    const { copyToClipboard } = useCopyClipboard();

    // For toggling excluded messages in the global store
    const excludedSet = new Set(excludedMessageIds);
    const updateActiveChatTab = useUpdateActiveChatTab();

    // For deleting/forking messages
    const deleteMessageMutation = useDeleteMessage();
    const forkChatMutation = useForkChatFromMessage();

    // Each message can have "Raw View" enabled individually
    const [rawMessageIds, setRawMessageIds] = useState<Set<string>>(new Set());

    // Use global auto-scroll setting
    const { data: autoScrollEnabled = true } = useSettingsField('autoScrollEnabled')
    const bottomRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when new messages arrive and autoScroll is enabled
    useEffect(() => {
        if (autoScrollEnabled) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, autoScrollEnabled]);

    const handleToggleExclude = (messageId: string) => {
        const newExcludedMessageIds = new Set(excludedSet);
        if (newExcludedMessageIds.has(messageId)) {
            newExcludedMessageIds.delete(messageId);
        } else {
            newExcludedMessageIds.add(messageId);
        }
        updateActiveChatTab({
            excludedMessageIds: Array.from(newExcludedMessageIds),
        });
    };

    const handleForkFromMessage = async (messageId: string) => {
        try {
            // We assume all messages share the same chatId
            const chatId = messages[0]?.chatId ?? "";
            const result = await forkChatMutation.mutateAsync({
                chatId,
                messageId,
                excludedMessageIds,
            });
            updateActiveChatTab({
                activeChatId: result.id,
                excludedMessageIds: [],
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

        const message = messages.find((m) => m.id === messageId);
        if (!message) {
            toast.error("Message not found");
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

    // If no chat is selected, show a different message
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

    // If the chat is still loading or no messages yet
    if (isFetching && messages.length === 0) {
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
            {/* Remove the Auto Scroll Toggle since it's now in settings */}
            <ScrollArea className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                    {messages.map((msg) => {
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
                                onForkMessage={() => handleForkFromMessage(msg.id)}
                                onDeleteMessage={() => handleDeleteMessage(msg.id)}
                                onToggleExclude={() => handleToggleExclude(msg.id)}
                                onToggleRawView={() => handleToggleRawView(msg.id)}
                            />
                        );
                    })}
                </div>
                {/* An invisible anchor we can scroll to when autoScroll is true */}
                <div ref={bottomRef} />
            </ScrollArea>
        </div>
    );
}