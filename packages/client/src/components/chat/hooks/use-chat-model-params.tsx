import { useSettings } from '@/zustand/selectors'; // Use global settings selector
import { useUpdateSettings } from '@/zustand/updaters'; // Use global settings updater
import { useCallback, useMemo } from 'react';
import { modelsTempNotAllowed } from 'shared'; // Keep this utility

// Define parameter types
type ModelParamMutationFn = (value: number) => void;
type StreamMutationFn = (value: boolean) => void;

// Combined model settings type (matches AppSettings relevant fields)
export interface ModelSettings {
    temperature: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
    max_tokens: number;
    stream: boolean;
    model?: string; // Optional: Already part of AppSettings
    provider?: string; // Optional: Already part of AppSettings
}

/**
 * A hook that provides global chat model parameters from AppSettings
 * with efficient updates.
 */
export function useChatModelParams() {
    const settings = useSettings();
    const updateSettings = useUpdateSettings();

    // Extract values directly from global settings
    const {
        temperature,
        max_tokens,
        top_p,
        frequency_penalty,
        presence_penalty,
        stream,
        model, // Get model for isTempDisabled check
        provider,
    } = settings;

    // Check if temperature should be disabled based on model
    const isTempDisabled = useMemo(() => {
        if (!model) return false;
        return modelsTempNotAllowed.some(m => model.includes(m));
    }, [model]);

    // Define all setter functions targeting global settings
    const setTemperature: ModelParamMutationFn = useCallback((value) => {
        if (isTempDisabled) return;
        updateSettings({ temperature: value });
    }, [isTempDisabled, updateSettings]);

    const setMaxTokens: ModelParamMutationFn = useCallback((value) => {
        updateSettings({ max_tokens: value });
    }, [updateSettings]);

    const setTopP: ModelParamMutationFn = useCallback((value) => {
        updateSettings({ top_p: value });
    }, [updateSettings]);

    const setFreqPenalty: ModelParamMutationFn = useCallback((value) => {
        updateSettings({ frequency_penalty: value });
    }, [updateSettings]);

    const setPresPenalty: ModelParamMutationFn = useCallback((value) => {
        updateSettings({ presence_penalty: value });
    }, [updateSettings]);

    const setStream: StreamMutationFn = useCallback((value) => {
        updateSettings({ stream: value });
    }, [updateSettings]);

    // Combine all settings into a single settings object
    // Memoize to prevent re-renders when global settings haven't changed relevant fields
    const modelSettings: ModelSettings = useMemo(() => ({
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
        max_tokens,
        stream,
        model, // Include for reference if needed
        provider, // Include for reference if needed
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
        settings: modelSettings, // Return the derived settings object
        setTemperature,
        setMaxTokens,
        setTopP,
        setFreqPenalty,
        setPresPenalty,
        setStream,
        isTempDisabled,
    };
}