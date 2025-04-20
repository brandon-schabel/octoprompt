import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

import { useCreateChat } from "@/hooks/api/use-chat-api"

type ChatDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export type CreateChatOptions = {
    title: string;
    copyExisting: boolean;
    currentChatId?: string;
}

export function ChatDialog({ open, onOpenChange }: ChatDialogProps) {
    const [title, setTitle] = useState("")
    const [copyExisting, setCopyExisting] = useState(false)
    const createChatMutation = useCreateChat();
    const [activeChatId, setActiveChatId] = useState<string | undefined>(undefined);

    const generateDefaultTitle = () => `Chat ${new Date().toLocaleTimeString()}`;
    async function handleCreateChat(e: React.FormEvent<HTMLButtonElement>) {
        e.preventDefault();
        const chatTitle = title.trim() || generateDefaultTitle();
        try {
            const newChat = await createChatMutation.mutateAsync({
                title: chatTitle,
                copyExisting,
                currentChatId: copyExisting ? activeChatId : undefined
            });
            setTitle('');
            onOpenChange(false);
            return newChat;
        } catch (error) {
            console.error('Error creating chat:', error);
            return null;
        }
    }

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