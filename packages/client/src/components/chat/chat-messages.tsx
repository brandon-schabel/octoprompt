import React from "react";
import { Copy, GitFork, Trash } from "lucide-react";
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
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useCopyClipboard } from "@/hooks/utility-hooks/use-copy-clipboard";
import { useGlobalStateHelpers } from "../use-global-state-helpers";

export function ChatMessages({
    chatControl,
}: {
    chatControl: ReturnType<typeof useChatControl>;
}) {
    const { state } = useGlobalStateHelpers();
    const settings = state?.settings;
    const isDarkMode = settings?.theme === "dark";
    const selectedTheme = isDarkMode
        ? settings?.codeThemeDark
        : settings?.codeThemeLight;

    // Provide a fallback style if selectedTheme is not found
    // or pass it directly if you know it always exists in `themes`.
    const themeStyle = selectedTheme;

    const {
        messages,
        chatId,
        refetchMessages,
        activeChatTabState,
        updateActiveChatTab,
    } = chatControl;

    const { copyToClipboard } = useCopyClipboard()

    const deleteMessageMutation = useDeleteMessage();
    const forkChatFromMessageMutation = useForkChatFromMessage();
    const excludedIds = new Set(activeChatTabState?.excludedMessageIds ?? []);

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

    const handleForkFromMessage = async (messageId: string) => {
        if (!chatId) return;
        try {
            const excludedMessageIds =
                activeChatTabState?.excludedMessageIds ?? [];
            const newChat = await forkChatFromMessageMutation.mutateAsync({
                chatId,
                messageId,
                excludedMessageIds,
            });
            updateActiveChatTab({
                activeChatId: newChat.id,
                excludedMessageIds: [],
            });
            refetchMessages();
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
                refetchMessages();
                toast.success("Message deleted successfully");
            } catch (error) {
                console.error("Error deleting message:", error);
                toast.error("Failed to delete message");
            }
        }
    };

    return (
        <ScrollArea className="flex-1 h-full overflow-y-auto p-2" id="chat-messages">
            <div className="py-4">
                {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <Card className="p-6 max-w-md text-center">
                            <h3 className="text-lg font-semibold mb-2">
                                No messages yet
                            </h3>
                            <p className="text-muted-foreground">
                                Start the conversation by typing your message below.
                                I&apos;m here to help!
                            </p>
                        </Card>
                    </div>
                ) : (
                    messages.map((message, i) => (
                        <div
                            key={`${message.id}-${i}`}
                            className={`relative mb-6 flex w-full ${excludedIds.has(message.id)
                                ? "opacity-50"
                                : ""
                                } ${message.role === "user"
                                    ? "justify-end"
                                    : "justify-start"
                                }`}
                        >
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Card
                                        className="p-2 max-w-[80vw] w-fit break-words cursor-pointer bg-secondary"
                                    >
                                        <MarkdownRenderer
                                            content={message.content}
                                            isDarkMode={isDarkMode}
                                            themeStyle={themeStyle}
                                            copyToClipboard={copyToClipboard}
                                        />
                                    </Card>
                                </PopoverTrigger>

                                <PopoverContent
                                    align={message.role === "user" ? "end" : "start"}
                                    side="bottom"
                                >
                                    <div className="flex gap-1 items-center">
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
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={excludedIds.has(message.id)}
                                                onCheckedChange={() => toggleMessageExclusion(message.id)}
                                            />
                                            <span className="text-xs text-muted-foreground">
                                                Exclude
                                            </span>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    ))
                )}
            </div>
        </ScrollArea>
    );
}