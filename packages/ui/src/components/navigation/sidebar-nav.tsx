import React from 'react'
import { cn } from '../../utils'
import { Button } from '../core/button'
import { Badge } from '../core/badge'
import { ScrollArea } from '../data/scroll-area'
import { type LucideIcon } from 'lucide-react'

export interface SidebarNavItem<T extends string = string> {
  id: T
  label: string
  icon: LucideIcon
  description?: string
  enabled?: boolean
  badge?: string | number | React.ReactNode
  className?: string
  variant?: 'default' | 'compact' | 'detailed'
}

export interface SidebarNavProps<T extends string = string> {
  items: SidebarNavItem<T>[]
  activeItem: T
  onItemChange: (item: T) => void
  header?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  itemClassName?: string
  variant?: 'default' | 'compact' | 'detailed'
  orientation?: 'vertical' | 'horizontal'
}

export function SidebarNav<T extends string = string>({
  items,
  activeItem,
  onItemChange,
  header,
  footer,
  className,
  itemClassName,
  variant = 'default',
  orientation = 'vertical'
}: SidebarNavProps<T>) {
  const isHorizontal = orientation === 'horizontal'
  
  const renderNavItem = (item: SidebarNavItem<T>) => {
    const Icon = item.icon
    const isActive = activeItem === item.id
    const isDisabled = item.enabled === false
    const itemVariant = item.variant || variant

    return (
      <Button
        key={item.id}
        variant={isActive ? 'secondary' : 'ghost'}
        className={cn(
          'w-full justify-start gap-3',
          itemVariant === 'compact' ? 'h-9 py-2 px-3' : 'h-auto py-3 px-3',
          isActive && 'bg-secondary',
          isDisabled && 'opacity-50 cursor-not-allowed',
          item.className,
          itemClassName
        )}
        onClick={() => !isDisabled && onItemChange(item.id)}
        disabled={isDisabled}
      >
        <Icon className={cn(
          'shrink-0',
          itemVariant === 'compact' ? 'h-4 w-4' : 'h-4 w-4'
        )} />
        
        {itemVariant !== 'compact' && (
          <div className='flex flex-col items-start text-left flex-1'>
            <div className='flex items-center gap-2 w-full'>
              <span className='text-sm font-medium'>{item.label}</span>
              {item.badge && (
                <div className='ml-auto'>
                  {typeof item.badge === 'string' || typeof item.badge === 'number' ? (
                    <Badge variant='secondary' className='text-xs px-1.5 py-0'>
                      {item.badge}
                    </Badge>
                  ) : (
                    item.badge
                  )}
                </div>
              )}
            </div>
            {item.description && itemVariant === 'detailed' && (
              <span className='text-xs text-muted-foreground'>
                {item.description}
              </span>
            )}
          </div>
        )}
        
        {itemVariant === 'compact' && item.badge && (
          <div className='ml-auto'>
            {typeof item.badge === 'string' || typeof item.badge === 'number' ? (
              <Badge variant='secondary' className='text-xs px-1 py-0 h-5'>
                {item.badge}
              </Badge>
            ) : (
              item.badge
            )}
          </div>
        )}
      </Button>
    )
  }

  const navContent = (
    <>
      {header && (
        <div className={cn(
          'mb-2',
          isHorizontal ? 'px-2' : 'px-2 pb-2 border-b'
        )}>
          {header}
        </div>
      )}
      
      <div className={cn(
        'gap-1',
        isHorizontal ? 'flex flex-row px-2' : 'flex flex-col p-2'
      )}>
        {items.map(renderNavItem)}
      </div>
      
      {footer && (
        <div className={cn(
          'mt-auto',
          isHorizontal ? 'px-2' : 'px-2 pt-2 border-t'
        )}>
          {footer}
        </div>
      )}
    </>
  )

  if (isHorizontal) {
    return (
      <div className={cn('flex items-center', className)}>
        {navContent}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {navContent}
    </div>
  )
}

// Specialized variant for scrollable navigation with sections
export interface SidebarNavSection<T extends string = string> {
  title?: string
  items: SidebarNavItem<T>[]
  collapsible?: boolean
  defaultExpanded?: boolean
}

export interface SectionedSidebarNavProps<T extends string = string>
  extends Omit<SidebarNavProps<T>, 'items' | 'onItemChange'> {
  sections: SidebarNavSection<T>[]
  showSectionTitles?: boolean
  onItemClick?: (item: any) => void
  onItemChange?: (item: T) => void
}

export function SectionedSidebarNav<T extends string = string>({
  sections,
  activeItem,
  onItemChange,
  onItemClick,
  header,
  footer,
  className,
  itemClassName,
  variant = 'default',
  showSectionTitles = true
}: SectionedSidebarNavProps<T>) {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {header && (
        <div className='px-2 pb-2 border-b'>
          {header}
        </div>
      )}
      
      <ScrollArea className='flex-1'>
        <div className='p-2 space-y-4'>
          {sections.map((section, index) => (
            <div key={index}>
              {showSectionTitles && section.title && (
                <div className='text-xs font-medium text-muted-foreground px-3 py-2 group-data-[collapsible=icon]:hidden'>
                  {section.title}
                </div>
              )}
              <div className='space-y-1'>
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = (item as any).isActive !== undefined ? (item as any).isActive : activeItem === item.id
                  const isDisabled = item.enabled === false
                  const itemVariant = item.variant || variant

                  return (
                    <Button
                      key={item.id}
                      variant={isActive ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full justify-start gap-3 group-data-[collapsible=icon]:justify-center',
                        itemVariant === 'compact' ? 'h-9 py-2 px-3' : 'h-auto py-3 px-3',
                        isActive && 'bg-secondary',
                        isDisabled && 'opacity-50 cursor-not-allowed',
                        item.className,
                        itemClassName
                      )}
                      onClick={() => {
                        if (isDisabled) return
                        if (onItemClick) {
                          onItemClick(item)
                        } else if (onItemChange) {
                          onItemChange(item.id)
                        }
                      }}
                      disabled={isDisabled}
                      title={item.label} // Add tooltip for collapsed state
                    >
                      <Icon className='h-4 w-4 shrink-0' />
                      
                      <div className='flex flex-col items-start text-left flex-1 group-data-[collapsible=icon]:hidden'>
                        <div className='flex items-center gap-2 w-full'>
                          <span className='text-sm font-medium'>{item.label}</span>
                          {item.badge && (
                            <div className='ml-auto'>
                              {typeof item.badge === 'string' || typeof item.badge === 'number' ? (
                                <Badge variant='secondary' className='text-xs px-1.5 py-0'>
                                  {item.badge}
                                </Badge>
                              ) : (
                                item.badge
                              )}
                            </div>
                          )}
                        </div>
                        {item.description && itemVariant === 'detailed' && (
                          <span className='text-xs text-muted-foreground'>
                            {item.description}
                          </span>
                        )}
                      </div>
                    </Button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      {footer && (
        <div className='px-2 pt-2 border-t'>
          {footer}
        </div>
      )}
    </div>
  )
}
