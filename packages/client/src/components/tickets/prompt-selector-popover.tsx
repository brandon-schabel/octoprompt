import React, { useState, useMemo } from 'react'
import { MessageSquare, Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@promptliano/ui'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@promptliano/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@promptliano/ui'
import { Checkbox } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { useGetProjectPrompts } from '@/hooks/api/use-prompts-api'
import { Skeleton } from '@promptliano/ui'
import type { Prompt } from '@promptliano/schemas'

interface PromptSelectorPopoverProps {
  currentPromptIds?: number[]
  onPromptsSelect: (promptIds: number[]) => void
  projectId: number
  triggerClassName?: string
  disabled?: boolean
  placeholder?: string
}

export function PromptSelectorPopover({
  currentPromptIds = [],
  onPromptsSelect,
  projectId,
  triggerClassName,
  disabled = false,
  placeholder = 'Select prompts...'
}: PromptSelectorPopoverProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { data: promptsResponse, isLoading, error } = useGetProjectPrompts(projectId)

  // Extract prompts from response
  const prompts = useMemo(() => {
    if (!promptsResponse?.data) return []
    return Array.isArray(promptsResponse.data) ? promptsResponse.data : []
  }, [promptsResponse])

  // Filter prompts based on search
  const filteredPrompts = useMemo(() => {
    if (!searchQuery.trim()) return prompts
    const query = searchQuery.toLowerCase()
    return prompts.filter(
      (prompt) => prompt.name.toLowerCase().includes(query) || prompt.content.toLowerCase().includes(query)
    )
  }, [prompts, searchQuery])

  // Find current prompt details
  const currentPrompts = useMemo(() => {
    if (!currentPromptIds.length || !prompts.length) return []
    return prompts.filter((prompt) => currentPromptIds.includes(prompt.id))
  }, [currentPromptIds, prompts])

  const handleTogglePrompt = (promptId: number) => {
    const newSelection = currentPromptIds.includes(promptId)
      ? currentPromptIds.filter((id) => id !== promptId)
      : [...currentPromptIds, promptId]
    onPromptsSelect(newSelection)
  }

  const handleClearAll = () => {
    onPromptsSelect([])
    setOpen(false)
  }

  // Determine trigger display text
  const triggerText = useMemo(() => {
    if (currentPromptIds.length === 0) return 'No prompts'
    if (currentPromptIds.length === 1) {
      const prompt = currentPrompts[0]
      return prompt ? prompt.name : '1 prompt'
    }
    return `${currentPromptIds.length} prompts`
  }, [currentPromptIds, currentPrompts])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant='ghost'
          size='sm'
          role='combobox'
          aria-expanded={open}
          aria-haspopup='listbox'
          aria-label='Select prompts'
          className={cn(
            'h-auto py-0.5 px-1 text-xs justify-start gap-1 hover:bg-accent',
            currentPromptIds.length === 0 && 'text-muted-foreground',
            triggerClassName
          )}
          disabled={disabled}
        >
          <MessageSquare className='h-3 w-3' />
          <span className='truncate max-w-[150px]'>{isLoading ? 'Loading...' : triggerText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[350px] p-0' align='start'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='Search prompts...'
            className='h-9'
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading && (
              <div className='p-2 space-y-2'>
                <Skeleton className='h-8 w-full' />
                <Skeleton className='h-8 w-full' />
                <Skeleton className='h-8 w-full' />
              </div>
            )}

            {error && (
              <CommandEmpty>
                <div className='text-sm text-destructive p-2'>Failed to load prompts</div>
              </CommandEmpty>
            )}

            {!isLoading && !error && prompts.length === 0 && (
              <CommandEmpty>
                <div className='text-sm text-muted-foreground p-2'>No prompts available for this project</div>
              </CommandEmpty>
            )}

            {!isLoading && !error && filteredPrompts.length === 0 && prompts.length > 0 && (
              <CommandEmpty>
                <div className='text-sm text-muted-foreground p-2'>No prompts match your search</div>
              </CommandEmpty>
            )}

            {!isLoading && !error && filteredPrompts.length > 0 && (
              <>
                {currentPromptIds.length > 0 && (
                  <>
                    <CommandGroup>
                      <CommandItem value='clear-all' onSelect={handleClearAll} disabled={disabled}>
                        <X className='mr-2 h-4 w-4 text-muted-foreground' />
                        <span>Clear all prompts</span>
                        <Badge variant='secondary' className='ml-auto'>
                          {currentPromptIds.length}
                        </Badge>
                      </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}

                <CommandGroup heading='Available Prompts'>
                  <ScrollArea className='max-h-[300px]'>
                    {filteredPrompts.map((prompt) => {
                      const isSelected = currentPromptIds.includes(prompt.id)
                      return (
                        <CommandItem
                          key={prompt.id}
                          value={prompt.id.toString()}
                          onSelect={() => handleTogglePrompt(prompt.id)}
                          disabled={disabled}
                          className='flex items-start gap-2 cursor-pointer'
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleTogglePrompt(prompt.id)}
                            className='mt-0.5'
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className='flex-1 min-w-0'>
                            <div className='font-medium truncate'>{prompt.name}</div>
                            {prompt.content && (
                              <div className='text-xs text-muted-foreground line-clamp-2'>
                                {prompt.content.substring(0, 100)}
                                {prompt.content.length > 100 && '...'}
                              </div>
                            )}
                          </div>
                          {isSelected && <Check className='ml-2 h-4 w-4 flex-shrink-0 text-primary' />}
                        </CommandItem>
                      )
                    })}
                  </ScrollArea>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
