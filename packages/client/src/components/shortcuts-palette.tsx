import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from '@/components/ui/popover'
import { ChevronUp } from 'lucide-react'





/**
 * Wrap your shortcuts in this component. 
 * It uses shadcn/ui Popover and a custom scaling animation.
 */
export function ChatShortcutsPalette({ children
}: { children: React.ReactNode, icon?: React.ReactNode }) {
    const [open, setOpen] = useState(false)

    return (
        <div className="relative w-full">
            <Popover open={open} onOpenChange={setOpen}>
                {/* The trigger asChild means our Button is the "click target" */}
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        className="
              absolute
              left-1/2
              -top-5
              -translate-x-1/2
              z-10
              rounded-full
              transition-transform
            "
                    >
                        {<ChevronUp
                            className={`
                h-4 w-4
                transition-transform
                duration-300
                ${open ? 'rotate-180' : 'rotate-0'}
              `}
                        />}
                    </Button>
                </PopoverTrigger>

                {/* PopoverContent: we align on top & center, offset a bit so it slides above. */}
                <PopoverContent
                    side="top"
                    align="center"
                    sideOffset={8}
                    className="bg-transparent border-none p-0"
                >
                    {/* 
            We wrap the children in a div that uses the same
            scale/fade classes you had before. 
            This is so we can keep your custom animation 
            in addition to the basic popover logic.
          */}
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
              ${open
                                ? 'scale-y-100 opacity-100 pointer-events-auto'
                                : 'scale-y-0 opacity-0 pointer-events-none'
                            }
            `}
                    >
                        {children}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}