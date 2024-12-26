
import { Copy, GitFork, Trash } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { useDeleteMessage, useForkChatFromMessage, useGetMessages } from "@/hooks/api/use-chat-ai-api";
import { useChatControl } from "./hooks/use-chat-state";
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";

export const ChatMessages = ({
    chatControl
}: {
    chatControl: ReturnType<typeof useChatControl>
}) => {
    const {
        setCurrentChat,
        setPendingMessages,
        setExcludedMessagesMap,
        currentChat,
        excludedMessageIds,
        messages
    } = chatControl
    const { refetch: refetchMessages } = useGetMessages(currentChat?.id ?? '')
    const forkChatFromMessageMutation = useForkChatFromMessage()
    const deleteMessageMutation = useDeleteMessage();

    const handleForkChatFromMessage = async (messageId: string) => {
        if (!currentChat) return
        try {
            const newChat = await forkChatFromMessageMutation.mutateAsync({
                chatId: currentChat.id,
                messageId,
                excludedMessageIds: Array.from(excludedMessageIds)
            })
            setCurrentChat(newChat)
            setPendingMessages([])
            setExcludedMessagesMap(prev => ({
                ...prev,
                [newChat.id]: []
            }))
        } catch (error) {
            console.error('Error forking chat from message:', error)
        }
    }

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
        } catch (error) {
            console.error('Failed to copy text:', error)
        }
    }

    const toggleMessageExclusion = (messageId: string) => {
        if (!currentChat) return

        setExcludedMessagesMap(prev => {
            const currentExcluded = new Set(prev[currentChat.id] || [])

            if (currentExcluded.has(messageId)) {
                currentExcluded.delete(messageId)
            } else {
                currentExcluded.add(messageId)
            }

            return {
                ...prev,
                [currentChat.id]: Array.from(currentExcluded)
            }
        })
    }
    return (<ScrollArea className="flex-1 mb-4 h-full p-2">
        {messages.map((message, i) => (
            <div
                key={`${message.id}-${i}`}
                className={`group relative mb-6 ${excludedMessageIds.has(message.id) ? 'opacity-50' : ''
                    }`}
            >
                <div className={`flex flex-col gap-1 ${message.role === 'user' ? 'items-end' : 'items-start'
                    }`}>
                    <Card className="inline-block p-2 max-w-[80%]">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                    </Card>

                    {/* Message Actions */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ml-2 items-center">
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
                            onClick={() => handleForkChatFromMessage(message.id)}
                            title="Fork chat from here"
                        >
                            <GitFork className="h-3 w-3" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={async () => {
                                if (window.confirm('Are you sure you want to delete this message?')) {
                                    try {
                                        await deleteMessageMutation.mutateAsync(message.id);
                                        // Refetch messages after deletion
                                        refetchMessages();
                                    } catch (error) {
                                        console.error('Error deleting message:', error);
                                    }
                                }
                            }}
                            title="Delete message"
                        >
                            <Trash className="h-3 w-3" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={excludedMessageIds.has(message.id)}
                                onCheckedChange={() => toggleMessageExclusion(message.id)}
                            />
                            <span className="text-xs text-muted-foreground">
                                Exclude
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        ))}
    </ScrollArea>)
}