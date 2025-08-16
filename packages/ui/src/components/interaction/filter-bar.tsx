import * as React from 'react'
import { cn } from '../../utils'
import { Button } from '../core/button'
import { Badge } from '../core/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../core/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '../core/popover'
import { Filter, X, ChevronDown, RotateCcw } from 'lucide-react'
import { ScrollArea } from '../data/scroll-area'
import { Checkbox } from '../core/checkbox'
import { Label } from '../core/label'
import { Separator } from '../core/separator'

export interface FilterOption {
  value: string
  label: string
  icon?: React.ReactNode
}

export interface FilterDefinition {
  id: string
  label: string
  type: 'select' | 'multi-select' | 'boolean'
  options?: FilterOption[]
  icon?: React.ReactNode
}

export interface FilterValue {
  [key: string]: string | string[] | boolean | undefined
}

export interface FilterBarProps {
  /**
   * Array of filter definitions
   */
  filters: FilterDefinition[]
  /**
   * Current filter values
   */
  values: FilterValue
  /**
   * Callback when filter values change
   */
  onChange: (values: FilterValue) => void
  /**
   * Callback when filters are reset
   */
  onReset?: () => void
  /**
   * Whether to show the filter icon
   * @default true
   */
  showIcon?: boolean
  /**
   * Whether to show the reset button when filters are active
   * @default true
   */
  showReset?: boolean
  /**
   * Custom className for the container
   */
  className?: string
  /**
   * Size variant for the filters
   * @default "default"
   */
  size?: 'sm' | 'default'
  /**
   * Whether to collapse filters on mobile
   * @default true
   */
  collapsible?: boolean
}

const FilterItem: React.FC<{
  filter: FilterDefinition
  value: string | string[] | boolean | undefined
  onChange: (value: string | string[] | boolean | undefined) => void
  size?: 'sm' | 'default'
}> = ({ filter, value, onChange, size = 'default' }) => {
  if (filter.type === 'select') {
    return (
      <Select value={value as string} onValueChange={onChange}>
        <SelectTrigger className={cn(
          'min-w-[120px]',
          size === 'sm' && 'h-8 text-sm'
        )}>
          {filter.icon && <span className="mr-2">{filter.icon}</span>}
          <SelectValue placeholder={filter.label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All</SelectItem>
          {filter.options?.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                {option.icon}
                {option.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (filter.type === 'multi-select') {
    const selectedValues = (value as string[]) || []
    const selectedCount = selectedValues.length

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size={size}
            className={cn(
              'min-w-[120px] justify-between',
              selectedCount > 0 && 'border-primary'
            )}
          >
            <span className="flex items-center gap-2">
              {filter.icon}
              {filter.label}
              {selectedCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  {selectedCount}
                </Badge>
              )}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <div className="p-2">
            <div className="text-sm font-medium p-2">{filter.label}</div>
            <Separator className="my-2" />
            <ScrollArea className="h-48">
              <div className="space-y-2 p-2">
                {filter.options?.map((option) => {
                  const isChecked = selectedValues.includes(option.value)
                  return (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${filter.id}-${option.value}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onChange([...selectedValues, option.value])
                          } else {
                            onChange(selectedValues.filter(v => v !== option.value))
                          }
                        }}
                      />
                      <Label
                        htmlFor={`${filter.id}-${option.value}`}
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        {option.icon}
                        {option.label}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  if (filter.type === 'boolean') {
    return (
      <Button
        variant={value ? 'default' : 'outline'}
        size={size}
        onClick={() => onChange(!value)}
        className="min-w-[100px]"
      >
        <span className="flex items-center gap-2">
          {filter.icon}
          {filter.label}
        </span>
      </Button>
    )
  }

  return null
}

export const FilterBar = React.forwardRef<HTMLDivElement, FilterBarProps>(
  (
    {
      filters,
      values,
      onChange,
      onReset,
      showIcon = true,
      showReset = true,
      className,
      size = 'default',
      collapsible = true
    },
    ref
  ) => {
    const [isCollapsed, setIsCollapsed] = React.useState(false)

    const handleFilterChange = React.useCallback(
      (filterId: string, value: string | string[] | boolean | undefined) => {
        onChange({
          ...values,
          [filterId]: value === '_all' ? undefined : value
        })
      },
      [values, onChange]
    )

    const handleReset = React.useCallback(() => {
      onChange({})
      onReset?.()
    }, [onChange, onReset])

    const hasActiveFilters = React.useMemo(() => {
      return Object.entries(values).some(([_, value]) => {
        if (Array.isArray(value)) return value.length > 0
        return value !== undefined && value !== '_all' && value !== false
      })
    }, [values])

    const activeFilterCount = React.useMemo(() => {
      return Object.entries(values).filter(([_, value]) => {
        if (Array.isArray(value)) return value.length > 0
        return value !== undefined && value !== '_all' && value !== false
      }).length
    }, [values])

    if (collapsible && isCollapsed) {
      return (
        <div ref={ref} className={cn('flex items-center gap-2', className)}>
          <Button
            variant="outline"
            size={size}
            onClick={() => setIsCollapsed(false)}
            className={cn(
              'gap-2',
              hasActiveFilters && 'border-primary'
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-wrap items-center gap-2',
          className
        )}
      >
        {showIcon && (
          <div className="flex items-center text-muted-foreground">
            <Filter className="h-4 w-4" />
          </div>
        )}

        {filters.map((filter) => (
          <FilterItem
            key={filter.id}
            filter={filter}
            value={values[filter.id]}
            onChange={(value) => handleFilterChange(filter.id, value)}
            size={size}
          />
        ))}

        {showReset && hasActiveFilters && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="ghost"
              size={size}
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </>
        )}

        {collapsible && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(true)}
            className="ml-auto lg:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }
)

FilterBar.displayName = 'FilterBar'