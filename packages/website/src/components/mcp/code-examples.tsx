import { useState } from 'react'
import { motion } from 'framer-motion'
import { GlassCard, CodeBlock, AnimateOnScroll } from '@/components/ui'
import { Code2, FileSearch, GitBranch, TicketIcon, Brain, Sparkles, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CodeExample {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  category: 'project' | 'file' | 'ticket' | 'git' | 'ai'
  request: string
  response: string
  language?: string
}

const codeExamples: CodeExample[] = [
  {
    id: 'project-overview',
    title: 'Get Project Overview',
    description: 'Quickly understand your project structure and recent activity',
    icon: <Code2 className='w-5 h-5' />,
    category: 'project',
    request: 'Can you give me an overview of this project?',
    response: `=== PROJECT OVERVIEW ===
Project: E-Commerce Platform (ID: 1754111018844)
Path: /Users/dev/projects/ecommerce
Branch: feature/checkout | Last Updated: 7/27/2025

=== RECENT TICKETS (5 open) ===
#234: Implement Payment Gateway [HIGH] - 3 tasks
#235: Add Product Reviews [NORMAL] - 5 tasks
#236: Optimize Cart Performance [LOW] - 2 tasks

=== PROJECT STRUCTURE ===
├── packages
│   ├── frontend (React + TypeScript)
│   ├── backend (Node.js + Express)
│   └── shared (Common utilities)

Files: 342 total (2.1MB)
- Source: 287 files
- Tests: 45 files`
  },
  {
    id: 'file-search',
    title: 'Smart File Search',
    description: 'Find files related to specific features with AI-powered search',
    icon: <FileSearch className='w-5 h-5' />,
    category: 'file',
    request: 'Find all files related to authentication',
    response: `Found 12 files related to authentication:

HIGH RELEVANCE:
- /src/services/auth.service.ts (Auth service implementation)
- /src/components/LoginForm.tsx (Login UI component)
- /src/middleware/auth.middleware.ts (JWT validation)
- /src/hooks/useAuth.ts (Auth React hook)

MEDIUM RELEVANCE:
- /src/routes/auth.routes.ts (API endpoints)
- /src/schemas/auth.schemas.ts (Validation schemas)
- /tests/auth.test.ts (Unit tests)

Token usage: 70% reduction compared to full file scan`
  },
  {
    id: 'ticket-management',
    title: 'Ticket Management',
    description: 'Create and manage tickets directly from your editor',
    icon: <TicketIcon className='w-5 h-5' />,
    category: 'ticket',
    request: 'Create a ticket for implementing dark mode',
    response: `Created Ticket #237: Implement Dark Mode Theme

Project ID: 1754111018844
Status: open
Priority: normal
Overview: Add dark mode support across the application

Tasks created:
1. [ ] Create theme context provider
2. [ ] Add dark mode CSS variables
3. [ ] Implement theme toggle component
4. [ ] Update all components for theme support
5. [ ] Add theme persistence to localStorage

Suggested files:
- /src/contexts/ThemeContext.tsx
- /src/styles/themes.css
- /src/components/ThemeToggle.tsx`
  },
  {
    id: 'git-operations',
    title: 'Git Integration',
    description: 'Perform git operations with context awareness',
    icon: <GitBranch className='w-5 h-5' />,
    category: 'git',
    request: 'Show me recent changes and create a commit',
    response: `=== GIT STATUS ===
Branch: feature/dark-mode
Changes:
- M src/contexts/ThemeContext.tsx
- M src/styles/themes.css
- A src/components/ThemeToggle.tsx

=== RECENT COMMITS ===
- 3h ago: Update button styles for consistency
- 5h ago: Fix responsive layout issues
- 1d ago: Add product filtering feature

=== SUGGESTED COMMIT MESSAGE ===
feat: implement dark mode theme support

- Add ThemeContext for global theme state
- Create theme toggle component
- Define CSS variables for light/dark themes

🤖 Generated with Claude Code

Committed successfully!`
  },
  {
    id: 'ai-analysis',
    title: 'AI-Powered Analysis',
    description: 'Get intelligent insights about your codebase',
    icon: <Brain className='w-5 h-5' />,
    category: 'ai',
    request: 'Analyze the performance bottlenecks in this project',
    response: `=== PERFORMANCE ANALYSIS ===

Found 3 potential bottlenecks:

1. LARGE BUNDLE SIZE (High Priority)
   - Main bundle: 487KB (recommended: <300KB)
   - Unused dependencies: lodash, moment
   - Solution: Use tree-shaking, replace moment with date-fns

2. UNOPTIMIZED IMAGES (Medium Priority)
   - 23 images without lazy loading
   - Average size: 250KB per image
   - Solution: Implement lazy loading, use WebP format

3. N+1 QUERIES (Medium Priority)
   - Found in: /src/services/product.service.ts
   - Pattern: Fetching related data in loops
   - Solution: Use DataLoader or optimize queries

Recommended actions:
- Run: npm run analyze-bundle
- Consider code splitting for routes
- Implement React.lazy() for heavy components`
  },
  {
    id: 'refactoring',
    title: 'Smart Refactoring',
    description: 'Refactor code with full project awareness',
    icon: <Sparkles className='w-5 h-5' />,
    category: 'ai',
    request: 'Refactor the UserService to use async/await',
    response: `=== REFACTORING PLAN ===

Analyzing UserService usage across project...
Found 15 files importing UserService
12 call sites need updating

BEFORE:
\`\`\`typescript
getUserById(id: string): Promise<User> {
  return fetch(\`/api/users/\${id}\`)
    .then(res => res.json())
    .then(data => data.user)
    .catch(err => {
      console.error(err);
      throw new Error('Failed to fetch user');
    });
}
\`\`\`

AFTER:
\`\`\`typescript
async getUserById(id: string): Promise<User> {
  try {
    const res = await fetch(\`/api/users/\${id}\`);
    const data = await res.json();
    return data.user;
  } catch (err) {
    console.error(err);
    throw new Error('Failed to fetch user');
  }
}
\`\`\`

All 12 call sites have been updated to handle async/await properly.
Tests updated and passing ✓`
  }
]

const categories = [
  { id: 'all', name: 'All Examples', icon: '🎯' },
  { id: 'project', name: 'Project', icon: '📁' },
  { id: 'file', name: 'Files', icon: '📄' },
  { id: 'ticket', name: 'Tickets', icon: '🎫' },
  { id: 'git', name: 'Git', icon: '🌿' },
  { id: 'ai', name: 'AI', icon: '🤖' }
]

export function CodeExamples() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedExample, setSelectedExample] = useState<CodeExample | null>(codeExamples[0])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filteredExamples =
    selectedCategory === 'all' ? codeExamples : codeExamples.filter((ex) => ex.category === selectedCategory)

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2 className='text-3xl font-bold mb-4'>Real-World Examples</h2>
        <p className='text-muted-foreground max-w-2xl mx-auto'>
          See how Promptliano enhances your AI assistant with powerful project context and tools
        </p>
      </div>

      {/* Category Filter */}
      <div className='flex gap-2 justify-center flex-wrap'>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              'px-4 py-2 rounded-lg border transition-all flex items-center gap-2',
              selectedCategory === category.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50'
            )}
          >
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </button>
        ))}
      </div>

      <div className='grid lg:grid-cols-3 gap-6'>
        {/* Example List */}
        <div className='lg:col-span-1 space-y-3'>
          {filteredExamples.map((example) => (
            <motion.button
              key={example.id}
              onClick={() => setSelectedExample(example)}
              className={cn(
                'w-full text-left p-4 rounded-lg border transition-all',
                selectedExample?.id === example.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className='flex items-start gap-3'>
                <div className='text-primary bg-primary/10 p-2 rounded'>{example.icon}</div>
                <div>
                  <h3 className='font-semibold'>{example.title}</h3>
                  <p className='text-sm text-muted-foreground mt-1'>{example.description}</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Example Details */}
        {selectedExample && (
          <div className='lg:col-span-2 space-y-6'>
            <AnimateOnScroll key={selectedExample.id}>
              {/* Request */}
              <GlassCard className='p-6'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='font-semibold flex items-center gap-2'>
                    <span className='text-primary'>You:</span>
                    Request
                  </h3>
                  <button
                    onClick={() => handleCopy(selectedExample.request, `${selectedExample.id}-request`)}
                    className='p-2 rounded hover:bg-primary/10 transition-colors'
                  >
                    {copiedId === `${selectedExample.id}-request` ? (
                      <Check className='w-4 h-4 text-green-500' />
                    ) : (
                      <Copy className='w-4 h-4' />
                    )}
                  </button>
                </div>
                <div className='bg-black/30 backdrop-blur rounded-lg p-4'>
                  <p className='font-mono text-sm'>{selectedExample.request}</p>
                </div>
              </GlassCard>

              {/* Response */}
              <GlassCard className='p-6'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='font-semibold flex items-center gap-2'>
                    <span className='text-primary'>AI Assistant:</span>
                    Response
                  </h3>
                  <button
                    onClick={() => handleCopy(selectedExample.response, `${selectedExample.id}-response`)}
                    className='p-2 rounded hover:bg-primary/10 transition-colors'
                  >
                    {copiedId === `${selectedExample.id}-response` ? (
                      <Check className='w-4 h-4 text-green-500' />
                    ) : (
                      <Copy className='w-4 h-4' />
                    )}
                  </button>
                </div>
                <CodeBlock code={selectedExample.response} language={selectedExample.language || 'text'} />
              </GlassCard>

              {/* Key Benefits */}
              <GlassCard className='p-6 border-primary/30'>
                <h3 className='font-semibold mb-3 flex items-center gap-2'>
                  <Sparkles className='w-5 h-5 text-primary' />
                  Why This Works
                </h3>
                <ul className='space-y-2 text-sm text-muted-foreground'>
                  <li className='flex items-start gap-2'>
                    <Check className='w-4 h-4 text-green-500 mt-0.5' />
                    <span>Promptliano provides instant access to project context</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <Check className='w-4 h-4 text-green-500 mt-0.5' />
                    <span>AI understands your file structure and relationships</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <Check className='w-4 h-4 text-green-500 mt-0.5' />
                    <span>Actions are performed directly without manual steps</span>
                  </li>
                </ul>
              </GlassCard>
            </AnimateOnScroll>
          </div>
        )}
      </div>
    </div>
  )
}
