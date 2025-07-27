import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { CodeTerminal } from '@/components/ui/code-terminal'
import { Sparkles, Copy, Check, ArrowRight, RotateCcw } from 'lucide-react'

interface CodeExample {
  id: string
  title: string
  description: string
  before: string
  after: string
  improvements: string[]
}

const codeExamples: CodeExample[] = [
  {
    id: 'async-handling',
    title: 'Async Error Handling',
    description: 'Improve error handling and add proper typing',
    before: `async function fetchUserData(id) {
  try {
    const response = await fetch('/api/users/' + id)
    const data = await response.json()
    return data
  } catch (e) {
    console.log(e)
    return null
  }
}`,
    after: `interface User {
  id: string
  name: string
  email: string
}

async function fetchUserData(userId: string): Promise<User | null> {
  try {
    const response = await fetch(\`/api/users/\${userId}\`)
    
    if (!response.ok) {
      throw new Error(\`Failed to fetch user: \${response.statusText}\`)
    }
    
    const data = await response.json() as User
    return data
  } catch (error) {
    console.error('Error fetching user data:', error)
    return null
  }
}`,
    improvements: [
      'Added TypeScript interface for type safety',
      'Improved error messages with context',
      'Added response status checking',
      'Used template literals for cleaner string interpolation',
      'More descriptive parameter naming'
    ]
  },
  {
    id: 'component-refactor',
    title: 'React Component Optimization',
    description: 'Refactor for performance and readability',
    before: `function UserList({ users }) {
  const [search, setSearch] = useState('')
  
  const filtered = users.filter(u => 
    u.name.includes(search) || u.email.includes(search)
  )
  
  return (
    <div>
      <input 
        value={search} 
        onChange={e => setSearch(e.target.value)} 
      />
      {filtered.map(user => (
        <div key={user.id}>
          <h3>{user.name}</h3>
          <p>{user.email}</p>
        </div>
      ))}
    </div>
  )
}`,
    after: `import { useMemo, useCallback } from 'react'

interface User {
  id: string
  name: string
  email: string
}

interface UserListProps {
  users: User[]
}

function UserList({ users }: UserListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  
  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return users.filter(user => 
      user.name.toLowerCase().includes(term) || 
      user.email.toLowerCase().includes(term)
    )
  }, [users, searchTerm])
  
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }, [])
  
  return (
    <div className="user-list">
      <input 
        type="search"
        placeholder="Search users..."
        value={searchTerm} 
        onChange={handleSearchChange}
        className="search-input"
      />
      <div className="user-grid">
        {filteredUsers.map(user => (
          <article key={user.id} className="user-card">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
          </article>
        ))}
      </div>
    </div>
  )
}`,
    improvements: [
      'Added TypeScript types for props',
      'Memoized filtered results for performance',
      'Case-insensitive search',
      'Used semantic HTML elements',
      'Added meaningful CSS classes',
      'Improved accessibility with input type and placeholder'
    ]
  },
  {
    id: 'api-service',
    title: 'API Service Pattern',
    description: 'Transform basic API calls into a robust service',
    before: `// api.js
export async function getProducts() {
  const res = await fetch('/api/products')
  return res.json()
}

export async function getProduct(id) {
  const res = await fetch('/api/products/' + id)
  return res.json()
}

export async function createProduct(data) {
  const res = await fetch('/api/products', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  return res.json()
}`,
    after: `// api/products.service.ts
import { z } from 'zod'

const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  description: z.string()
})

type Product = z.infer<typeof ProductSchema>
type CreateProductDTO = Omit<Product, 'id'>

class ProductService {
  private baseUrl = '/api/products'
  
  private async request<T>(
    endpoint: string, 
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      ...options
    })
    
    if (!response.ok) {
      throw new Error(\`API Error: \${response.statusText}\`)
    }
    
    return response.json()
  }
  
  async getAll(): Promise<Product[]> {
    const products = await this.request<Product[]>('')
    return z.array(ProductSchema).parse(products)
  }
  
  async getById(id: string): Promise<Product> {
    const product = await this.request<Product>(\`/\${id}\`)
    return ProductSchema.parse(product)
  }
  
  async create(data: CreateProductDTO): Promise<Product> {
    const product = await this.request<Product>('', {
      method: 'POST',
      body: JSON.stringify(data)
    })
    return ProductSchema.parse(product)
  }
}

export const productService = new ProductService()`,
    improvements: [
      'Created reusable service class',
      'Added Zod schema validation',
      'Centralized error handling',
      'Type-safe with TypeScript',
      'DRY principle with request helper',
      'Single source of truth for API endpoints'
    ]
  }
]

