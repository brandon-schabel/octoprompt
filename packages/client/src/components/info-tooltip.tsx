import { HelpCircle, LucideIcon } from "lucide-react"
import { ReactNode } from "react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useGlobalStateCore } from "./global-state/global-helper-hooks"

type InfoTooltipProps = {
    children: ReactNode
    icon?: LucideIcon
    className?: string
}

export const InfoTooltip = ({ children, icon: Icon = HelpCircle, className }: InfoTooltipProps) => {
    const { state } = useGlobalStateCore()
    const hideInformationalTooltips = state?.settings?.hideInformationalTooltips ?? false

    if (hideInformationalTooltips) return null

    return (
        <Popover>
            <PopoverTrigger>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent className={className}>
                {children}
            </PopoverContent>
        </Popover>
    )
}