import * as React from 'react'
import { cn } from '../../utils'
import { Badge } from '../core/badge'
import { formatDistanceToNow, format } from 'date-fns'
import { Calendar, Clock, Hash, User, Tag, FileText, Link2 } from 'lucide-react'

export interface MetadataItem {
  /**
   * Unique key for the item
   */
  key: string
  /**
   * Display label
   */
  label: string
  /**
   * Value to display
   */
  value: string | number | boolean | Date | null | undefined
  /**
   * Type of the value for formatting
   * @default "text"
   */
  type?: 'text' | 'number' | 'date' | 'datetime' | 'relative-time' | 'boolean' | 'badge' | 'link' | 'custom'
  /**
   * Icon to display with the item
   */
  icon?: React.ReactNode
  /**
   * Badge variant if type is "badge"
   */
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline'
  /**
   * Custom renderer for the value
   */
  render?: (value: any) => React.ReactNode
  /**
   * Whether to hide this item if value is null/undefined
   * @default true
   */
  hideIfEmpty?: boolean
  /**
   * Tooltip text
   */
  tooltip?: string
  /**
   * Click handler for the item
   */
  onClick?: () => void
  /**
   * URL for link type
   */
  href?: string
  /**
   * Additional className for the item
   */
  className?: string
}

export interface MetadataDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Array of metadata items to display
   */
  items: MetadataItem[]
  /**
   * Layout variant
   * @default "grid"
   */
  layout?: 'grid' | 'list' | 'inline' | 'compact'
  /**
   * Number of columns for grid layout
   * @default 2
   */
  columns?: 1 | 2 | 3 | 4 | 6
  /**
   * Size variant
   * @default "default"
   */
  size?: 'sm' | 'default' | 'lg'
  /**
   * Whether to show icons
   * @default true
   */
  showIcons?: boolean
  /**
   * Whether to show labels
   * @default true
   */
  showLabels?: boolean
  /**
   * Custom separator for inline layout
   * @default "•"
   */
  separator?: string
  /**
   * Whether to add borders between items
   * @default false
   */
  bordered?: boolean
}

const defaultIcons = {
  date: <Calendar className="h-4 w-4" />,
  datetime: <Clock className="h-4 w-4" />,
  'relative-time': <Clock className="h-4 w-4" />,
  number: <Hash className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
  tag: <Tag className="h-4 w-4" />,
  text: <FileText className="h-4 w-4" />,
  link: <Link2 className="h-4 w-4" />
}

const sizeClasses = {
  sm: {
    text: 'text-xs',
    label: 'text-xs',
    icon: 'h-3 w-3',
    gap: 'gap-1'
  },
  default: {
    text: 'text-sm',
    label: 'text-sm',
    icon: 'h-4 w-4',
    gap: 'gap-2'
  },
  lg: {
    text: 'text-base',
    label: 'text-base',
    icon: 'h-5 w-5',
    gap: 'gap-3'
  }
}

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
}

const formatValue = (item: MetadataItem): React.ReactNode => {
  const { value, type = 'text', render, badgeVariant = 'secondary', href } = item

  if (render) {
    return render(value)
  }

  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>
  }

  switch (type) {
    case 'date':
      return format(new Date(value as string | number | Date), 'MMM d, yyyy')
    
    case 'datetime':
      return format(new Date(value as string | number | Date), 'MMM d, yyyy h:mm a')
    
    case 'relative-time':
      return formatDistanceToNow(new Date(value as string | number | Date), { addSuffix: true })
    
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value)
    
    case 'boolean':
      return value ? 'Yes' : 'No'
    
    case 'badge':
      return <Badge variant={badgeVariant}>{String(value)}</Badge>
    
    case 'link':
      return (
        <a
          href={href || '#'}
          className="text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {String(value)}
        </a>
      )
    
    default:
      return String(value)
  }
}

