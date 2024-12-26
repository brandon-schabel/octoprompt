import { useEffect, useState, useRef } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { NavigationCommands } from './navigation-commands'
import { FilePanelRef } from '@/components/projects/file-panel'
import { formatModShortcut } from '@/lib/platform'

type CommandMenuProps = {
  filePanelRef?: React.RefObject<FilePanelRef>
}

export function CommandMenu({ filePanelRef }: CommandMenuProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <NavigationCommands onSelect={() => setOpen(false)} />
          <CommandItem
            onSelect={() => {
              filePanelRef?.current?.focusFileTree()
              setOpen(false)
            }}
          >
            Focus File Tree
            <span className="ml-auto text-xs text-muted-foreground">
              {formatModShortcut('mod+g')}
            </span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              filePanelRef?.current?.focusSearch()
              setOpen(false)
            }}
          >
            Search Files
            <span className="ml-auto text-xs text-muted-foreground">
              {formatModShortcut('mod+f')}
            </span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              filePanelRef?.current?.focusPrompts()
              setOpen(false)
            }}
          >
            Focus Prompts
            <span className="ml-auto text-xs text-muted-foreground">
              {formatModShortcut('mod+p')}
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
} 