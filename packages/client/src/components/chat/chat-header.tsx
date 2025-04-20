import { useMemo} from "react";
import { Chat } from 'shared/index'; // Keep Chat type
import { useGetChats } from "@/hooks/api/use-chat-api"; // Keep for fetching chat title
import { useChatModelControl } from "@/components/chat/hooks/use-chat-model-control"; // Keep refactored hook
import { ModelSelector } from "./components/model-selector"; // Keep
import { ModelSettingsPopover } from "./components/model-settings-popover"; // Keep
import { APIProviders } from "shared/index"; // Keep type

interface ChatHeaderProps {
    chatId?: string;
}


export function ChatHeader({ chatId }: ChatHeaderProps) { // Simplified props
    if (!chatId) {
        return null; // Or a placeholder indicating no chat selected
    }

    // Get chat data for title
    const { data: chats } = useGetChats();
    const activeChatData = useMemo(() => chats?.find((c: Chat) => c.id === chatId), [chats, chatId]);

    // Get model controls (now reads/writes global settings)
    const { provider, setProvider, currentModel, setCurrentModel } = useChatModelControl();

    // Removed state and handlers related to tabs, linking, forking, exclusions

    return (
        <div className="flex justify-between items-center bg-background px-4 pt-2 pb-2 border-b"> {/* Added pb-2 and border-b */}
            {/* Left side: Chat Title */}
            <div className="flex items-center gap-4">
                <span className="font-bold text-xl">
                    {activeChatData?.title || "Loading Chat..."} {/* Display chat title */}
                </span>
            </div>

            {/* Right side: Model Controls */}
            <div className="flex items-center gap-2">

                <ModelSelector
                    className="flex-row"
                    // Pass resolved provider/model from global settings
                    provider={provider as APIProviders} // Ensure correct default handling if provider can be undefined
                    currentModel={currentModel}       // Ensure correct default handling
                    onProviderChange={setProvider}
                    onModelChange={setCurrentModel}
                />

                <ModelSettingsPopover />
            </div>
        </div>
    );
}