import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useChatControl } from "./hooks/use-chat-state"

interface ChatHeaderProps {
    selectedProjectId?: string
    onForkChat: () => void
    onBackToProject?: () => void
    chatControl: ReturnType<typeof useChatControl>
}

export function ChatHeader({
    selectedProjectId,
    onForkChat,
    onBackToProject,
    chatControl
}: ChatHeaderProps) {
    const {
        currentChat,
        excludedMessageIds,
        clearExcludedMessages
    } = chatControl

    const excludedMessageCount = excludedMessageIds.size

    return (
        <div className="flex justify-between items-center mb-2 bg-background p-2 rounded-md">
            <div className="flex items-center gap-4">
                {selectedProjectId && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                        onClick={onBackToProject}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Project
                    </Button>
                )}
                <div className="font-bold text-xl">
                    {currentChat?.title || 'No Chat Selected'}
                </div>
            </div>

            {currentChat && (
                <div className="flex items-center gap-2">
                    {excludedMessageCount > 0 && (
                        <>
                            <Badge variant="secondary">
                                {excludedMessageCount} message
                                {excludedMessageCount !== 1 ? 's' : ''} excluded
                            </Badge>
                            <Button variant="outline" size="sm" onClick={clearExcludedMessages}>
                                Clear Excluded
                            </Button>
                        </>
                    )}
                    <Button variant="outline" onClick={onForkChat}>
                        Fork Chat
                    </Button>
                </div>
            )}
        </div>
    )
}