import { useState } from 'react'
import { Copy, Check, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description: string
  parameters?: {
    name: string
    type: string
    required: boolean
    description: string
  }[]
  requestBody?: {
    type: string
    example: any
  }
  responses?: {
    status: number
    description: string
    example?: any
  }[]
}

interface ApiReferenceProps {
  title: string
  description: string
  baseUrl?: string
  endpoints: ApiEndpoint[]
}

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className='relative group'>
      <pre className='bg-muted p-4 rounded-md overflow-x-auto'>
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className='absolute top-2 right-2 p-2 rounded-md bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity'
      >
        {copied ? <Check className='h-4 w-4 text-green-500' /> : <Copy className='h-4 w-4' />}
      </button>
    </div>
  )
}

function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const methodColors = {
    GET: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
    POST: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
    PUT: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
    DELETE: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
  }

  return (
    <div className='border rounded-lg overflow-hidden'>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className='w-full flex items-center gap-4 p-4 hover:bg-accent transition-colors'
      >
        <span className={cn('px-3 py-1 text-sm font-medium rounded-md', methodColors[endpoint.method])}>
          {endpoint.method}
        </span>
        <span className='flex-1 text-left font-mono text-sm'>{endpoint.path}</span>
        <span className='text-sm text-muted-foreground'>{endpoint.description}</span>
        {isExpanded ? <ChevronDown className='h-4 w-4' /> : <ChevronRight className='h-4 w-4' />}
      </button>

      {isExpanded && (
        <div className='border-t p-4 space-y-4'>
          {endpoint.parameters && endpoint.parameters.length > 0 && (
            <div>
              <h4 className='font-semibold mb-2'>Parameters</h4>
              <div className='space-y-2'>
                {endpoint.parameters.map((param, index) => (
                  <div key={index} className='flex items-start gap-2'>
                    <code className='text-sm bg-muted px-2 py-1 rounded'>{param.name}</code>
                    <span className='text-sm text-muted-foreground'>{param.type}</span>
                    {param.required && <span className='text-xs text-red-500'>required</span>}
                    <span className='text-sm text-muted-foreground'>- {param.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.requestBody && (
            <div>
              <h4 className='font-semibold mb-2'>Request Body</h4>
              <CodeBlock code={JSON.stringify(endpoint.requestBody.example, null, 2)} language='json' />
            </div>
          )}

          {endpoint.responses && endpoint.responses.length > 0 && (
            <div>
              <h4 className='font-semibold mb-2'>Responses</h4>
              <div className='space-y-3'>
                {endpoint.responses.map((response, index) => (
                  <div key={index}>
                    <div className='flex items-center gap-2 mb-1'>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          response.status >= 200 && response.status < 300 && 'text-green-600',
                          response.status >= 400 && 'text-red-600'
                        )}
                      >
                        {response.status}
                      </span>
                      <span className='text-sm text-muted-foreground'>{response.description}</span>
                    </div>
                    {response.example && <CodeBlock code={JSON.stringify(response.example, null, 2)} language='json' />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ApiReference({ title, description, baseUrl, endpoints }: ApiReferenceProps) {
  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold mb-2'>{title}</h2>
        <p className='text-muted-foreground'>{description}</p>
        {baseUrl && (
          <div className='mt-2'>
            <span className='text-sm text-muted-foreground'>Base URL: </span>
            <code className='text-sm bg-muted px-2 py-1 rounded'>{baseUrl}</code>
          </div>
        )}
      </div>

      <div className='space-y-2'>
        {endpoints.map((endpoint, index) => (
          <EndpointCard key={index} endpoint={endpoint} />
        ))}
      </div>
    </div>
  )
}
