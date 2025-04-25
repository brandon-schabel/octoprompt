import { useSettings } from '@/hooks/api/global-state/selectors';
import { useUpdateSettings } from '@/hooks/api/global-state/updaters';
import { useCallback, useMemo } from 'react';
import { modelsTempNotAllowed } from 'shared';

type ModelParamMutationFn = (value: number) => void;
type StreamMutationFn = (value: boolean) => void;

export interface ModelSettings {
    temperature: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
    max_tokens: number;
    stream: boolean;
    model?: string;
    provider?: string;
}

export function useChatModelParams() {
    const settings = useSettings();
    const updateSettings = useUpdateSettings();

    const {
        temperature,
        max_tokens,
        top_p,
        frequency_penalty,
        presence_penalty,
        stream,
        model,
        provider,
    } = settings;

    const isTempDisabled = useMemo(() => {
        if (!model) return false;
        return modelsTempNotAllowed.some(m => model.includes(m));
    }, [model]);

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

    const modelSettings: ModelSettings = useMemo(() => ({
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
        max_tokens,
        stream,
        model,
        provider,
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
        settings: modelSettings,
        setTemperature,
        setMaxTokens,
        setTopP,
        setFreqPenalty,
        setPresPenalty,
        setStream,
        isTempDisabled,
    };
}