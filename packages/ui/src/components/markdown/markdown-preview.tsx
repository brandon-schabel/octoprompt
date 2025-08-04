import { useState } from 'react'
import { MarkdownRenderer } from './markdown-renderer'
import { Button } from '../core/button'
import { Badge } from '../core/badge'
import { ScrollArea } from '../data/scroll-area'
import { ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '../../utils'
import { Dialog, DialogContent } from '../core/dialog'

export interface MarkdownPreviewProps {
  markdownContent: string
  className?: string
  showControls?: boolean
  size?: 'sm' | 'md' | 'lg'
  isDarkMode?: boolean
  codeTheme?: string
  copyToClipboard?: (text: string) => void
}

export function MarkdownPreview({
  markdownContent,
  className,
  showControls = false,
  size = 'md',
  isDarkMode = false,
  codeTheme = 'atomOneLight',
  copyToClipboard
}: MarkdownPreviewProps) {
  const [zoom, setZoom] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50))
  const handleResetZoom = () => setZoom(100)

  const sizeClasses = {
    sm: 'h-[200px]',
    md: 'h-[400px]',
    lg: 'h-[600px]'
  }

  const PreviewContent = () => (
    <div
      className={cn('p-4 prose prose-sm dark:prose-invert max-w-none', !showControls && sizeClasses[size])}
      style={{ fontSize: `${zoom}%` }}
    >
      <MarkdownRenderer
        content={markdownContent}
        isDarkMode={isDarkMode}
        codeTheme={codeTheme}
        copyToClipboard={copyToClipboard}
      />
    </div>
  )

  if (!showControls) {
    return (
      <ScrollArea className={cn('border rounded-lg bg-background', className, sizeClasses[size])}>
        <PreviewContent />
      </ScrollArea>
    )
  }

  return (
    <>
      <div className={cn('border rounded-lg overflow-hidden', className)}>
        {/* Controls */}
        <div className='border-b bg-muted/50 px-3 py-2 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Button variant='ghost' size='icon' className='h-8 w-8' onClick={handleZoomOut} disabled={zoom <= 50}>
              <ZoomOut className='h-4 w-4' />
            </Button>
            <Badge variant='secondary' className='cursor-pointer' onClick={handleResetZoom}>
              {zoom}%
            </Badge>
            <Button variant='ghost' size='icon' className='h-8 w-8' onClick={handleZoomIn} disabled={zoom >= 200}>
              <ZoomIn className='h-4 w-4' />
            </Button>
          </div>
          <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => setIsFullscreen(true)}>
            <Maximize2 className='h-4 w-4' />
          </Button>
        </div>

        {/* Preview Area */}
        <ScrollArea className={sizeClasses[size]}>
          <PreviewContent />
        </ScrollArea>
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className='max-w-[90vw] h-[90vh] p-0'>
          <div className='h-full flex flex-col'>
            <div className='border-b bg-muted/50 px-3 py-2 flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Button variant='ghost' size='icon' className='h-8 w-8' onClick={handleZoomOut} disabled={zoom <= 50}>
                  <ZoomOut className='h-4 w-4' />
                </Button>
                <Badge variant='secondary' className='cursor-pointer' onClick={handleResetZoom}>
                  {zoom}%
                </Badge>
                <Button variant='ghost' size='icon' className='h-8 w-8' onClick={handleZoomIn} disabled={zoom >= 200}>
                  <ZoomIn className='h-4 w-4' />
                </Button>
              </div>
              <Button variant='ghost' size='icon' className='h-8 w-8' onClick={() => setIsFullscreen(false)}>
                <Minimize2 className='h-4 w-4' />
              </Button>
            </div>
            <ScrollArea className='flex-1'>
              <PreviewContent />
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
