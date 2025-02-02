import { useChatTabField } from "@/zustand/zustand-utility-hooks";
import { APIProviders } from "shared";

export const useChatModelControl = () => {
    const { data: provider = "openai" } =
        useChatTabField("provider");
    const { data: model = "gpt-4o" } =
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