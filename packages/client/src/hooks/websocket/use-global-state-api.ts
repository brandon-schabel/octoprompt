import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import type {
    GlobalState,
    AppSettings,
    ProjectTabState,
    ChatTabState,
} from "shared/src/global-state/global-state-schema";
import {
    globalStateSchema,
    appSettingsSchema,
    projectTabStateSchema,
    chatTabStateSchema,
} from "shared/src/global-state/global-state-schema";

// Example schema-based validation for server responses:
const fetchGlobalStateSliceSchema = z.object({
    success: z.boolean().default(true),
    key: z.string(),
    value: z.unknown().optional(),
});

// Assume you have a small API utility:
import { useApi } from "../use-api";
import { commonErrorHandler } from "../api/common-mutation-error-handler";

/**
 * Optional:
 * If you want the entire global state in one query (less granular = bigger re-renders):
 */
export function useGetGlobalState() {
    const { api } = useApi();

    return useQuery<GlobalState>({
        queryKey: ["globalState"],
        queryFn: async () => {
            // Example GET /api/global-state returns the entire state
            const resp = await api.request("/api/global-state");
            const data = await resp.json();
            // Validate with the globalStateSchema
            return globalStateSchema.parse(data);
        },
    });
}

/**
 * SETTINGS HOOKS
 * -----------------------------------------------------------------------------
 * Fetch & update the application settings (a sub-slice of GlobalState).
 */
export function useGetSettings() {
    const { api } = useApi();

    return useQuery<AppSettings>({
        queryKey: ["globalState", "settings"],
        queryFn: async () => {
            const resp = await api.request(`/api/global-state?key=settings`);
            const raw = await resp.json();
            // shape: { success: boolean; key: 'settings'; value: unknown }
            const parsed = fetchGlobalStateSliceSchema.parse(raw);
            const validated = appSettingsSchema.parse(parsed.value);
            return validated;
        },
    });
}

export function useSetSettings() {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<
        { success: boolean; key: string; value: AppSettings },
        Error,
        { newSettings: AppSettings },
        { previousSettings?: AppSettings }
    >({
        mutationFn: async ({ newSettings }) => {
            const resp = await api.request("/api/global-state", {
                method: "POST",
                body: { key: "settings", value: newSettings },
            });
            return resp.json();
        },
        onMutate: async ({ newSettings }) => {
            await queryClient.cancelQueries({ queryKey: ["globalState", "settings"] });
            const previousSettings = queryClient.getQueryData<AppSettings>([
                "globalState",
                "settings",
            ]);

            // Optimistically update
            queryClient.setQueryData(["globalState", "settings"], newSettings);

            return { previousSettings };
        },
        onError: (err, variables, context) => {
            if (context?.previousSettings) {
                queryClient.setQueryData(
                    ["globalState", "settings"],
                    context.previousSettings
                );
            }
            commonErrorHandler(err);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["globalState", "settings"] });
        },
    });
}

/**
 * PROJECT TABS HOOKS
 * -----------------------------------------------------------------------------
 * Each project tab has an ID. We store them individually in React Query so that
 * only components looking at a specific tab re-render when that tab changes.
 */
export function useGetProjectTab(tabId: string | null | undefined) {
    const { api } = useApi();

    return useQuery<ProjectTabState>({
        queryKey: ["globalState", "projectTab", tabId],
        queryFn: async () => {
            if (!tabId) {
                throw new Error("No tabId provided to fetch project tab");
            }
            const resp = await api.request(`/api/global-state?key=projectTab&tabId=${tabId}`);
            const raw = await resp.json();
            // shape: { success: boolean; key: 'projectTab'; value: unknown }
            const parsed = fetchGlobalStateSliceSchema.parse(raw);
            // Validate only the sub-slice
            const validated = projectTabStateSchema.parse(parsed.value);
            return validated;
        },
        enabled: Boolean(tabId), // only fetch if tabId is truthy
    });
}

export function useSetProjectTab(tabId: string) {
    // For partial or full updates to an existing project tab
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<
        { success: boolean; key: string; value: ProjectTabState },
        Error,
        { partial: Partial<ProjectTabState> },
        { previousTab?: ProjectTabState }
    >({
        mutationFn: async ({ partial }) => {
            // POST to /api/global-state?key=projectTab&tabId=XYZ
            const resp = await api.request(`/api/global-state?key=projectTab&tabId=${tabId}`, {
                method: "POST",
                body: { partial },
            });
            return resp.json();
        },
        onMutate: async ({ partial }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ["globalState", "projectTab", tabId] });

            // Snapshot current data
            const previousTab = queryClient.getQueryData<ProjectTabState>([
                "globalState",
                "projectTab",
                tabId,
            ]);

            // Optimistic update
            if (previousTab) {
                const updated = { ...previousTab, ...partial };
                queryClient.setQueryData(["globalState", "projectTab", tabId], updated);
            }

            return { previousTab };
        },
        onError: (err, variables, context) => {
            if (context?.previousTab) {
                queryClient.setQueryData(
                    ["globalState", "projectTab", tabId],
                    context.previousTab
                );
            }
            commonErrorHandler(err);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["globalState", "projectTab", tabId] });
        },
    });
}

