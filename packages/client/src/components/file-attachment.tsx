// Recent changes:
// 1. Created file attachment display component with preview support
// 2. Added file size formatting and MIME type icons
// 3. Implemented attachment removal functionality with confirmation
// 4. Added image preview for image attachments
// 5. Used proper TypeScript types from shared schemas

import React from 'react'
import { X, FileIcon, ImageIcon } from 'lucide-react'
import { Button } from '@ui'
import type { ChatMessageAttachment } from '@octoprompt/schemas'
import { cn } from '@/lib/utils'

interface FileAttachmentProps {
  attachment: ChatMessageAttachment
  onRemove?: () => void
  showRemove?: boolean
  className?: string
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Helper function to get file icon based on MIME type
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return <ImageIcon className='h-4 w-4' />
  }
  return <FileIcon className='h-4 w-4' />
}

export function FileAttachment({ attachment, onRemove, showRemove = true, className }: FileAttachmentProps) {
  const isImage = attachment.mimeType.startsWith('image/')

  return (
    <div className={cn('flex items-center gap-2 p-2 bg-muted/50 rounded-md border border-border', className)}>
      {isImage ? (
        <img src={attachment.url} alt={attachment.fileName} className='h-8 w-8 object-cover rounded' />
      ) : (
        <div className='flex items-center justify-center h-8 w-8 bg-muted rounded'>
          {getFileIcon(attachment.mimeType)}
        </div>
      )}

      <div className='flex-1 min-w-0'>
        <p className='text-sm font-medium truncate'>{attachment.fileName}</p>
        <p className='text-xs text-muted-foreground'>{formatFileSize(attachment.size)}</p>
      </div>

      {showRemove && onRemove && (
        <Button
          variant='ghost'
          size='icon'
          className='h-6 w-6 text-muted-foreground hover:text-destructive'
          onClick={onRemove}
        >
          <X className='h-3 w-3' />
        </Button>
      )}
    </div>
  )
}

// Component for displaying multiple attachments in a list
interface FileAttachmentListProps {
  attachments: ChatMessageAttachment[]
  onRemove?: (attachmentId: number) => void
  showRemove?: boolean
  className?: string
}

export function FileAttachmentList({ attachments, onRemove, showRemove = true, className }: FileAttachmentListProps) {
  if (attachments.length === 0) return null

  return (
    <div className={cn('space-y-2', className)}>
      {attachments.map((attachment) => (
        <FileAttachment
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove ? () => onRemove(attachment.id) : undefined}
          showRemove={showRemove}
        />
      ))}
    </div>
  )
}
