import { useChatTabField, useChatTabFieldUpdater } from "@/websocket-state/chat-tab-hooks";
import { useActiveChatTab } from "@/websocket-state/hooks/selectors/websocket-selector-hoooks";
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
    const { mutate: setProviderField } = useChatTabFieldUpdater(
        chatActiveTabId ?? "",
        "provider"
    );
    const { mutate: setModelField } = useChatTabFieldUpdater(
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