// packages/client/src/global-state-store/hooks/useZustandGenericField.ts
import { useCallback } from "react"
import { AppSettings, ChatTabState, ProjectTabState } from "shared/index"
import { useGlobalStateStore } from "./global-state-store"
import * as themes from "react-syntax-highlighter/dist/esm/styles/hljs"

/**
 * A simplified, reusable hook for reading & writing
 * a single field on a record stored in Zustand.
 */
export function useZustandGenericField<T extends object, K extends keyof T>(
    record: T | undefined,
    fieldKey: K,
    updateFn: (partial: Partial<T>) => void,
    options?: { enabled?: boolean }
) {
    const { enabled = true } = options ?? {}

    // Basic "loading" heuristic: if `enabled` is false or record is undefined, call it loading
    const isLoading = !enabled || !record

    const data: T[K] | undefined = record ? record[fieldKey] : undefined

    /**
     * mutate: sets the field to a new value (or uses a function callback).
     */
    const mutate = useCallback(
        (valueOrFn: T[K] | ((prevVal: T[K]) => T[K])) => {
            if (!record) return
            const oldVal = record[fieldKey]
            const newVal =
                typeof valueOrFn === "function"
                    ? (valueOrFn as (prev: T[K]) => T[K])(oldVal)
                    : valueOrFn
            updateFn({ [fieldKey]: newVal } as unknown as Partial<T>)
        },
        [record, fieldKey, updateFn]
    )

    return {
        data,
        isLoading,
        mutate,
    }
}

export function useProjectTabField<K extends keyof ProjectTabState>(
    tabId: string,
    fieldKey: K
) {
    const tab = useGlobalStateStore((s) =>
        tabId ? s.projectTabs[tabId] : undefined
    )
    const updateProjectTab = useGlobalStateStore((s) => s.updateProjectTab)

    return useZustandGenericField<ProjectTabState, K>(
        tab,
        fieldKey,
        // The partial update function
        (partial) => updateProjectTab(tabId, partial),
        { enabled: Boolean(tabId) }
    )
}

export function useChatTabField<K extends keyof ChatTabState>(
    tabId: string,
    fieldKey: K
) {
    const chatTab = useGlobalStateStore((s) =>
        tabId ? s.chatTabs[tabId] : undefined
    )
    const updateChatTab = useGlobalStateStore((s) => s.updateChatTab)

    return useZustandGenericField<ChatTabState, K>(
        chatTab,
        fieldKey,
        (partial) => updateChatTab(tabId, partial),
        { enabled: Boolean(tabId) }
    )
}

export function useSettingsField<K extends keyof AppSettings>(fieldKey: K) {
    // Some apps have just one `settings` object in Zustand:
    const settings = useGlobalStateStore((s) => s.settings)
    const setSettings = useGlobalStateStore((s) => s.setSettings)

    return useZustandGenericField<AppSettings, K>(
        settings,
        fieldKey,
        (partial) => setSettings(partial),
        { enabled: true } // or some condition
    )
}

export const useThemeSettings = () => {
    const { data: theme = 'dark' } = useSettingsField('theme')
    const isDarkMode = theme === 'dark'
    const { data: codeThemeDark = 'atomOneDark' } = useSettingsField('codeThemeDark')
    const { data: codeThemeLight = 'atomOneLight' } = useSettingsField('codeThemeLight')

    // @ts-ignore
    const selectedTheme = isDarkMode ? themes[codeThemeDark] : themes[codeThemeLight]

    return {
        selectedTheme,
        isDarkMode,
        codeThemeDark,
        codeThemeLight,
    } as const
}