import { HelpCircle, LucideIcon } from "lucide-react"
import { ReactNode } from "react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSettings } from "@/websocket-state/hooks/selectors/websocket-selector-hoooks"

type InfoTooltipProps = {
    children: ReactNode
    icon?: LucideIcon
    className?: string
}

export const InfoTooltip = ({ children, icon: Icon = HelpCircle, className }: InfoTooltipProps) => {
    const settings = useSettings()
    const hideInformationalTooltips = settings?.hideInformationalTooltips ?? false

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