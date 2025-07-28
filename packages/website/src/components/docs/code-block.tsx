import { useState } from 'react'
import { Copy, Check, Play, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
  showLineNumbers?: boolean
  runnable?: boolean
  onRun?: () => void
  className?: string
}

export function CodeBlock({
  code,
  language = 'typescript',
  filename,
  showLineNumbers = false,
  runnable = false,
  onRun,
  className
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = code.split('\n')
  const maxLineNumberWidth = String(lines.length).length

  const languageIcons: Record<string, React.ReactNode> = {
    bash: <Terminal className='h-4 w-4' />,
    shell: <Terminal className='h-4 w-4' />,
    typescript: <span className='text-xs font-bold'>TS</span>,
    javascript: <span className='text-xs font-bold'>JS</span>,
    json: <span className='text-xs font-bold'>{'{}'}</span>,
    python: <span className='text-xs font-bold'>PY</span>
  }

  return (
    <div className={cn('relative group rounded-lg overflow-hidden border', className)}>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-2 bg-muted/50 border-b'>
        <div className='flex items-center gap-2'>
          {languageIcons[language] || <span className='text-xs font-mono'>{language}</span>}
          {filename && <span className='text-sm text-muted-foreground'>{filename}</span>}
        </div>
        <div className='flex items-center gap-2'>
          {runnable && onRun && (
            <button onClick={onRun} className='p-1.5 rounded-md hover:bg-accent transition-colors' title='Run code'>
              <Play className='h-4 w-4' />
            </button>
          )}
          <button onClick={handleCopy} className='p-1.5 rounded-md hover:bg-accent transition-colors' title='Copy code'>
            {copied ? <Check className='h-4 w-4 text-green-500' /> : <Copy className='h-4 w-4' />}
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className='relative'>
        <pre className='overflow-x-auto p-4 bg-muted/30'>
          <code className={`language-${language}`}>
            {showLineNumbers ? (
              <div className='flex'>
                <div className='select-none pr-4 text-muted-foreground'>
                  {lines.map((_, index) => (
                    <div key={index} className='text-right'>
                      {String(index + 1).padStart(maxLineNumberWidth, ' ')}
                    </div>
                  ))}
                </div>
                <div className='flex-1'>
                  {lines.map((line, index) => (
                    <div key={index}>{line || '\n'}</div>
                  ))}
                </div>
              </div>
            ) : (
              code
            )}
          </code>
        </pre>
      </div>
    </div>
  )
}

// Multi-file code block component
interface CodeFile {
  filename: string
  language: string
  code: string
}

interface MultiFileCodeBlockProps {
  files: CodeFile[]
  defaultFile?: string
}

export function MultiFileCodeBlock({ files, defaultFile }: MultiFileCodeBlockProps) {
  const [activeFile, setActiveFile] = useState(defaultFile || files[0]?.filename)
  const currentFile = files.find((f) => f.filename === activeFile) || files[0]

  if (!currentFile) return null

  return (
    <div className='rounded-lg overflow-hidden border'>
      {/* File tabs */}
      <div className='flex overflow-x-auto bg-muted/50 border-b'>
        {files.map((file) => (
          <button
            key={file.filename}
            onClick={() => setActiveFile(file.filename)}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap hover:bg-accent transition-colors',
              activeFile === file.filename && 'bg-background border-b-2 border-primary'
            )}
          >
            {file.filename}
          </button>
        ))}
      </div>

      {/* Code content */}
      <CodeBlock code={currentFile.code} language={currentFile.language} showLineNumbers />
    </div>
  )
}
