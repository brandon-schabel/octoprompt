import { useChatTabField } from "@/zustand/zustand-utility-hooks";
import { APIProviders, DEFAULT_MODEL_CONFIGS } from "shared";

const defaultModelConfigs = DEFAULT_MODEL_CONFIGS['default']

export const useChatModelControl = () => {
    const { data: provider = defaultModelConfigs.provider } =
        useChatTabField("provider");
    const { data: model = defaultModelConfigs.model } =
        useChatTabField("model");

    const { mutate: setProviderField } = useChatTabField(
        "provider",
    );
    const { mutate: setModelField } = useChatTabField(
        "model",
    );

    function setProvider(newProvider: APIProviders) {
        setProviderField(newProvider);
    }

    function setCurrentModel(modelId: string) {
        setModelField(modelId);
    }

    return {
        provider,
        setProvider,
        currentModel: model,
        setCurrentModel,
    };
};