import { useMutation, useQuery } from '@tanstack/react-query';
import { useApi } from '../../hooks/use-api';
import { commonErrorHandler } from '../../hooks/api/common-mutation-error-handler';

// Types from create-gen-ui-component.tsx
type GenerateUIResponse = {
    seedId: string
    output: {
        type: "ui_generation"
        html: string
        css: string
        data?: unknown
    }
}

type GenerateUIArgs = {
    designContract: string
    componentName?: string
    generateData?: boolean
    dataSchema?: string
    seedId?: string
    styleDirectives?: string
}

// Query Keys
const UI_GEN_KEYS = {
    all: ['ui-gen'] as const,
    snapshot: (seedId: string) => [...UI_GEN_KEYS.all, 'snapshot', seedId] as const,
} as const;

// Hooks for UI Generation APIs
export const useGenerateUI = () => {
    const { api } = useApi();
    return useMutation<GenerateUIResponse, Error, GenerateUIArgs>({
        mutationFn: (args) => api.request("/api/ui-gen/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: args,
        }).then(resp => {
            if (!resp.ok) {
                throw new Error(`UI Generation failed: ${resp.status}`);
            }
            return resp.json();
        }),
        onError: commonErrorHandler
    });
};

export const useUndoUI = () => {
    const { api } = useApi();
    return useMutation<any, Error, string>({
        mutationFn: (seedId) => api.request(`/api/ui-gen/undo?seedId=${seedId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        }).then(resp => {
            if (!resp.ok) throw new Error("Undo failed");
            return resp.json();
        }),
        onError: commonErrorHandler
    });
};

export const useRedoUI = () => {
    const { api } = useApi();
    return useMutation<any, Error, string>({
        mutationFn: (seedId) => api.request(`/api/ui-gen/redo?seedId=${seedId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        }).then(resp => {
            if (!resp.ok) throw new Error("Redo failed");
            return resp.json();
        }),
        onError: commonErrorHandler
    });
};

export const useLockUI = () => {
    const { api } = useApi();
    return useMutation<any, Error, string>({
        mutationFn: (seedId) => api.request(`/api/ui-gen/lock?seedId=${seedId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        }).then(resp => {
            if (!resp.ok) throw new Error("Lock failed");
            return resp.json();
        }),
        onError: commonErrorHandler
    });
};

export const useUISnapshot = (seedId: string) => {
    const { api } = useApi();
    return useQuery({
        queryKey: UI_GEN_KEYS.snapshot(seedId),
        queryFn: () => api.request(`/api/ui-gen/snapshot?seedId=${seedId}`).then(resp => {
            if (!resp.ok) throw new Error("Snapshot fetch failed");
            return resp.json();
        }),
        enabled: !!seedId,
    });
};