interface CodePlaygroundProps {
  title?: string
  description?: string
}

export function CodePlayground({
  title = 'Code Improvement Playground',
  description = 'See how Promptliano helps improve your code quality'
}: CodePlaygroundProps) {
  const [selectedExample, setSelectedExample] = useState(codeExamples[0])
  const [showAfter, setShowAfter] = useState(false)
  const [copied, setCopied] = useState(false)
  const [improving, setImproving] = useState(false)

  const handleImprove = () => {
    setImproving(true)
    setTimeout(() => {
      setShowAfter(true)
      setImproving(false)
    }, 1500)
  }

  const handleReset = () => {
    setShowAfter(false)
    setImproving(false)
  }

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className='space-y-6'>
      <div className='text-center'>
        <h2 className='text-3xl font-bold mb-2'>{title}</h2>
        <p className='text-muted-foreground'>{description}</p>
      </div>

      {/* Example Selector */}
      <div className='flex flex-wrap justify-center gap-2'>
        {codeExamples.map((example) => (
          <button
            key={example.id}
            onClick={() => {
              setSelectedExample(example)
              handleReset()
            }}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedExample.id === example.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            {example.title}
          </button>
        ))}
      </div>

      <GlassCard className='p-6'>
        <div className='mb-4'>
          <h3 className='text-xl font-semibold mb-2'>{selectedExample.title}</h3>
          <p className='text-muted-foreground'>{selectedExample.description}</p>
        </div>

        {/* Code Display */}
        <div className='grid md:grid-cols-2 gap-6'>
          {/* Before Code */}
          <div>
            <div className='flex items-center justify-between mb-2'>
              <h4 className='font-medium'>Before</h4>
              <button onClick={() => handleCopy(selectedExample.before)} className='p-1 hover:bg-secondary rounded'>
                {copied ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
              </button>
            </div>
            <div className={`transition-opacity ${showAfter ? 'opacity-50' : ''}`}>
              <CodeTerminal code={selectedExample.before} language='typescript' />
            </div>
          </div>

          {/* After Code */}
          <div>
            <div className='flex items-center justify-between mb-2'>
              <h4 className='font-medium'>After</h4>
              {showAfter && (
                <button onClick={() => handleCopy(selectedExample.after)} className='p-1 hover:bg-secondary rounded'>
                  {copied ? <Check className='h-4 w-4' /> : <Copy className='h-4 w-4' />}
                </button>
              )}
            </div>
            <AnimatePresence>
              {showAfter ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <CodeTerminal code={selectedExample.after} language='typescript' />
                </motion.div>
              ) : (
                <div className='h-full flex items-center justify-center border-2 border-dashed border-secondary rounded-lg'>
                  <div className='text-center p-8'>
                    <Sparkles className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
                    <p className='text-muted-foreground'>Click "Improve Code" to see the transformation</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Improvements List */}
        <AnimatePresence>
          {showAfter && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className='mt-6'
            >
              <h4 className='font-medium mb-3'>Improvements Made:</h4>
              <ul className='space-y-2'>
                {selectedExample.improvements.map((improvement, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className='flex items-start space-x-2'
                  >
                    <Check className='h-4 w-4 text-green-500 mt-0.5 flex-shrink-0' />
                    <span className='text-sm'>{improvement}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className='flex justify-center gap-4 mt-6'>
          {!showAfter ? (
            <button
              onClick={handleImprove}
              disabled={improving}
              className='btn btn-primary flex items-center space-x-2'
            >
              {improving ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <Sparkles className='h-4 w-4' />
                  </motion.div>
                  <span>Improving...</span>
                </>
              ) : (
                <>
                  <Sparkles className='h-4 w-4' />
                  <span>Improve Code</span>
                  <ArrowRight className='h-4 w-4' />
                </>
              )}
            </button>
          ) : (
            <button onClick={handleReset} className='btn btn-outline flex items-center space-x-2'>
              <RotateCcw className='h-4 w-4' />
              <span>Reset</span>
            </button>
          )}
        </div>
      </GlassCard>
    </div>
  )
}
