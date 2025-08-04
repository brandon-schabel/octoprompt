import { MarkdownRenderer } from './markdown-renderer'
import { ScrollArea } from '../data/index'
import { cn } from '../../utils'

export interface MarkdownInlinePreviewProps {
  markdownContent: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showHoverPreview?: boolean
  isDarkMode?: boolean
  codeTheme?: string
  copyToClipboard?: (text: string) => void
}

export function MarkdownInlinePreview({
  markdownContent,
  className,
  size = 'md',
  showHoverPreview = true,
  isDarkMode = false,
  codeTheme = 'atomOneLight',
  copyToClipboard
}: MarkdownInlinePreviewProps) {
  const sizeClasses = {
    sm: 'h-24',
    md: 'h-32',
    lg: 'h-48'
  }

  // Extract first few lines for preview
  const previewLines = markdownContent.split('\n').slice(0, 5).join('\n')
  const hasMore = markdownContent.split('\n').length > 5

  return (
    <div className={cn('relative group', className)}>
      <ScrollArea className={cn('border rounded-md bg-muted/20 p-2 overflow-hidden', sizeClasses[size])}>
        <div className='prose prose-sm dark:prose-invert max-w-none text-xs'>
          <MarkdownRenderer
            content={previewLines}
            isDarkMode={isDarkMode}
            codeTheme={codeTheme}
            copyToClipboard={copyToClipboard}
          />
          {hasMore && <p className='text-muted-foreground italic mt-2'>...</p>}
        </div>
      </ScrollArea>

      {/* Hover preview */}
      {showHoverPreview && (
        <div className='absolute top-0 left-0 z-50 hidden group-hover:block'>
          <div className='relative mt-8 ml-8'>
            <div className='absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg shadow-2xl' />
            <ScrollArea className='relative max-h-[400px] max-w-[600px] border rounded-lg bg-background p-4'>
              <div className='prose prose-sm dark:prose-invert max-w-none'>
                <MarkdownRenderer
                  content={markdownContent}
                  isDarkMode={isDarkMode}
                  codeTheme={codeTheme}
                  copyToClipboard={copyToClipboard}
                />
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  )
}
