import { Expand, Mic, MicOff, Copy, Wand2 } from 'lucide-react'
import { Button } from '@promptliano/ui'
import { Textarea } from '@promptliano/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@promptliano/ui'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@promptliano/ui'
import { useEffect, useState, useRef, forwardRef } from 'react'
import { PromptimizerDialog } from './promptimizer-dialog'
import { toast } from 'sonner'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { formatShortcut } from '@/lib/shortcuts'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { useOptimizeUserInput } from '@/hooks/api/use-projects-api'
import { useActiveProjectTab } from '@/hooks/use-kv-local-storage'

type ExpandableTextareaProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  title?: string
}

export const ExpandableTextarea = forwardRef<HTMLTextAreaElement, ExpandableTextareaProps>(
  ({ value, onChange, placeholder, className, title = 'Edit Text' }, ref) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [expandedValue, setExpandedValue] = useState(value)
    const internalRef = useRef<HTMLTextAreaElement | null>(null)
    const textareaRef = (ref || internalRef) as React.RefObject<HTMLTextAreaElement>
    const [selectionStart, setSelectionStart] = useState<number | null>(null)
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null)
    const { copyToClipboard } = useCopyClipboard()
    const [activeProject] = useActiveProjectTab()
    const projectId = activeProject?.selectedProjectId

    const [promptimizeDialogOpen, setPromptimizeDialogOpen] = useState(false)
    const [optimizedPrompt, setOptimizedPrompt] = useState('')
    const optimizeUserInput = useOptimizeUserInput()

    const handleOptimizeUserInput = () => {
      if (!expandedValue.trim()) {
        toast.error('Please enter some text to optimize')
        return
      }
      optimizeUserInput.mutate(
        { projectId: projectId ?? -1, data: { userContext: expandedValue } },
        {
          onSuccess: (resp) => {
            if (resp.optimizedPrompt) {
              setOptimizedPrompt(resp.optimizedPrompt)
              setPromptimizeDialogOpen(true)
            } else {
              toast.error('Optimization failed or no prompt returned')
            }
          }
        }
      )
    }

    const handleCopyContent = async () => {
      copyToClipboard(expandedValue, {
        successMessage: 'Content copied to clipboard',
        errorMessage: 'Failed to copy content'
      })
    }

    useEffect(() => {
      setExpandedValue(value)
    }, [value])

    const handleExpandedChange = (newValue: string) => {
      setExpandedValue(newValue)
      onChange(newValue)
    }

    const handleDialogClose = (open: boolean) => {
      if (!open) {
        onChange(expandedValue)
      }
      setIsExpanded(open)
    }

    const handleSelectionChange = () => {
      if (textareaRef.current) {
        setSelectionStart(textareaRef.current.selectionStart)
        setSelectionEnd(textareaRef.current.selectionEnd)
      }
    }

    const placeholderWithShortcut = `${placeholder} (${formatShortcut('mod+i')})`

    return (
      <div className='relative h-full'>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setExpandedValue(e.target.value)
          }}
          onSelect={handleSelectionChange}
          onFocus={handleSelectionChange}
          onClick={handleSelectionChange}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              textareaRef.current?.blur()
            }
          }}
          placeholder={placeholderWithShortcut}
          className={`h-full resize-none pr-[80px] ${className}`}
        />
        <div className='absolute right-3 top-2 flex items-center space-x-2 bg-background'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='h-6 w-6 opacity-50 hover:opacity-100'>
                <DotsHorizontalIcon className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-48'>
              <DropdownMenuItem onClick={handleCopyContent}>
                <Copy className='mr-2 h-4 w-4' />
                <span>Copy Content</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOptimizeUserInput} disabled={optimizeUserInput.isPending}>
                <Wand2 className='mr-2 h-4 w-4' />
                <span>{optimizeUserInput.isPending ? 'Optimizing...' : 'Promptimize'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant='ghost'
            size='icon'
            type='button'
            className='h-6 w-6 opacity-50 hover:opacity-100'
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsExpanded(true)
            }}
          >
            <Expand className='h-4 w-4' />
          </Button>
        </div>

        <Dialog open={isExpanded} onOpenChange={handleDialogClose}>
          <DialogContent className='max-w-[90vw] w-full h-[90vh] max-h-[90vh] flex flex-col p-6'>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className='flex-1 min-h-0 relative'>
              <Textarea
                ref={textareaRef}
                value={expandedValue}
                onChange={(e) => handleExpandedChange(e.target.value)}
                onSelect={handleSelectionChange}
                onFocus={handleSelectionChange}
                onClick={handleSelectionChange}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    textareaRef.current?.blur()
                  }
                }}
                placeholder={placeholder}
                className='h-full resize-none pr-[80px]'
              />
              <div className='absolute right-3 top-2 flex items-center space-x-2 bg-background'>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon' className='h-6 w-6 opacity-50 hover:opacity-100'>
                      <DotsHorizontalIcon className='h-4 w-4' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='w-48'>
                    <DropdownMenuItem onClick={handleCopyContent}>
                      <Copy className='mr-2 h-4 w-4' />
                      <span>Copy Content</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOptimizeUserInput} disabled={optimizeUserInput.isPending}>
                      <Wand2 className='mr-2 h-4 w-4' />
                      <span>{optimizeUserInput.isPending ? 'Optimizing...' : 'Promptimize'}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <DialogFooter className='mt-4'>
              <Button
                type='button'
                variant='outline'
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange(expandedValue)
                  setIsExpanded(false)
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Promptimizer Dialog */}
        <PromptimizerDialog
          open={promptimizeDialogOpen}
          onClose={() => setPromptimizeDialogOpen(false)}
          optimizedPrompt={optimizedPrompt}
          onUpdatePrompt={(newPrompt) => {
            setExpandedValue(newPrompt)
            onChange(newPrompt)
          }}
        />
      </div>
    )
  }
)
