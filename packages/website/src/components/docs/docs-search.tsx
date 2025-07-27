import { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search, FileText, Hash, Command } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  title: string
  excerpt: string
  category: string
  href: string
  type: 'article' | 'section' | 'api'
}

export function DocsSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Mock search function - replace with actual search API
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    // Mock results - replace with actual search implementation
    const mockResults: SearchResult[] = [
      {
        id: '1',
        title: 'Getting Started with Promptliano',
        excerpt: 'Learn how to install and configure Promptliano for your development workflow...',
        category: 'Getting Started',
        href: '/docs/getting-started',
        type: 'article' as const
      },
      {
        id: '2',
        title: 'Project Manager API',
        excerpt: 'Complete API reference for the Project Manager MCP tool...',
        category: 'API Reference',
        href: '/docs/api#project-manager',
        type: 'api' as const
      },
      {
        id: '3',
        title: 'File Suggestions Feature',
        excerpt: 'Optimized file suggestion strategies for efficient context building...',
        category: 'Advanced Features',
        href: '/docs/guides#file-suggestions',
        type: 'section' as const
      }
    ].filter(
      (result) =>
        result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
    )

    setResults(mockResults)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        inputRef.current?.focus()
      }

      if (!isOpen) return

      switch (e.key) {
        case 'Escape':
          setIsOpen(false)
          setQuery('')
          setResults([])
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % results.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length)
          break
        case 'Enter':
          e.preventDefault()
          if (results[selectedIndex]) {
            navigate({ to: results[selectedIndex].href })
            setIsOpen(false)
            setQuery('')
            setResults([])
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex, navigate])

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'api':
        return <Hash className='h-4 w-4' />
      case 'section':
        return <FileText className='h-4 w-4' />
      default:
        return <FileText className='h-4 w-4' />
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true)
          inputRef.current?.focus()
        }}
        className='w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-muted/50 rounded-md hover:bg-muted transition-colors'
      >
        <Search className='h-4 w-4' />
        <span className='flex-1 text-left'>Search documentation...</span>
        <kbd className='flex items-center gap-1 px-2 py-1 text-xs bg-background border rounded'>
          <Command className='h-3 w-3' />K
        </kbd>
      </button>

      {isOpen && (
        <>
          <div
            className='fixed inset-0 z-50 bg-background/80 backdrop-blur-sm'
            onClick={() => {
              setIsOpen(false)
              setQuery('')
              setResults([])
            }}
          />
          <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl'>
            <div className='bg-background border rounded-lg shadow-lg'>
              <div className='flex items-center gap-3 p-4 border-b'>
                <Search className='h-5 w-5 text-muted-foreground' />
                <input
                  ref={inputRef}
                  type='text'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Search documentation...'
                  className='flex-1 bg-transparent outline-none placeholder:text-muted-foreground'
                  autoFocus
                />
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setQuery('')
                    setResults([])
                  }}
                  className='text-xs text-muted-foreground hover:text-foreground'
                >
                  ESC
                </button>
              </div>

              {results.length > 0 && (
                <div className='max-h-96 overflow-y-auto'>
                  {results.map((result, index) => (
                    <button
                      key={result.id}
                      onClick={() => {
                        navigate({ to: result.href })
                        setIsOpen(false)
                        setQuery('')
                        setResults([])
                      }}
                      className={cn(
                        'w-full flex items-start gap-3 p-4 text-left hover:bg-accent transition-colors',
                        index === selectedIndex && 'bg-accent'
                      )}
                    >
                      <span className='mt-0.5 text-muted-foreground'>{getIcon(result.type)}</span>
                      <div className='flex-1 min-w-0'>
                        <div className='font-medium'>{result.title}</div>
                        <div className='text-sm text-muted-foreground line-clamp-2'>{result.excerpt}</div>
                        <div className='text-xs text-muted-foreground mt-1'>{result.category}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {query && results.length === 0 && (
                <div className='p-8 text-center text-muted-foreground'>No results found for "{query}"</div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
