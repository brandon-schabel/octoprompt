import { useAppSettings } from "@/hooks/api/use-kv-api";
import { APIProviders } from "shared/src/schemas/provider-key.schemas";

export const useChatModelControl = () => {
    const [settings, updateSettings] = useAppSettings();

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