export function useCreateProjectTab() {
    // For creating a brand-new tab with random ID
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<
        { success: boolean; key: string; tabId: string; value: ProjectTabState },
        Error,
        { initialData: Partial<ProjectTabState> }
    >({
        mutationFn: async ({ initialData }) => {
            // POST /api/global-state?key=createProjectTab
            // server should generate a new tabId
            const resp = await api.request(`/api/global-state?key=createProjectTab`, {
                method: "POST",
                body: { initialData },
            });
            return resp.json();
        },
        onSuccess: (data) => {
            // The server should return { tabId, value: { ... } }
            const { tabId, value } = data;
            // Set the new tab data in the cache
            queryClient.setQueryData(["globalState", "projectTab", tabId], value);
            // Optionally, update a "list of project tab IDs" in the cache
            queryClient.invalidateQueries({ queryKey: ["globalState", "projectTabList"] });
        },
        onError: commonErrorHandler,
    });
}

export function useDeleteProjectTab() {
    // For removing an existing project tab
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<
        { success: boolean; tabId: string },
        Error,
        { tabId: string }
    >({
        mutationFn: async ({ tabId }) => {
            const resp = await api.request(
                `/api/global-state?key=projectTab&tabId=${tabId}`,
                {
                    method: "DELETE",
                }
            );
            return resp.json();
        },
        onSuccess: (data) => {
            // Remove from the query cache so consumers don’t see stale data
            queryClient.removeQueries({ queryKey: ["globalState", "projectTab", data.tabId] });
            // Optionally, revalidate the list of tabs
            queryClient.invalidateQueries({ queryKey: ["globalState", "projectTabList"] });
        },
        onError: commonErrorHandler,
    });
}

/**
 * CHAT TABS HOOKS
 * -----------------------------------------------------------------------------
 * If your chat tabs are similarly keyed by ID, we can do the same pattern:
 */
export function useGetChatTab(tabId: string | null | undefined) {
    const { api } = useApi();

    return useQuery<ChatTabState>({
        queryKey: ["globalState", "chatTab", tabId],
        queryFn: async () => {
            if (!tabId) {
                throw new Error("No tabId provided to fetch chat tab");
            }
            const resp = await api.request(`/api/global-state?key=chatTab&tabId=${tabId}`);
            const raw = await resp.json();
            const parsed = fetchGlobalStateSliceSchema.parse(raw);
            return chatTabStateSchema.parse(parsed.value);
        },
        enabled: Boolean(tabId),
    });
}

export function useSetChatTab(tabId: string) {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<
        { success: boolean; key: string; value: ChatTabState },
        Error,
        { partial: Partial<ChatTabState> },
        { previousTab?: ChatTabState }
    >({
        mutationFn: async ({ partial }) => {
            const resp = await api.request(`/api/global-state?key=chatTab&tabId=${tabId}`, {
                method: "POST",
                body: { partial },
            });
            return resp.json();
        },
        onMutate: async ({ partial }) => {
            await queryClient.cancelQueries({ queryKey: ["globalState", "chatTab", tabId] });
            const previousTab = queryClient.getQueryData<ChatTabState>([
                "globalState",
                "chatTab",
                tabId,
            ]);
            if (previousTab) {
                const updated = { ...previousTab, ...partial };
                queryClient.setQueryData(["globalState", "chatTab", tabId], updated);
            }
            return { previousTab };
        },
        onError: (err, vars, context) => {
            if (context?.previousTab) {
                queryClient.setQueryData(
                    ["globalState", "chatTab", tabId],
                    context.previousTab
                );
            }
            commonErrorHandler(err);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["globalState", "chatTab", tabId] });
        },
    });
}

export function useCreateChatTab() {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<
        { success: boolean; key: string; tabId: string; value: ChatTabState },
        Error,
        { initialData: Partial<ChatTabState> }
    >({
        mutationFn: async ({ initialData }) => {
            const resp = await api.request(`/api/global-state?key=createChatTab`, {
                method: "POST",
                body: { initialData },
            });
            return resp.json();
        },
        onSuccess: (data) => {
            const { tabId, value } = data;
            queryClient.setQueryData(["globalState", "chatTab", tabId], value);
            queryClient.invalidateQueries({ queryKey: ["globalState", "chatTabList"] });
        },
        onError: commonErrorHandler,
    });
}

export function useDeleteChatTab() {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<
        { success: boolean; tabId: string },
        Error,
        { tabId: string }
    >({
        mutationFn: async ({ tabId }) => {
            const resp = await api.request(`/api/global-state?key=chatTab&tabId=${tabId}`, {
                method: "DELETE",
            });
            return resp.json();
        },
        onSuccess: (data) => {
            queryClient.removeQueries({ queryKey: ["globalState", "chatTab", data.tabId] });
            queryClient.invalidateQueries({ queryKey: ["globalState", "chatTabList"] });
        },
        onError: commonErrorHandler,
    });
}