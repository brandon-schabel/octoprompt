import { useNavigate } from '@tanstack/react-router'
import { CommandItem } from '@/components/ui/command'
import { FileIcon, ChatBubbleIcon, CounterClockwiseClockIcon } from '@radix-ui/react-icons'

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
      <CommandItem
        onSelect={() => handleNavigate('/projects')}
      >
        <FileIcon />
        <span>Go to Projects</span>
      </CommandItem>
      <CommandItem
        onSelect={() => handleNavigate('/chat')}
      >
        <ChatBubbleIcon />
        <span>Go to Chat</span>
      </CommandItem>
    </>
  )
} 