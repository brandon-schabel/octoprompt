import { useSettings } from '@/hooks/api/global-state/selectors'; // Use global settings selector
import { useUpdateSettings } from '@/hooks/api/global-state/updaters'; // Use global settings updater
import { APIProviders } from "shared/src/schemas/provider-key.schemas";

export const useChatModelControl = () => {
    const settings = useSettings();
    const updateSettings = useUpdateSettings();

    const provider = settings.provider; // Get from global settings
    const model = settings.model;       // Get from global settings

    function setProvider(newProvider: APIProviders) {
        updateSettings({ provider: newProvider }); // Update global settings
    }

    function setCurrentModel(modelId: string) {
        updateSettings({ model: modelId }); // Update global settings
    }

    return {
        provider,
        setProvider,
        currentModel: model,
        setCurrentModel,
    };
};