const MetadataItemComponent: React.FC<{
  item: MetadataItem
  size: 'sm' | 'default' | 'lg'
  showIcons: boolean
  showLabels: boolean
  layout: MetadataDisplayProps['layout']
}> = ({ item, size, showIcons, showLabels, layout }) => {
  const sizeConfig = sizeClasses[size]
  const icon = item.icon || defaultIcons[item.type as keyof typeof defaultIcons]
  const formattedValue = formatValue(item)

  if (item.hideIfEmpty !== false && (item.value === null || item.value === undefined)) {
    return null
  }

  const content = (
    <div
      className={cn(
        'flex items-start',
        sizeConfig.gap,
        item.onClick && 'cursor-pointer hover:opacity-80',
        item.className
      )}
      onClick={item.onClick}
      title={item.tooltip}
    >
      {showIcons && icon && (
        <div className={cn('flex-shrink-0 text-muted-foreground', sizeConfig.icon)}>
          {icon}
        </div>
      )}
      
      <div className={cn('flex-1 min-w-0', layout === 'inline' && 'flex items-center gap-1')}>
        {showLabels && (
          <span className={cn('text-muted-foreground', sizeConfig.label, layout !== 'inline' && 'block')}>
            {item.label}
            {layout === 'inline' && ':'}
          </span>
        )}
        <span className={cn('font-medium', sizeConfig.text, layout !== 'inline' && 'block')}>
          {formattedValue}
        </span>
      </div>
    </div>
  )

  return content
}

export const MetadataDisplay = React.forwardRef<HTMLDivElement, MetadataDisplayProps>(
  (
    {
      className,
      items,
      layout = 'grid',
      columns = 2,
      size = 'default',
      showIcons = true,
      showLabels = true,
      separator = '•',
      bordered = false,
      ...props
    },
    ref
  ) => {
    const filteredItems = items.filter(item => 
      item.hideIfEmpty === false || (item.value !== null && item.value !== undefined)
    )

    if (filteredItems.length === 0) {
      return null
    }

    if (layout === 'grid') {
      return (
        <div
          ref={ref}
          className={cn(
            'grid gap-4',
            columnClasses[columns],
            className
          )}
          {...props}
        >
          {filteredItems.map((item) => (
            <div
              key={item.key}
              className={cn(
                bordered && 'pb-4 border-b last:border-b-0'
              )}
            >
              <MetadataItemComponent
                item={item}
                size={size}
                showIcons={showIcons}
                showLabels={showLabels}
                layout={layout}
              />
            </div>
          ))}
        </div>
      )
    }

    if (layout === 'list') {
      return (
        <div
          ref={ref}
          className={cn('space-y-3', className)}
          {...props}
        >
          {filteredItems.map((item) => (
            <div
              key={item.key}
              className={cn(
                bordered && 'pb-3 border-b last:border-b-0'
              )}
            >
              <MetadataItemComponent
                item={item}
                size={size}
                showIcons={showIcons}
                showLabels={showLabels}
                layout={layout}
              />
            </div>
          ))}
        </div>
      )
    }

    if (layout === 'inline') {
      return (
        <div
          ref={ref}
          className={cn('flex flex-wrap items-center gap-3', className)}
          {...props}
        >
          {filteredItems.map((item, index) => (
            <React.Fragment key={item.key}>
              <MetadataItemComponent
                item={item}
                size={size}
                showIcons={showIcons}
                showLabels={showLabels}
                layout={layout}
              />
              {index < filteredItems.length - 1 && (
                <span className="text-muted-foreground">{separator}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )
    }

    if (layout === 'compact') {
      return (
        <div
          ref={ref}
          className={cn('flex flex-wrap gap-2', className)}
          {...props}
        >
          {filteredItems.map((item) => (
            <Badge
              key={item.key}
              variant="secondary"
              className={cn('gap-1', sizeClasses[size].text)}
            >
              {showIcons && item.icon && (
                <span className={sizeClasses[size].icon}>
                  {item.icon}
                </span>
              )}
              {showLabels && (
                <span className="text-muted-foreground">
                  {item.label}:
                </span>
              )}
              <span className="font-medium">{formatValue(item)}</span>
            </Badge>
          ))}
        </div>
      )
    }

    return null
  }
)

MetadataDisplay.displayName = 'MetadataDisplay'