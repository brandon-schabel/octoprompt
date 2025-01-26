import { useGlobalState } from "@/components/global-state/use-global-state";


export const useActiveProjectTab = () => {
    const { data: state } = useGlobalState();

    const tabData = state?.projectActiveTabId ? state?.projectTabs[state?.projectActiveTabId] : null

    return {
        id: state?.projectActiveTabId,
        tabData
    }
}