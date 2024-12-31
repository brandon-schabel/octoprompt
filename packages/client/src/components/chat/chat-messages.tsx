import { Copy, GitFork, Trash } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";
import { toast } from "sonner";
import {
    useDeleteMessage,
    useForkChatFromMessage,
} from "@/hooks/api/use-chat-ai-api";
import { useChatControl } from "./hooks/use-chat-state";

export function ChatMessages({
    chatControl,
}: {
    chatControl: ReturnType<typeof useChatControl>;
}) {
    const {
        messages,
        chatId,
        refetchMessages,
        activeChatTabState,
        updateActiveChatTab,
    } = chatControl;

    const deleteMessageMutation = useDeleteMessage();
    const forkChatFromMessageMutation = useForkChatFromMessage();

    // Convert excludedMessageIds to a Set for quick .has() checks
    const excludedIds = new Set(activeChatTabState?.excludedMessageIds ?? []);

    // Toggle local exclusion state in global activeChatTab
    const toggleMessageExclusion = (messageId: string) => {
        if (!activeChatTabState) return;
        const newExcluded = new Set(activeChatTabState.excludedMessageIds ?? []);
        if (newExcluded.has(messageId)) {
            newExcluded.delete(messageId);
            toast.success("Message included in context");
        } else {
            newExcluded.add(messageId);
            toast.success("Message excluded from context");
        }
        updateActiveChatTab({ excludedMessageIds: Array.from(newExcluded) });
    };

    // Restored "fork from message" handler
    const handleForkFromMessage = async (messageId: string) => {
        if (!chatId) return;
        try {
            const excludedMessageIds = activeChatTabState?.excludedMessageIds ?? [];
            const newChat = await forkChatFromMessageMutation.mutateAsync({
                chatId,
                messageId,
                excludedMessageIds,
            });
            // Point this tab to the newly forked chat
            updateActiveChatTab({
                activeChatId: newChat.id,
                excludedMessageIds: [],
            });
            refetchMessages(); // or refetch the new chat’s messages if needed
            toast.success("Chat forked successfully");
        } catch (error) {
            console.error("Error forking chat from message:", error);
            toast.error("Failed to fork chat");
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success("Message copied to clipboard");
        } catch (error) {
            console.error("Failed to copy text:", error);
            toast.error("Failed to copy message");
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!chatId) return;
        if (window.confirm("Are you sure you want to delete this message?")) {
            try {
                await deleteMessageMutation.mutateAsync(messageId);
                // Refetch messages after deletion
                refetchMessages();
                toast.success("Message deleted successfully");
            } catch (error) {
                console.error("Error deleting message:", error);
                toast.error("Failed to delete message");
            }
        }
    };

    return (
        <ScrollArea className="flex-1 h-full p-2" id="chat-messages">
            {messages.map((message, i) => (
                <div
                    key={`${message.id}-${i}`}
                    className={`group relative mb-6 ${excludedIds.has(message.id) ? "opacity-50" : ""
                        }`}
                >
                    <div
                        className={`flex flex-col gap-1 ${message.role === "user" ? "items-end" : "items-start"
                            }`}
                    >
                        <Card className="inline-block p-2 max-w-[80%] relative">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                        </Card>

                        {/* Message Actions */}
                        <div className={`absolute -bottom-12 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 items-center bg-background p-2 rounded-md ${
                            message.role === "user" ? "right-0" : "left-0"
                        }`}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(message.content)}
                                title="Copy message"
                            >
                                <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleForkFromMessage(message.id)}
                                title="Fork chat from here"
                            >
                                <GitFork className="h-3 w-3" />
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleDeleteMessage(message.id)}
                                title="Delete message"
                            >
                                <Trash className="h-3 w-3" />
                            </Button>

                            {/* Exclude switch */}
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={excludedIds.has(message.id)}
                                    onCheckedChange={() => toggleMessageExclusion(message.id)}
                                />
                                <span className="text-xs text-muted-foreground">Exclude</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </ScrollArea>
    );
}