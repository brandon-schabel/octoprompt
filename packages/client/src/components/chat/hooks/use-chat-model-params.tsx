import { useChatTabField } from "@/zustand/zustand-utility-hooks";
import { ChatModelSettings, chatModelSettingsSchema, modelsTempNotAllowed } from "shared/index";

type ModelParamMutationFn = (value: number) => void;
type StreamMutationFn = (value: boolean) => void;

/**
 * This hook will gather each model param from the chat tab.
 * If a field is missing, we provide a default from the Zod schema.
 * Similarly, `mutateX` sets the new value in the global chat tab state.
 */
export function useChatModelParams() {
    // Get the current model
    const { data: modelId = "" } = useChatTabField("model");
    
    // Check if temperature is allowed for this model
    const isTempDisabled = modelsTempNotAllowed.includes(modelId);

    // Each param. If not set yet in global state, use Zod's default.
    // For temperature, if the model doesn't allow it, force it to 1
    const { data: temperatureData = chatModelSettingsSchema.shape.temperature._def.defaultValue() } =
        useChatTabField("temperature");

    const { data: maxTokensData = chatModelSettingsSchema.shape.max_tokens._def.defaultValue() } =
        useChatTabField("max_tokens");

    const { data: topPData = chatModelSettingsSchema.shape.top_p._def.defaultValue() } =
        useChatTabField("top_p");

    const { data: freqPenaltyData = chatModelSettingsSchema.shape.frequency_penalty._def.defaultValue() } =
        useChatTabField("frequency_penalty");

    const { data: presPenaltyData = chatModelSettingsSchema.shape.presence_penalty._def.defaultValue() } =
        useChatTabField("presence_penalty");

    const { data: streamData = chatModelSettingsSchema.shape.stream._def.defaultValue() } =
        useChatTabField("stream");

    // Setters with proper type casting
    const { mutate: setTemperatureRaw } = useChatTabField("temperature");
    const { mutate: setMaxTokensRaw } = useChatTabField("max_tokens");
    const { mutate: setTopPRaw } = useChatTabField("top_p");
    const { mutate: setFreqPenaltyRaw } = useChatTabField("frequency_penalty");
    const { mutate: setPresPenaltyRaw } = useChatTabField("presence_penalty");
    const { mutate: setStreamRaw } = useChatTabField("stream");

    // Wrap the raw mutate functions with proper types
    const setTemperature: ModelParamMutationFn = (value) => {
        // If temperature is not allowed, always set to 1
        if (isTempDisabled) {
            setTemperatureRaw(1);
        } else {
            setTemperatureRaw(value);
        }
    };
    const setMaxTokens: ModelParamMutationFn = (value) => setMaxTokensRaw(value);
    const setTopP: ModelParamMutationFn = (value) => setTopPRaw(value);
    const setFreqPenalty: ModelParamMutationFn = (value) => setFreqPenaltyRaw(value);
    const setPresPenalty: ModelParamMutationFn = (value) => setPresPenaltyRaw(value);
    const setStream: StreamMutationFn = (value) => setStreamRaw(value);

    // For convenience, return them as a single object.
    const settings: ChatModelSettings = {
        temperature: isTempDisabled ? 1 : temperatureData,
        max_tokens: maxTokensData,
        top_p: topPData,
        frequency_penalty: freqPenaltyData,
        presence_penalty: presPenaltyData,
        stream: streamData,
    };

    return {
        settings,
        setTemperature,
        setMaxTokens,
        setTopP,
        setFreqPenalty,
        setPresPenalty,
        setStream,
        isTempDisabled,
    };
}