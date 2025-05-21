import { HelpCircle, LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@ui'
import { useSelectSetting } from '@/hooks/use-kv-local-storage'
type InfoTooltipProps = {
  children: ReactNode
  icon?: LucideIcon
  className?: string
}

export const OctoTooltip = ({ children, icon: Icon = HelpCircle, className }: InfoTooltipProps) => {
  const hideInformationalTooltips = useSelectSetting('hideInformationalTooltips')

  if (hideInformationalTooltips) return null

  return (
    <Popover>
      <PopoverTrigger>
        <Icon className='h-4 w-4 text-muted-foreground' />
      </PopoverTrigger>
      <PopoverContent className={className}>{children}</PopoverContent>
    </Popover>
  )
}
