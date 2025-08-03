import * as React from 'react'
import { cn } from '../../utils'
import { cva, type VariantProps } from 'class-variance-authority'

const codeBlockVariants = cva('relative overflow-hidden rounded-lg font-mono text-sm', {
  variants: {
    variant: {
      default: 'bg-muted text-muted-foreground',
      dark: 'bg-black text-gray-300',
      light: 'bg-gray-50 text-gray-900',
      terminal: 'bg-black text-green-400'
    },
    size: {
      sm: 'text-xs p-3',
      md: 'text-sm p-4',
      lg: 'text-base p-6'
    }
  },
  defaultVariants: {
    variant: 'default',
    size: 'md'
  }
})

export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof codeBlockVariants> {
  language?: string
  showLineNumbers?: boolean
  highlightLines?: number[]
  fileName?: string
  copyButton?: boolean
}

const CodeBlock = React.forwardRef<HTMLDivElement, CodeBlockProps>(
  (
    {
      className,
      variant,
      size,
      language,
      showLineNumbers = false,
      highlightLines = [],
      fileName,
      copyButton = true,
      children,
      ...props
    },
    ref
  ) => {
    const [copied, setCopied] = React.useState(false)

    const copyToClipboard = () => {
      const code = typeof children === 'string' ? children : ''
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }

    const lines = typeof children === 'string' ? children.split('\n') : []

    return (
      <div ref={ref} className={cn('relative group', className)} {...props}>
        {fileName && (
          <div className='flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50'>
            <span className='text-xs text-muted-foreground'>{fileName}</span>
            {language && <span className='text-xs text-muted-foreground'>{language}</span>}
          </div>
        )}

        <div className={cn(codeBlockVariants({ variant, size }))}>
          {copyButton && (
            <button
              onClick={copyToClipboard}
              className={cn(
                'absolute top-2 right-2 p-2 rounded-md transition-opacity',
                'opacity-0 group-hover:opacity-100',
                'hover:bg-muted-foreground/10'
              )}
              aria-label='Copy code'
            >
              {copied ? (
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                </svg>
              ) : (
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                  />
                </svg>
              )}
            </button>
          )}

          {showLineNumbers ? (
            <div className='flex'>
              <div className='flex-shrink-0 pr-4 text-right select-none'>
                {lines.map((_, i) => (
                  <div
                    key={i}
                    className={cn('text-muted-foreground/50', highlightLines.includes(i + 1) && 'text-primary')}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              <div className='flex-1 overflow-x-auto'>
                <pre className='whitespace-pre'>
                  {lines.map((line, i) => (
                    <div key={i} className={cn(highlightLines.includes(i + 1) && 'bg-primary/10 -mx-4 px-4')}>
                      {line}
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          ) : (
            <pre className='whitespace-pre overflow-x-auto'>{children}</pre>
          )}
        </div>
      </div>
    )
  }
)
CodeBlock.displayName = 'CodeBlock'

// CodeTerminal - Terminal-like code display
interface CodeTerminalProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  showControls?: boolean
}

const CodeTerminal = React.forwardRef<HTMLDivElement, CodeTerminalProps>(
  ({ className, title = 'Terminal', showControls = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('overflow-hidden rounded-b-lg bg-black text-green-400 font-mono text-sm', className)}
        {...props}
      >
        {showControls && (
          <div className='flex items-center gap-2 bg-gray-900 px-4 py-2'>
            <div className='flex gap-1.5'>
              <div className='w-3 h-3 rounded-full bg-red-500' />
              <div className='w-3 h-3 rounded-full bg-yellow-500' />
              <div className='w-3 h-3 rounded-full bg-green-500' />
            </div>
            <span className='text-xs text-gray-400 ml-2'>{title}</span>
          </div>
        )}
        <div className='p-4 overflow-x-auto'>
          <pre className='whitespace-pre'>{children}</pre>
        </div>
      </div>
    )
  }
)
CodeTerminal.displayName = 'CodeTerminal'

export { CodeBlock, CodeTerminal, codeBlockVariants }
