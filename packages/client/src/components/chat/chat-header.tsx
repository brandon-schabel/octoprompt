import { useMemo } from "react";
import { Chat } from 'shared/index'; 
import { useGetChats } from "@/hooks/api/use-chat-api";
import { useChatModelControl } from "@/components/chat/hooks/use-chat-model-control";
import { ModelSelector } from "./components/model-selector";
import { ModelSettingsPopover } from "./components/model-settings-popover";
import { APIProviders } from "shared/index";
import { useActiveChat } from "@/zustand/selectors";

export function ChatHeader() { 
    // Get active chat ID from Zustand
    const chatId = useActiveChat();
    
    if (!chatId) {
        return null; // Or a placeholder indicating no chat selected
    }

    // Get chat data for title
    const { data: chats } = useGetChats();

    const activeChatData = useMemo(() => chats?.find((c: Chat) => c.id === chatId), [chats, chatId]);
    
    // Get model controls (now reads/writes global settings)
    const { provider, setProvider, currentModel, setCurrentModel } = useChatModelControl();

    return (
        <div className="flex justify-between items-center bg-background px-4 pt-2 pb-2 border-b">
            {/* Left side: Chat Title */}
            <div className="flex items-center gap-4">
                <span className="font-bold text-xl">
                    {activeChatData?.title || "Loading Chat..."}
                </span>
            </div>

            {/* Right side: Model Controls */}
            <div className="flex items-center gap-2">
                <ModelSelector
                    className="flex-row"
                    provider={provider as APIProviders}
                    currentModel={currentModel}
                    onProviderChange={setProvider}
                    onModelChange={setCurrentModel}
                />

                <ModelSettingsPopover />
            </div>
        </div>
    );
}