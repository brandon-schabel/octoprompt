import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'

interface SummaryDialogProps {
  isOpen: boolean
  onClose: () => void
  summaryContent: string
  tokenCount: number
}

export function SummaryDialog({ isOpen, onClose, summaryContent, tokenCount }: SummaryDialogProps) {
  const { copyToClipboard } = useCopyClipboard()

  const handleCopy = async () => {
    try {
      copyToClipboard(summaryContent)
    } catch (err) {
      console.error('Failed to copy:', err)
      toast.error('Failed to copy')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-[850px] max-h-[80vh]'>
        <DialogHeader>
          <DialogTitle className='flex justify-between items-center'>
            <span>Combined Project Summaries</span>
            <Button variant='outline' size='sm' className='gap-2' onClick={handleCopy}>
              <Copy className='h-4 w-4' />
              Copy All Included Summaries
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className='mt-4 overflow-y-auto max-h-[60vh]'>
          <pre className='whitespace-pre-wrap text-sm p-4 bg-muted rounded-lg'>{summaryContent}</pre>
        </div>
        <div className='mt-4 text-sm'>
          <span className='font-bold'>Token Count:</span> {tokenCount}
        </div>
      </DialogContent>
    </Dialog>
  )
}
