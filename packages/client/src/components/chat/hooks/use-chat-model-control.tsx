import { useChatTabField } from "@/zustand/zustand-utility-hooks";
import { useActiveChatTab } from "@/zustand/selectors";
import { APIProviders } from "shared";

export const useChatModelControl = () => {
    // 1) Find the active chat tab ID
    const { id: chatActiveTabId } = useActiveChatTab()
    // 2) Single-field read
    const { data: provider = "openai" } =
        useChatTabField(chatActiveTabId ?? "", "provider");
    const { data: model = "gpt-4o" } =
        useChatTabField(chatActiveTabId ?? "", "model");

    // 3) Single-field updaters
    const { mutate: setProviderField } = useChatTabField(
        chatActiveTabId ?? "",
        "provider"
    );
    const { mutate: setModelField } = useChatTabField(
        chatActiveTabId ?? "",
        "model"
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