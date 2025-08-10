import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui'
import { CodeBlock, MultiFileCodeBlock } from '@/components/docs'
import { FeatureScreenshot } from '@/components/ui'
import { AlertCircle, Lightbulb, Zap, GitBranch } from 'lucide-react'

export const Route = createFileRoute('/docs/guides')({
  loader: () => {
    return {
      meta: {
        title: 'Guides & Best Practices - Promptliano Documentation',
        description: 'In-depth guides for common use cases, workflow patterns, and best practices with Promptliano.',
        keywords: ['guides', 'tutorials', 'best practices', 'workflow', 'tips']
      } as SeoMetadata
    }
  },
  component: GuidesPage
})

function GuidesPage() {
  return (
    <div className='space-y-12'>
      <div>
        <h1 className='text-4xl font-bold mb-4'>Guides & Best Practices</h1>
        <p className='text-xl text-muted-foreground'>
          Learn how to make the most of Promptliano with these comprehensive guides and best practices.
        </p>

        <div className='mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg'>
          <p className='text-sm'>
            <span className='font-medium'>New:</span> Check out our comprehensive{' '}
            <a href='/docs/how-to/mcp-best-practices' className='text-primary hover:underline'>
              Getting the Most Out of Promptliano MCP
            </a>{' '}
            guide for detailed workflows and AI prompting strategies.
          </p>
        </div>
      </div>

      {/* Building Context Efficiently */}
      <section id='building-context' className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Building Context Efficiently</h2>

        <GlassCard className='p-6'>
          <div className='flex items-start gap-3 mb-4'>
            <Lightbulb className='h-5 w-5 text-yellow-500 mt-0.5' />
            <div>
              <h3 className='text-lg font-medium mb-2'>Why Context Matters</h3>
              <p className='text-muted-foreground'>
                Promptliano's strength lies in its ability to rapidly build and maintain context about your codebase.
                This guide shows you how to leverage this capability for maximum efficiency.
              </p>
            </div>
          </div>
        </GlassCard>

        <div className='space-y-4'>
          <h3 className='text-xl font-medium'>1. Start with Project Overview</h3>
          <p className='text-muted-foreground'>Always begin your session by getting the project overview:</p>
          <CodeBlock
            code={`// First thing in any session
mcp__promptliano__project_manager(
  action: "overview",
  projectId: YOUR_PROJECT_ID
)`}
            language='typescript'
          />

          <h3 className='text-xl font-medium mt-6'>2. Use File Suggestions</h3>
          <p className='text-muted-foreground'>
            Instead of manually searching for files, use the optimized file suggestion strategies:
          </p>
          <CodeBlock
            code={`// Fast strategy - no AI, pure relevance scoring
mcp__promptliano__ticket_manager(
  action: "suggest_files",
  ticketId: 456,
  data: {
    strategy: "fast",
    maxResults: 10
  }
)

// Balanced strategy - pre-filters 50 files, AI refines
mcp__promptliano__ticket_manager(
  action: "suggest_files",
  ticketId: 456,
  data: {
    strategy: "balanced",
    extraUserInput: "focus on React components"
  }
)

// Thorough strategy - pre-filters 100 files, high-quality AI
mcp__promptliano__ticket_manager(
  action: "suggest_files",
  ticketId: 456,
  data: {
    strategy: "thorough",
    extraUserInput: "include test files and API routes"
  }
)`}
            language='typescript'
            showLineNumbers
          />

          <div className='bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-4'>
            <p className='text-sm'>
              <span className='font-medium'>Token Savings:</span> The file suggestion feature uses 60-70% fewer tokens
              compared to manual searches!
            </p>
          </div>
        </div>
      </section>

      {/* Working with Tickets */}
      <section id='tickets' className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Working with Tickets & Tasks</h2>

        <div className='space-y-4'>
          <h3 className='text-xl font-medium'>Ticket Workflow Pattern</h3>
          <MultiFileCodeBlock
            files={[
              {
                filename: '1-create-ticket.ts',
                language: 'typescript',
                code: `// Step 1: Create a ticket with clear overview
const ticket = await mcp__promptliano__ticket_manager(
  action: "create",
  projectId: 1754713756748,
  data: {
    title: "Add user authentication",
    overview: "Implement JWT-based authentication with login/logout",
    priority: "high",
    status: "open"
  }
)`
              },
              {
                filename: '2-generate-tasks.ts',
                language: 'typescript',
                code: `// Step 2: Auto-generate tasks based on ticket
await mcp__promptliano__ticket_manager(
  action: "auto_generate_tasks",
  ticketId: ticket.id
)

// Or manually create specific tasks
await mcp__promptliano__task_manager(
  action: "batch_create",
  ticketId: ticket.id,
  data: {
    tasks: [
      { content: "Design auth schema", tags: ["backend", "design"] },
      { content: "Create login component", tags: ["frontend", "ui"] },
      { content: "Implement JWT service", tags: ["backend", "auth"] }
    ]
  }
)`
              },
              {
                filename: '3-track-progress.ts',
                language: 'typescript',
                code: `// Step 3: Update tasks as you work
await mcp__promptliano__task_manager(
  action: "update",
  ticketId: ticket.id,
  data: {
    taskId: 789,
    done: true,
    description: "Implemented using bcrypt for password hashing"
  }
)

// Get task complexity analysis
await mcp__promptliano__task_manager(
  action: "analyze_complexity",
  ticketId: ticket.id,
  data: { taskId: 790 }
)`
              }
            ]}
          />
        </div>
      </section>

      {/* File Suggestions Guide */}
      <section id='file-suggestions' className='space-y-6'>
        <h2 className='text-3xl font-semibold'>File Suggestions Deep Dive</h2>

        <GlassCard className='p-6'>
          <div className='flex items-start gap-3'>
            <Zap className='h-5 w-5 text-yellow-500 mt-0.5' />
            <div>
              <h3 className='text-lg font-medium mb-2'>Optimized for Token Efficiency</h3>
              <p className='text-muted-foreground'>
                The file suggestion feature has been optimized to use 60-70% fewer tokens while maintaining high
                accuracy.
              </p>
            </div>
          </div>
        </GlassCard>

        <div className='grid md:grid-cols-3 gap-4'>
          <GlassCard className='p-4'>
            <h4 className='font-medium mb-2'>Fast Strategy</h4>
            <p className='text-sm text-muted-foreground mb-2'>No AI processing, pure relevance scoring</p>
            <ul className='text-sm space-y-1'>
              <li>✓ Best for large projects</li>
              <li>✓ Instant results</li>
              <li>✓ Zero token usage</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-4'>
            <h4 className='font-medium mb-2'>Balanced Strategy</h4>
            <p className='text-sm text-muted-foreground mb-2'>Pre-filters 50 files, AI refines</p>
            <ul className='text-sm space-y-1'>
              <li>✓ Default choice</li>
              <li>✓ Good accuracy</li>
              <li>✓ Moderate token usage</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-4'>
            <h4 className='font-medium mb-2'>Thorough Strategy</h4>
            <p className='text-sm text-muted-foreground mb-2'>Pre-filters 100 files, high-quality AI</p>
            <ul className='text-sm space-y-1'>
              <li>✓ Complex tickets</li>
              <li>✓ Best accuracy</li>
              <li>✓ Higher token usage</li>
            </ul>
          </GlassCard>
        </div>

        <div className='mt-6'>
          <FeatureScreenshot
            src='/assets/screenshots/recommended-files-dialog-filtered.webp'
            alt='File Suggestions Filtered'
            title='AI-Powered File Suggestions with Filtering'
            description='Use different strategies to optimize token usage while maintaining high accuracy'
            layout='centered'
          />
        </div>

        <div className='space-y-4 mt-6'>
          <h3 className='text-xl font-medium'>Usage Examples</h3>
          <CodeBlock
            code={`// Project-level suggestions (general discovery)
mcp__promptliano__project_manager(
  action: "suggest_files",
  projectId: 1754713756748,
  data: {
    prompt: "authentication flow",
    limit: 10
  }
)

// Ticket-level suggestions (with strategies)
mcp__promptliano__ticket_manager(
  action: "suggest_files",
  ticketId: 456,
  data: {
    strategy: "balanced",
    maxResults: 10,
    extraUserInput: "focus on React components and hooks"
  }
)

// Task-level suggestions (most focused)
mcp__promptliano__task_manager(
  action: "suggest_files",
  ticketId: 456,
  data: {
    taskId: 789,
    context: "include related test files"
  }
)`}
            language='typescript'
            showLineNumbers
          />
        </div>
      </section>

      {/* Using Agents */}
      <section id='agents' className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Working with AI Agents</h2>

        <GlassCard className='p-6'>
          <h3 className='text-lg font-medium mb-2'>Agent Architecture Pattern</h3>
          <p className='text-muted-foreground mb-4'>
            When using agents, establish a clear architecture upfront, especially the data schemas which serve as the
            source of truth.
          </p>

          <div className='bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4'>
            <div className='flex items-start gap-2'>
              <AlertCircle className='h-4 w-4 text-yellow-500 mt-0.5' />
              <p className='text-sm'>
                <span className='font-medium'>Important:</span> Define your Zod schemas first - they propagate to all
                agents and ensure consistency.
              </p>
            </div>
          </div>
        </GlassCard>

        <div className='mt-6'>
          <FeatureScreenshot
            src='/assets/screenshots/prompt-management-library.webp'
            alt='Prompt Library'
            title='Prompt Management for Agents'
            description='Save and organize reusable prompts and agent instructions for consistent AI workflows'
            layout='centered'
          />
        </div>

        <div className='space-y-4 mt-6'>
          <h3 className='text-xl font-medium'>Agent Workflow Example</h3>
          <MultiFileCodeBlock
            files={[
              {
                filename: '1-define-schema.ts',
                language: 'typescript',
                code: `// Define the source of truth
export const UserAuthSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string(),
  refreshToken: z.string().optional(),
  lastLogin: z.string().datetime(),
  roles: z.array(z.enum(['user', 'admin']))
})

export type UserAuth = z.infer<typeof UserAuthSchema>`
              },
              {
                filename: '2-plan-architecture.md',
                language: 'markdown',
                code: `# Authentication Feature Architecture

## Agents to Create:
1. **Schema Agent**: Define all Zod schemas
2. **Storage Agent**: Create SQLite tables and migrations
3. **Service Agent**: Implement business logic
4. **MCP Agent**: Create MCP tools for AI access
5. **API Agent**: Build Hono routes with OpenAPI
6. **Frontend Agent**: Create React components and hooks

## Data Flow:
Zod Schema → Storage → Service → MCP/API → Frontend`
              },
              {
                filename: '3-delegate-tasks.ts',
                language: 'typescript',
                code: `// Create specialized agents with clear context
const agents = [
  {
    name: "Storage Agent",
    context: "Create SQLite tables using the UserAuthSchema",
    files: ["packages/storage/src/auth-tables.ts"]
  },
  {
    name: "Service Agent", 
    context: "Implement auth service with JWT handling",
    files: ["packages/services/src/auth-service.ts"]
  },
  {
    name: "API Agent",
    context: "Create Hono routes with Zod validation",
    files: ["packages/api/src/routes/auth.ts"]
  }
]

// Each agent works in parallel with the schema as reference`
              }
            ]}
          />
        </div>
      </section>

      {/* Git Worktrees */}
      <section id='git-worktrees' className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Git Worktrees for Parallel Development</h2>

        <GlassCard className='p-6'>
          <div className='flex items-start gap-3'>
            <GitBranch className='h-5 w-5 text-green-500 mt-0.5' />
            <div>
              <h3 className='text-lg font-medium mb-2'>What are Git Worktrees?</h3>
              <p className='text-muted-foreground'>
                Git worktrees allow you to have multiple branches checked out simultaneously in different directories,
                perfect for parallel development or quick context switching.
              </p>
            </div>
          </div>
        </GlassCard>

        <div className='mt-6'>
          <FeatureScreenshot
            src='/assets/screenshots/git-worktrees-overview.webp'
            alt='Git Worktrees'
            title='Git Worktrees Management'
            description='Manage multiple worktrees for parallel development on different features'
            layout='centered'
          />
        </div>

        <div className='space-y-4 mt-6'>
          <h3 className='text-xl font-medium'>Worktree Workflow</h3>
          <CodeBlock
            code={`// 1. Add a worktree for a new feature
await mcp__promptliano__git_manager(
  action: "worktree_add",
  projectId: 1754713756748,
  data: {
    path: "../promptliano-auth",
    newBranch: "feature/authentication"
  }
)

// 2. List all worktrees
const worktrees = await mcp__promptliano__git_manager(
  action: "worktree_list",
  projectId: 1754713756748
)

// 3. Lock a worktree (prevent accidental deletion)
await mcp__promptliano__git_manager(
  action: "worktree_lock",
  projectId: 1754713756748,
  data: {
    path: "../promptliano-auth",
    reason: "Active development - do not remove"
  }
)

// 4. Remove worktree when done
await mcp__promptliano__git_manager(
  action: "worktree_remove",
  projectId: 1754713756748,
  data: {
    path: "../promptliano-auth",
    force: false
  }
)`}
            language='typescript'
            showLineNumbers
          />
        </div>

        <div className='mt-6'>
          <h3 className='text-xl font-medium'>Git Stash Management</h3>
          <p className='text-muted-foreground mb-4'>Temporarily save work in progress with Git stash operations:</p>
          <div className='grid md:grid-cols-2 gap-4'>
            <FeatureScreenshot
              src='/assets/screenshots/git-stash-management.webp'
              alt='Git Stash Management'
              title='Stash Management Interface'
              description='Save and manage work in progress with Git stash'
              layout='centered'
            />
            <FeatureScreenshot
              src='/assets/screenshots/git-stashes-list.webp'
              alt='Git Stashes List'
              title='List of Stashed Changes'
              description='View all stashed changes with descriptions and timestamps'
              layout='centered'
            />
          </div>
        </div>
      </section>

      {/* Performance Tips */}
      <section id='performance' className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Performance Optimization Tips</h2>

        <div className='grid md:grid-cols-2 gap-6'>
          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>Token Optimization</h3>
            <ul className='space-y-2 text-sm'>
              <li>• Use file suggestions instead of manual searches</li>
              <li>• Leverage the "fast" strategy for large codebases</li>
              <li>• Batch operations when possible</li>
              <li>• Use focused prompts with specific context</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>Workflow Efficiency</h3>
            <ul className='space-y-2 text-sm'>
              <li>• Start with project overview</li>
              <li>• Create tickets before diving into code</li>
              <li>• Use auto-generated tasks as starting points</li>
              <li>• Maintain context with regular status updates</li>
            </ul>
          </GlassCard>
        </div>
      </section>

      {/* Troubleshooting */}
      <section id='troubleshooting' className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Troubleshooting Common Issues</h2>

        <div className='space-y-4'>
          <GlassCard className='p-6'>
            <h4 className='font-medium mb-2'>File suggestions returning unexpected results?</h4>
            <p className='text-sm text-muted-foreground mb-2'>Try these solutions:</p>
            <ul className='text-sm space-y-1 list-disc list-inside text-muted-foreground'>
              <li>
                Add more specific context with <code>extraUserInput</code>
              </li>
              <li>Switch to "thorough" strategy for complex queries</li>
              <li>Check if files need to be summarized first</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <h4 className='font-medium mb-2'>MCP tools not responding?</h4>
            <p className='text-sm text-muted-foreground mb-2'>Common fixes:</p>
            <ul className='text-sm space-y-1 list-disc list-inside text-muted-foreground'>
              <li>
                Verify the MCP server is running: <code>ps aux | grep promptliano</code>
              </li>
              <li>Check your editor's MCP configuration</li>
              <li>Restart the MCP server if needed</li>
            </ul>
          </GlassCard>
        </div>
      </section>

      {/* Next Steps */}
      <GlassCard className='p-8 bg-primary/5 border-primary/20'>
        <h2 className='text-2xl font-semibold mb-4'>Ready to Build?</h2>
        <p className='text-muted-foreground mb-4'>
          Now that you understand the best practices, start building with Promptliano!
        </p>
        <div className='flex gap-4'>
          <a href='/docs/api' className='btn btn-primary'>
            Explore API Reference
          </a>
          <a href='/downloads' className='btn btn-outline'>
            Download Promptliano
          </a>
        </div>
      </GlassCard>
    </div>
  )
}
