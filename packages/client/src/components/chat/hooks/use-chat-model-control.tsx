import { useSettings } from '@/hooks/api/global-state/selectors';
import { useUpdateSettings } from '@/hooks/api/global-state/updaters';
import { APIProviders } from "shared/src/schemas/provider-key.schemas";

export const useChatModelControl = () => {
    const settings = useSettings();
    const updateSettings = useUpdateSettings();

    const provider = settings.provider;
    const model = settings.model;

    function setProvider(newProvider: APIProviders) {
        updateSettings({ provider: newProvider });
    }

    function setCurrentModel(modelId: string) {
        updateSettings({ model: modelId });
    }

    return {
        provider,
        setProvider,
        currentModel: model,
        setCurrentModel,
    };
};