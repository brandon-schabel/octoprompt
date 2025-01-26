import { useUpdateActiveChatTab } from "@/websocket-state/hooks/updaters/websocket-updater-hooks";
import { useActiveChatTab } from "@/websocket-state/hooks/selectors/websocket-selector-hoooks";
import { APIProviders } from "shared";

export const useChatModelControl = () => {
    const updateActiveChatTab = useUpdateActiveChatTab();
    const { tabData: activeChatTabState } = useActiveChatTab()

    // Fall back to defaults if no tab is active
    const provider: APIProviders = activeChatTabState?.provider ?? 'openai';
    const currentModel: string = activeChatTabState?.model ?? 'gpt-4o';

    // Whenever you set a new provider, update the active chat tab in global state
    function setProvider(newProvider: APIProviders) {
        updateActiveChatTab({
            provider: newProvider,
        });
    }

    // Similarly for model changes
    function setCurrentModel(modelId: string) {
        updateActiveChatTab({
            model: modelId,
        });
    }

    return {
        provider,
        setProvider,
        currentModel,
        setCurrentModel,
    };
};