import { APIProviders } from "shared";
import { useGlobalStateContext } from "@/components/global-state-context";

export const useChatModelControl = () => {
    const {
        activeChatTabState,
        updateActiveChatTab,
    } = useGlobalStateContext();

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