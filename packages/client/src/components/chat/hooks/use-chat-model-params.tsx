import { useSettings } from '@/hooks/api/global-state/selectors';
import { useUpdateSettings } from '@/hooks/api/global-state/updaters';
import { AiSdkOptions } from '@/hooks/generated';
import { useCallback, useMemo } from 'react';
import { modelsTempNotAllowed } from 'shared';

type ModelParamMutationFn = (value: number) => void;

export function useChatModelParams() {
    const settings = useSettings();
    const updateSettings = useUpdateSettings();

    const {
        temperature,
        max_tokens,
        top_p,
        frequency_penalty,
        presence_penalty,
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


    const modelSettings: AiSdkOptions = useMemo(() => ({
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
        max_tokens,
        model,
        provider,
    }), [
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
        max_tokens,
        model,
        provider
    ]);

    return {
        settings: modelSettings as AiSdkOptions & {
            provider: string;
        },
        setTemperature,
        setMaxTokens,
        setTopP,
        setFreqPenalty,
        setPresPenalty,
        isTempDisabled,
    };
}