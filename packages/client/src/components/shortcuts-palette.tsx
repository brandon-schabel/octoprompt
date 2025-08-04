import { useState } from 'react'
import { Button } from '@promptliano/ui'
import { Popover, PopoverTrigger, PopoverContent } from '@promptliano/ui'
import { ChevronUp } from 'lucide-react'

export function ChatShortcutsPalette({ children }: { children: React.ReactNode; icon?: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className='relative w-full'>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            size='icon'
            className='
              absolute
              left-1/2
              -top-5
              -translate-x-1/2
              z-10
              rounded-full
              transition-transform
            '
          >
            {
              <ChevronUp
                className={`
                h-4 w-4
                transition-transform
                duration-300
                ${open ? 'rotate-180' : 'rotate-0'}
              `}
              />
            }
          </Button>
        </PopoverTrigger>

        <PopoverContent side='top' align='center' sideOffset={8} className='bg-transparent border-none p-0'>
          <div
            className={`
              transform-gpu
              origin-bottom
              transition-transform
              duration-300
              ease-in-out
              px-3 py-2
              bg-muted
              flex items-center gap-2
              rounded-md
              shadow
              ${open ? 'scale-y-100 opacity-100 pointer-events-auto' : 'scale-y-0 opacity-0 pointer-events-none'}
            `}
          >
            {children}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
