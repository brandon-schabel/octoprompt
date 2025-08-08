import { useNavigate } from '@tanstack/react-router'
import { CommandItem } from '@promptliano/ui'
import { FileIcon, ChatBubbleIcon, GearIcon } from '@radix-ui/react-icons'
import { Cloud } from 'lucide-react'

type NavigationCommandProps = {
  onSelect?: () => void
}

export function NavigationCommands({ onSelect }: NavigationCommandProps) {
  const navigate = useNavigate()

  const handleNavigate = (to: string) => {
    navigate({ to })
    onSelect?.()
  }

  return (
    <>
      <CommandItem onSelect={() => handleNavigate('/projects')}>
        <FileIcon />
        <span>Go to Projects</span>
      </CommandItem>
      <CommandItem onSelect={() => handleNavigate('/chat')}>
        <ChatBubbleIcon />
        <span>Go to Chat</span>
      </CommandItem>
      <CommandItem onSelect={() => handleNavigate('/providers')}>
        <Cloud className='h-4 w-4' />
        <span>Go to Providers</span>
      </CommandItem>
      <CommandItem onSelect={() => handleNavigate('/settings')}>
        <GearIcon />
        <span>Go to Settings</span>
      </CommandItem>
    </>
  )
}
