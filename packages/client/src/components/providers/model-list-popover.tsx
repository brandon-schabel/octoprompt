import React from 'react'
import { Button, Popover, PopoverContent, PopoverTrigger, ScrollArea, Badge, cn } from '@promptliano/ui'
import { Cpu, Copy, Loader2, ChevronRight } from 'lucide-react'
import { copyToClipboard } from '@/utils/clipboard'

interface ModelListPopoverProps {
  models: any[] | undefined
  isLoading: boolean
  providerName: string
  isConnected?: boolean
  triggerClassName?: string
  children?: React.ReactNode
}

export function ModelListPopover({
  models,
  isLoading,
  providerName,
  isConnected = true,
  triggerClassName,
  children
}: ModelListPopoverProps) {
  // Parse models data - now expecting an array directly
  const modelArray: any[] = models || []

  // Default trigger content if no children provided
  const defaultTrigger = (
    <button
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors w-full text-left',
        triggerClassName
      )}
    >
      <Cpu className='h-4 w-4 text-muted-foreground' />
      <div className='flex-1'>
        <p className='text-xs text-muted-foreground'>Models</p>
        <div className='flex items-center gap-1'>
          <p className='text-sm font-medium'>
            {isLoading ? <Loader2 className='h-3 w-3 animate-spin' /> : modelArray.length || '--'}
          </p>
          {!isLoading && modelArray.length > 0 && <ChevronRight className='h-3 w-3 text-muted-foreground' />}
        </div>
      </div>
    </button>
  )

  return (
    <Popover>
      <PopoverTrigger asChild>{children || defaultTrigger}</PopoverTrigger>
      <PopoverContent className='w-80' align='start'>
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <p className='text-sm font-medium'>Available Models</p>
            <Badge variant='secondary' className='text-xs'>
              {modelArray.length} total
            </Badge>
          </div>
          {modelArray.length > 0 ? (
            <ScrollArea className='h-[300px] w-full rounded-md border p-2'>
              <div className='space-y-1'>
                {modelArray.map((model: any, index: number) => {
                  const modelName = typeof model === 'string' ? model : model.name || model.id || 'Unknown'
                  return (
                    <div key={index} className='flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group'>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-6 w-6 p-0 invisible group-hover:visible transition-all'
                        onClick={() => copyToClipboard(modelName)}
                      >
                        <Copy className='h-3 w-3' />
                      </Button>
                      <span className='text-sm font-mono truncate flex-1'>{modelName}</span>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className='text-center py-4'>
              <p className='text-sm text-muted-foreground'>
                {isConnected ? 'No models found' : `Connect ${providerName} to see models`}
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
