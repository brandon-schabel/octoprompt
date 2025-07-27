import { motion, AnimatePresence } from 'framer-motion'
import { ReactNode, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Copy, Check, Terminal, Maximize2, Minimize2 } from 'lucide-react'

interface CodeLine {
  type: 'command' | 'output' | 'comment'
  content: string
  delay?: number
}

interface CodeTerminalProps {
  title?: string
  lines?: CodeLine[]
  code?: string
  className?: string
  animated?: boolean
  language?: string
}

export function CodeTerminal({
  title = 'Terminal',
  lines: propLines,
  code,
  className,
  animated = true,
  language = 'bash'
}: CodeTerminalProps) {
  // Convert code string to lines array if needed
  const lines = propLines || (code ? code.split('\n').map(content => ({
    type: 'output' as const,
    content,
    delay: 100
  })) : [])
  
  const [visibleLines, setVisibleLines] = useState<number>(animated ? 0 : lines.length)
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!animated) return

    let currentLine = 0
    const showNextLine = () => {
      if (currentLine < lines.length) {
        const delay = lines[currentLine].delay || 500
        setTimeout(() => {
          setVisibleLines(currentLine + 1)
          currentLine++
          showNextLine()
        }, delay)
      }
    }
    showNextLine()
  }, [lines, animated])

  const handleCopy = () => {
    const text = lines
      .filter((line) => line.type === 'command')
      .map((line) => line.content)
      .join('\n')

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lineVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-xl',
        isFullscreen && 'fixed inset-4 z-50',
        className
      )}
    >
      {/* Terminal Header */}
      <div className='flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2'>
        <div className='flex items-center gap-2'>
          <div className='flex gap-1.5'>
            <div className='h-3 w-3 rounded-full bg-red-500' />
            <div className='h-3 w-3 rounded-full bg-yellow-500' />
            <div className='h-3 w-3 rounded-full bg-green-500' />
          </div>
          <div className='ml-2 flex items-center gap-2 text-sm text-muted-foreground'>
            <Terminal className='h-4 w-4' />
            <span>{title}</span>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <button
            onClick={handleCopy}
            className='rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
            title='Copy commands'
          >
            <AnimatePresence mode='wait'>
              {copied ? (
                <motion.div key='check' initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Check className='h-4 w-4 text-green-500' />
                </motion.div>
              ) : (
                <motion.div key='copy' initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Copy className='h-4 w-4' />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className='rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className='h-4 w-4' /> : <Maximize2 className='h-4 w-4' />}
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className='p-4 font-mono text-sm'>
        <AnimatePresence>
          {lines.slice(0, visibleLines).map((line, index) => (
            <motion.div
              key={index}
              variants={lineVariants}
              initial='hidden'
              animate='visible'
              className='flex items-start gap-2'
            >
              {line.type === 'command' && <span className='text-green-500 select-none'>$</span>}
              {line.type === 'comment' && <span className='text-muted-foreground select-none'>#</span>}
              <span
                className={cn(
                  'flex-1',
                  line.type === 'command' && 'text-foreground',
                  line.type === 'output' && 'text-muted-foreground',
                  line.type === 'comment' && 'text-muted-foreground italic'
                )}
              >
                {line.content}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Cursor */}
        {animated && visibleLines < lines.length && (
          <motion.span
            className='inline-block h-5 w-2 bg-primary'
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        )}
      </div>
    </motion.div>
  )
}

// Code block with syntax highlighting (non-terminal style)
interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
  showLineNumbers?: boolean
  className?: string
}

export function CodeBlock({
  code,
  language = 'typescript',
  filename,
  showLineNumbers = true,
  className
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const lines = code.trim().split('\n')

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}
    >
      {/* Header */}
      <div className='flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2'>
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          {filename && <span>{filename}</span>}
          <span className='text-xs opacity-70'>{language}</span>
        </div>

        <button
          onClick={handleCopy}
          className='rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors'
        >
          <AnimatePresence mode='wait'>
            {copied ? (
              <motion.div key='check' initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Check className='h-4 w-4 text-green-500' />
              </motion.div>
            ) : (
              <motion.div key='copy' initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Copy className='h-4 w-4' />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Code */}
      <div className='overflow-x-auto'>
        <pre className='p-4 text-sm'>
          <code>
            {lines.map((line, index) => (
              <div key={index} className='flex'>
                {showLineNumbers && (
                  <span className='mr-4 select-none text-muted-foreground opacity-50'>
                    {String(index + 1).padStart(lines.length.toString().length, ' ')}
                  </span>
                )}
                <span>{line || ' '}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </motion.div>
  )
}
