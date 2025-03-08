import { useChatTabField } from '@/zustand/zustand-utility-hooks';
import { useActiveChatTab } from '@/zustand/selectors';
import { useCallback, useMemo } from 'react';
import { modelsTempNotAllowed } from 'shared';

// Define parameter types
type ModelParamMutationFn = (value: number) => void;
type StreamMutationFn = (value: boolean) => void;

// Combined model settings type
export interface ModelSettings {
    temperature: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
    max_tokens: number;
    stream: boolean;
    model?: string; // Optional since it might be undefined initially
    provider?: string; // Optional since it might be undefined initially
}

/**
 * A hook that provides all chat model parameters in a single interface
 * with efficient updates and cache invalidation protection.
 */
export function useChatModelParams() {
    // Get the active chat tab to determine context
    const { id: chatTabIdOrNull } = useActiveChatTab();
    
    // Convert from string | null to string | undefined as required by useChatTabField
    const chatTabId = chatTabIdOrNull || undefined;
    
    // Get individual model parameter fields
    // Each useChatTabField call returns { data, isLoading, mutate }
    const temperatureField = useChatTabField('temperature', chatTabId);
    const maxTokensField = useChatTabField('max_tokens', chatTabId);
    const topPField = useChatTabField('top_p', chatTabId);
    const frequencyPenaltyField = useChatTabField('frequency_penalty', chatTabId);
    const presencePenaltyField = useChatTabField('presence_penalty', chatTabId);
    const streamField = useChatTabField('stream', chatTabId);
    const modelField = useChatTabField('model', chatTabId);
    const providerField = useChatTabField('provider', chatTabId);
    
    // Extract values and setters
    const temperature = temperatureField.data ?? 0.7; // Default values if undefined
    const max_tokens = maxTokensField.data ?? 2048;
    const top_p = topPField.data ?? 0.95;
    const frequency_penalty = frequencyPenaltyField.data ?? 0;
    const presence_penalty = presencePenaltyField.data ?? 0;
    const stream = streamField.data ?? true;
    const model = modelField.data;
    const provider = providerField.data;
    
    // Check if temperature should be disabled based on model
    const isTempDisabled = useMemo(() => {
        if (!model) return false;
        return modelsTempNotAllowed.some(m => model.includes(m));
    }, [model]);
    
    // Define all setter functions with consistent types
    const setTemperature: ModelParamMutationFn = useCallback((value) => {
        if (isTempDisabled) return; // Do nothing if temp is disabled for this model
        temperatureField.mutate(value);
    }, [isTempDisabled, temperatureField]);
    
    const setMaxTokens: ModelParamMutationFn = useCallback((value) => {
        maxTokensField.mutate(value);
    }, [maxTokensField]);
    
    const setTopP: ModelParamMutationFn = useCallback((value) => {
        topPField.mutate(value);
    }, [topPField]);
    
    const setFreqPenalty: ModelParamMutationFn = useCallback((value) => {
        frequencyPenaltyField.mutate(value);
    }, [frequencyPenaltyField]);
    
    const setPresPenalty: ModelParamMutationFn = useCallback((value) => {
        presencePenaltyField.mutate(value);
    }, [presencePenaltyField]);
    
    const setStream: StreamMutationFn = useCallback((value) => {
        streamField.mutate(value);
    }, [streamField]);
    
    // Combine all settings into a single settings object 
    // Memoize to prevent re-renders when nothing has changed
    const settings: ModelSettings = useMemo(() => ({
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
        max_tokens,
        stream,
        model,
        provider
    }), [
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
        max_tokens,
        stream,
        model,
        provider
    ]);
    
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