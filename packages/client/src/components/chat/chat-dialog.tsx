import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

import { APIProviders } from "shared"
import { useCreateChat } from "@/hooks/api/use-chat-ai-api"
import { useGlobalStateHelpers } from "../global-state/use-global-state-helpers"

type ChatDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ChatDialog({ open, onOpenChange }: ChatDialogProps) {
    const [title, setTitle] = useState("")
    const [copyExisting, setCopyExisting] = useState(false)
    const [provider, setProvider] = useState<APIProviders>("openai")
    const [currentModel, setCurrentModel] = useState<string>("")
    const createChatMutation = useCreateChat();
    const {
        activeChatTabState,
        updateActiveChatTab,
    } = useGlobalStateHelpers();

    const truncateText = (text: string, maxLength = 24) => {
        return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
    };

    const generateDefaultTitle = () => `Chat ${new Date().toLocaleTimeString()}`;
    async function handleCreateChat(e: React.FormEvent<HTMLButtonElement>) {
        e.preventDefault();
        const chatTitle = title.trim() || generateDefaultTitle();
        try {
            const newChat = await createChatMutation.mutateAsync({ title: chatTitle });
            setTitle('');
            updateActiveChatTab({ activeChatId: newChat.id });
            onOpenChange(false);
            return newChat;
        } catch (error) {
            console.error('Error creating chat:', error);
            return null;
        }
    }

    // const handleCreateChat = () => {


    //     createChatTab({
    //         cleanTab: !copyExisting,
    //         model: currentModel,
    //         provider,
    //         title: title.trim() || undefined
    //     })
    //     setTitle("")
    //     setCopyExisting(false)
    //     onOpenChange(false)
    // }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Chat</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center gap-4">
                        <Input
                            placeholder="Chat title (optional)"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="flex-1"
                        />
                    </div>

                    {/* <ModelSelector
                        provider={provider}
                        currentModel={currentModel}
                        onProviderChange={setProvider}
                        onModelChange={setCurrentModel}
                    /> */}

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="copy-existing"
                            checked={copyExisting}
                            onCheckedChange={(checked) => setCopyExisting(checked as boolean)}
                        />
                        <label
                            htmlFor="copy-existing"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Copy existing chat
                        </label>
                    </div>
                    <Button onClick={handleCreateChat}>Create Chat</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
} 