import { Copy, GitFork, Trash } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";
import { toast } from "sonner";

import { useDeleteMessage, useForkChatFromMessage } from "@/hooks/api/use-chat-ai-api";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useCopyClipboard } from "@/hooks/utility-hooks/use-copy-clipboard";
import { useQuery } from "@tanstack/react-query";
import { useSettingsField } from "@/websocket-state/settings-hooks";
import {
    useChatTabField,
    useChatTabFieldUpdater,
} from "@/websocket-state/chat-tab-hooks";
import { useChatMessages } from "./hooks/chat-hooks";

interface ChatMessagesProps {
    chatId: string;
}

/**
 * Example of using the new `useChatMessages` inside the component,
 * and hooking directly to global state for excluded messages.
 */
export function ChatMessages({ chatId }: ChatMessagesProps) {
    const {
        messages,
        isFetching,
        isError,
    } = useChatMessages(chatId);

    // 2) Also get the active chat tab ID from globalState
    const { data: chatActiveTabId } = useQuery({
        queryKey: ["globalState"],
        select: (gs: any) => gs?.chatActiveTabId ?? null,
    });

    // 3) Global settings for theming
    const { data: theme } = useSettingsField("theme");
    const { data: codeThemeLight } = useSettingsField("codeThemeLight");
    const { data: codeThemeDark } = useSettingsField("codeThemeDark");
    const isDarkMode = theme === "dark";

    // 4) For excluded message IDs
    const { data: excludedMessageIds = [] } = useChatTabField(
        chatActiveTabId ?? "",
        "excludedMessageIds"
    );
    const { mutate: setExcludedMessageIds } = useChatTabFieldUpdater(
        chatActiveTabId ?? "",
        "excludedMessageIds"
    );
    const excludedIds = new Set(excludedMessageIds);

    // 5) Standard utility hooks
    const { copyToClipboard } = useCopyClipboard();

    // 6) Additional API hooks for deleting + forking chat from a certain message
    const deleteMessageMutation = useDeleteMessage();
    const forkChatFromMessageMutation = useForkChatFromMessage();

    // Toggle a message from the included/excluded set
    const toggleMessageExclusion = (messageId: string) => {
        if (!chatActiveTabId) return;
        setExcludedMessageIds((prev) => {
            const newSet = new Set(prev ?? []);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
                toast.success("Message included in context");
            } else {
                newSet.add(messageId);
                toast.success("Message excluded from context");
            }
            return Array.from(newSet);
        });
    };

    const handleForkFromMessage = async (messageId: string) => {
        if (!chatId) return;
        try {
            await forkChatFromMessageMutation.mutateAsync({
                chatId,
                messageId,
                excludedMessageIds,
            });
            toast.success("Chat forked successfully");
        } catch (error) {
            console.error("Error forking chat from message:", error);
            toast.error("Failed to fork chat");
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!chatId) return;
        if (window.confirm("Are you sure you want to delete this message?")) {
            try {
                await deleteMessageMutation.mutateAsync(messageId);
                toast.success("Message deleted successfully");
            } catch (error) {
                console.error("Error deleting message:", error);
                toast.error("Failed to delete message");
            }
        }
    };

    if (isError) {
        return (
            <div className="flex-1 overflow-y-auto p-4">
                <div className="text-red-500">Error loading messages</div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4">
            {isFetching && !messages.length ? (
                <div className="text-muted-foreground">Loading messages...</div>
            ) : (
                <div className="space-y-4">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`p-4 rounded-lg ${
                                message.role === "user" ? "bg-muted" : "bg-muted/50"
                            }`}
                        >
                            <div className="font-semibold mb-1">
                                {message.role === "user" ? "You" : "Assistant"}
                            </div>
                            <div className="whitespace-pre-wrap">{message.content}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}