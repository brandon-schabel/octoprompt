'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type ComboboxOption = {
  value: string
  label: string
}

interface PromptlianoComboboxProps {
  options: ComboboxOption[]
  value: string | null // Allow null for no selection
  onValueChange: (value: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  popoverClassName?: string
  disabled?: boolean
}

export function PromptlianoCombobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  className,
  popoverClassName,
  disabled
}: PromptlianoComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedLabel = value ? options.find((option) => option.value === value)?.label : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className={cn('w-[200px] justify-between', className, !value && 'text-muted-foreground')}
          disabled={disabled}
        >
          <span className='truncate'>{selectedLabel}</span>
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-[200px] p-0', popoverClassName)}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No option found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  disabled={disabled}
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    const selectedOption = options.find((opt) => opt.value === currentValue)

                    onValueChange(currentValue === value ? null : selectedOption ? selectedOption.value : null)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
