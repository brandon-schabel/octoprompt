import { AppSettings } from "shared/index"
import { useSettings } from "../selectors/websocket-selectors"
import { useUpdateSettings } from "../updaters/websocket-updater-hooks"
import { useGenericField } from "../helpers/use-generic-field"


// TOOD: this now uses the generic field hook which comes to readers/writers from the store, so these need to be implemented in the pages
export function useSettingsField<K extends keyof AppSettings>(fieldKey: K) {
    const settings = useSettings()
    const updateSettings = useUpdateSettings()

    return useGenericField<AppSettings, K>({
        queryKey: ["globalState", "settings"],
        fieldKey,
        currentRecord: settings,
        // If there's no dynamic "id" for settings, you can omit "enabled" or pass `true`
        onUpdate: (updater) => updateSettings(updater),
    })
}