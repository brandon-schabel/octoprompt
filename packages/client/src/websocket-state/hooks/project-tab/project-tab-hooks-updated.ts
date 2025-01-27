import {
    type ProjectTabState,
} from "shared"
import { useUpdateProjectTabState } from "../updaters/websocket-updater-hooks"
import { useGenericField } from "../helpers/use-generic-field"
import { useProjectTab } from "../selectors/websocket-selectors"


// TOOD: this now uses the generic field hook which comes to readers/writers from the store, so these need to be implemented in the pages
export function useProjectTabField<K extends keyof ProjectTabState>(tabId: string, fieldKey: K) {
    const projectTab = useProjectTab(tabId)
    const updateProjectTabState = useUpdateProjectTabState(tabId)

    return useGenericField<ProjectTabState, K>({
        queryKey: ["globalState", "projectTab", tabId],
        fieldKey,
        currentRecord: projectTab,
        enabled: Boolean(tabId),
        onUpdate: (updater) => updateProjectTabState(updater),
    })
}



export { useProjectTabField as useProjectTabFieldGeneric }
