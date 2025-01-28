import { Copy, GitFork, Trash } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useCopyClipboard } from "@/hooks/utility-hooks/use-copy-clipboard";
import { ChatMessage } from "shared/schema";
import { useDeleteMessage, useForkChatFromMessage } from "@/hooks/api/use-chat-ai-api";
import { useUpdateActiveChatTab } from "@/websocket-state/hooks/updaters/websocket-updater-hooks";
import { toast } from "sonner";

interface ChatMessagesProps {
    messages: ChatMessage[];          // Already merged local + server messages
    isFetching: boolean;
    excludedMessageIds: string[];     // For marking "excluded" messages
}


export function ChatMessages(props: ChatMessagesProps) {
    const {
        messages,
        isFetching,
        excludedMessageIds = [],
    } = props;

    const { copyToClipboard } = useCopyClipboard();
    const excludedSet = new Set(excludedMessageIds);
    const updateActiveChatTab = useUpdateActiveChatTab();
    const deleteMessageMutation = useDeleteMessage();
    const forkChatMutation = useForkChatFromMessage();

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
            const result = await forkChatMutation.mutateAsync({
                chatId: messages[0]?.chatId ?? '', // Get chatId from first message
                messageId,
                excludedMessageIds,
            });
            updateActiveChatTab({
                activeChatId: result.id,
                excludedMessageIds: [],
            });
            toast.success("Chat forked successfully");
        } catch (error) {
            console.error('Error forking chat:', error);
            toast.error("Failed to fork chat");
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!messageId) {
            toast.error("Invalid message ID");
            return;
        }

        const message = messages.find(m => m.id === messageId);
        if (!message) {
            toast.error("Message not found");
            return;
        }

        // Show confirmation dialog
        const confirmDelete = window.confirm("Are you sure you want to delete this message?");
        if (!confirmDelete) {
            return;
        }

        try {
            await deleteMessageMutation.mutateAsync(messageId);
            // The query invalidation in useDeleteMessage will trigger a refetch
            toast.success("Message deleted successfully");
        } catch (error) {
            console.error('Error deleting message:', error);
            toast.error("Failed to delete message");
        }
    };

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
        <ScrollArea className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
                {messages.map((msg, i) => {
                    const isUser = msg.role === "user";
                    const excluded = excludedSet.has(msg.id);
                    return (
                        <div
                            key={`${msg.id}-${i}`}
                            className={`relative rounded-lg p-3 ${isUser ? "bg-muted" : "bg-muted/50"
                                } ${excluded ? "opacity-50" : ""}`}
                        >
                            {/* Heading row: "You" vs. "Assistant" */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="font-semibold">
                                    {isUser ? "You" : "Assistant"}
                                </div>

                                {/* Popover with copy/fork/delete/exclude */}
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
                                        <div className="flex items-center gap-2">
                                            {/* Copy */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => copyToClipboard(msg.content)}
                                                title="Copy message"
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                            {/* Fork */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => handleForkFromMessage(msg.id)}
                                                title="Fork from here"
                                            >
                                                <GitFork className="h-3 w-3" />
                                            </Button>
                                            {/* Delete */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => handleDeleteMessage(msg.id)}
                                                title="Delete message"
                                            >
                                                <Trash className="h-3 w-3" />
                                            </Button>
                                            {/* Exclude switch */}
                                            <div className="flex items-center gap-1">
                                                <Switch
                                                    checked={excluded}
                                                    onCheckedChange={() => handleToggleExclude(msg.id)}
                                                />
                                                <span className="text-xs text-muted-foreground">
                                                    Exclude
                                                </span>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Message content - using markdown renderer */}
                            <MarkdownRenderer content={msg.content} />
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
}