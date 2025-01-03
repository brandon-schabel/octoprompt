import { Copy, GitFork, Trash } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
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
import { LightAsync as SyntaxHighlighter } from "react-syntax-highlighter";
import * as themes from "react-syntax-highlighter/dist/esm/styles/hljs";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";
import ts from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import js from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
// @ts-ignore
import * as languages from "react-syntax-highlighter/dist/esm/languages/hljs";
import { useGlobalStateContext } from "../global-state-context";

// Register languages
Object.entries(languages).forEach(([name, lang]) => {
    SyntaxHighlighter.registerLanguage(name, lang);
});

// Associate the languages with tsx and jsx
SyntaxHighlighter.registerLanguage("jsx", js);
SyntaxHighlighter.registerLanguage("tsx", ts);

export function ChatMessages({
    chatControl,
}: {
    chatControl: ReturnType<typeof useChatControl>;
}) {
    const { state } = useGlobalStateContext();
    const settings = state?.settings;
    const isDarkMode = settings?.theme === "dark";
    const selectedTheme = isDarkMode
        ? settings?.codeThemeDark
        : settings?.codeThemeLight;
    const themeStyle = selectedTheme
        ? themes[selectedTheme as keyof typeof themes]
        : themes.atomOneLight;

    const {
        messages,
        chatId,
        refetchMessages,
        activeChatTabState,
        updateActiveChatTab,
    } = chatControl;

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
            refetchMessages();
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
                refetchMessages();
                toast.success("Message deleted successfully");
            } catch (error) {
                console.error("Error deleting message:", error);
                toast.error("Failed to delete message");
            }
        }
    };

    return (
        <ScrollArea className="flex-1 h-full overflow-y-auto p-2 " id="chat-messages">
            {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                    <Card className="p-6 max-w-md text-center">
                        <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
                        <p className="text-muted-foreground">
                            Start the conversation by typing your message below. I'm here to help!
                        </p>
                    </Card>
                </div>
            ) : (
                messages.map((message, i) => (
                    <div
                        key={`${message.id}-${i}`}
                        className={`relative mb-6 flex w-full ${excludedIds.has(message.id) ? "opacity-50" : ""
                            } ${message.role === "user"
                                ? "justify-end"
                                : "justify-start"
                            }`}
                    >
                        <Popover>
                            <PopoverTrigger asChild>
                                <Card
                                    className={`p-2 max-w-[80vw] w-fit break-words cursor-pointer`}
                                >
                                    <ReactMarkdown
                                        components={{
                                            /* @ts-ignore */
                                            code: ({ inline, className, children, ...rest }) => {
                                                const match = /language-(\w+)/.exec(className || "");
                                                const codeString = String(children).replace(/\n$/, "");

                                                if (!inline && match) {
                                                    return (
                                                        <div className="relative my-2 overflow-x-auto break-words">
                                                            {/* Copy button */}
                                                            <button
                                                                onClick={() => copyToClipboard(codeString)}
                                                                className={`
                                  absolute top-2 right-2 
                                  text-xs px-2 py-1 border rounded shadow
                                  ${isDarkMode
                                                                        ? "bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
                                                                        : "bg-neutral-50 text-neutral-900 hover:bg-neutral-200"
                                                                    }
                                `}
                                                                title="Copy code"
                                                            >
                                                                Copy
                                                            </button>

                                                            <SyntaxHighlighter
                                                                language={match[1]}
                                                                style={themeStyle}
                                                                showLineNumbers
                                                                wrapLongLines
                                                            >
                                                                {codeString}
                                                            </SyntaxHighlighter>
                                                        </div>
                                                    );
                                                }

                                                // Inline code
                                                return (
                                                    <code className={className} {...rest}>
                                                        {children}
                                                    </code>
                                                );
                                            },
                                        }}
                                    >
                                        {message.content}
                                    </ReactMarkdown>
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
                                        <span className="text-xs text-muted-foreground">Exclude</span>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                ))
            )}
        </ScrollArea>
    );
}