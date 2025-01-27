import { useQuery } from "@tanstack/react-query"
import type { AppSettings } from "shared"
import { useUpdateSettings } from "./hooks/updaters/websocket-updater-hooks"
import { useCallback } from "react"
import { useSettings } from "./hooks/selectors/websocket-selector-hoooks"

/**
 * Subscribes to exactly one field in the global app settings.
 * If that field doesn't change, your component won't re-render
 * even if other settings fields are updated.
 */
export function useSettingsField<K extends keyof AppSettings>(key: K) {
    return useQuery<AppSettings, unknown, AppSettings[K]>({
        queryKey: ["globalState", "settings"],
        select: (fullSettings) => fullSettings?.[key],
    })
}

/**
 * Returns an updater that can mutate exactly one field
 * in the global app settings.
 */
export function useSettingsFieldUpdater<K extends keyof AppSettings>(key: K) {
    const updateSettings = useUpdateSettings()
    const settings = useSettings()

    const mutate = useCallback(
        (
            valueOrFn:
                | AppSettings[K]
                | ((prevValue: AppSettings[K]) => AppSettings[K])
        ) => {
            if (!settings) return
            updateSettings((prev) => {
                const currentValue = prev[key]
                const newValue =
                    typeof valueOrFn === "function"
                        ? (valueOrFn as (prevVal: AppSettings[K]) => AppSettings[K])(
                            currentValue
                        )
                        : valueOrFn
                return { [key]: newValue }
            })
        },
        [settings, key, updateSettings]
    )

    return { mutate }
}