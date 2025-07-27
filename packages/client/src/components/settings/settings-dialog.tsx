import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ui'
import { MCPGlobalConfigEditor } from './mcp-global-config-editor'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className='mt-4'>
          <MCPGlobalConfigEditor />
        </div>
      </DialogContent>
    </Dialog>
  )
}