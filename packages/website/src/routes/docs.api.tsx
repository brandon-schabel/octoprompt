import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui/glass-card'
import { CodeTerminal } from '@/components/ui/code-terminal'
import { Breadcrumbs } from '@/components/Breadcrumbs'

export const Route = createFileRoute('/docs/api')({
  loader: () => {
    return {
      meta: {
        title: 'API Reference - Promptliano Documentation',
        description:
          'Complete API reference for Promptliano MCP tools including project, prompt, ticket, and task management.',
        keywords: ['API', 'reference', 'MCP tools', 'documentation', 'methods']
      } as SeoMetadata
    }
  },
  component: ApiReferencePage
})

function ApiReferencePage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-6xl'>
        <Breadcrumbs />

        <h1 className='text-4xl font-bold mb-8'>API Reference</h1>

        <div className='space-y-12'>
          {/* Project Manager */}
          <section id='project-manager'>
            <h2 className='text-3xl font-semibold mb-6'>Project Manager</h2>

            <GlassCard className='p-6 mb-6'>
              <h3 className='text-xl font-medium mb-3'>Overview</h3>
              <p className='text-muted-foreground mb-4'>
                The Project Manager API provides comprehensive project operations including creation, updates, file
                management, and intelligent summaries.
              </p>

              <h4 className='font-medium mb-2'>Available Actions:</h4>
              <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
                <li>
                  <code>list</code> - List all projects
                </li>
                <li>
                  <code>get</code> - Get project details
                </li>
                <li>
                  <code>create</code> - Create new project
                </li>
                <li>
                  <code>update</code> - Update project metadata
                </li>
                <li>
                  <code>delete</code> - Delete entire project (requires confirmDelete: true)
                </li>
                <li>
                  <code>get_summary</code> - Get AI-generated project summary
                </li>
                <li>
                  <code>suggest_files</code> - Get intelligent file suggestions
                </li>
                <li>
                  <code>search</code> - Search within project
                </li>
                <li>
                  <code>overview</code> - Get essential project context
                </li>
              </ul>
            </GlassCard>

            <div className='space-y-4'>
              <div>
                <h4 className='font-medium mb-2'>Example: Get Project Overview</h4>
                <CodeTerminal
                  code={`mcp__promptliano__project_manager(
  action: "overview",
  projectId: 1753220774680
)`}
                  language='typescript'
                />
              </div>

              <div>
                <h4 className='font-medium mb-2'>Example: Suggest Files</h4>
                <CodeTerminal
                  code={`mcp__promptliano__project_manager(
  action: "suggest_files",
  projectId: 1753220774680,
  data: {
    prompt: "authentication components",
    limit: 10
  }
)`}
                  language='typescript'
                />
              </div>
            </div>
          </section>

          {/* Ticket Manager */}
          <section id='ticket-manager'>
            <h2 className='text-3xl font-semibold mb-6'>Ticket Manager</h2>

            <GlassCard className='p-6 mb-6'>
              <h3 className='text-xl font-medium mb-3'>Overview</h3>
              <p className='text-muted-foreground mb-4'>
                Manage tickets with support for batch operations, intelligent task suggestions, and advanced search
                capabilities.
              </p>

              <h4 className='font-medium mb-2'>Key Features:</h4>
              <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
                <li>Batch creation and updates</li>
                <li>AI-powered task suggestions</li>
                <li>Priority and status management</li>
                <li>Full-text search across tickets</li>
              </ul>
            </GlassCard>

            <div>
              <h4 className='font-medium mb-2'>Example: Create Ticket with Auto-Generated Tasks</h4>
              <CodeTerminal
                code={`// First create the ticket
const ticket = await mcp__promptliano__ticket_manager(
  action: "create",
  projectId: 1753220774680,
  data: {
    title: "Implement user authentication",
    overview: "Add login/logout functionality with JWT tokens",
    priority: "high",
    status: "open"
  }
)

// Then auto-generate tasks
await mcp__promptliano__ticket_manager(
  action: "auto_generate_tasks",
  ticketId: ticket.id
)`}
                language='typescript'
              />
            </div>
          </section>

          {/* Task Manager */}
          <section id='task-manager'>
            <h2 className='text-3xl font-semibold mb-6'>Task Manager</h2>

            <GlassCard className='p-6 mb-6'>
              <h3 className='text-xl font-medium mb-3'>Overview</h3>
              <p className='text-muted-foreground mb-4'>
                Fine-grained task management within tickets, including batch operations, complexity analysis, and
                context tracking.
              </p>
            </GlassCard>

            <div>
              <h4 className='font-medium mb-2'>Example: Batch Task Creation</h4>
              <CodeTerminal
                code={`mcp__promptliano__task_manager(
  action: "batch_create",
  ticketId: 456,
  data: {
    tasks: [
      { content: "Create login form component", tags: ["frontend", "ui"] },
      { content: "Implement JWT token validation", tags: ["backend", "auth"] },
      { content: "Add password hashing", tags: ["backend", "security"] }
    ]
  }
)`}
                language='typescript'
              />
            </div>
          </section>

          {/* Git Manager */}
          <section id='git-manager'>
            <h2 className='text-3xl font-semibold mb-6'>Git Manager</h2>

            <GlassCard className='p-6 mb-6'>
              <h3 className='text-xl font-medium mb-3'>Overview</h3>
              <p className='text-muted-foreground mb-4'>
                Comprehensive Git operations including worktree management, enhanced logging, and advanced branch
                operations.
              </p>

              <div className='bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mt-4'>
                <p className='text-sm'>
                  <span className='font-medium'>New in v2.0:</span> Full worktree support for parallel development
                  workflows
                </p>
              </div>
            </GlassCard>

            <div>
              <h4 className='font-medium mb-2'>Example: Create and Manage Worktree</h4>
              <CodeTerminal
                code={`// Add a new worktree
await mcp__promptliano__git_manager(
  action: "worktree_add",
  projectId: 1753220774680,
  data: {
    path: "../feature-auth",
    newBranch: "feature/authentication"
  }
)

// List all worktrees
const worktrees = await mcp__promptliano__git_manager(
  action: "worktree_list",
  projectId: 1753220774680
)`}
                language='typescript'
              />
            </div>
          </section>
        </div>

        <div className='mt-16 p-8 bg-primary/5 border border-primary/20 rounded-lg'>
          <h2 className='text-2xl font-semibold mb-4'>Need More Help?</h2>
          <p className='text-muted-foreground mb-4'>
            Check out our comprehensive guides or join the community for support.
          </p>
          <div className='flex gap-4'>
            <a href='/docs/guides' className='btn btn-primary'>
              View Guides
            </a>
            <a href='/community' className='btn btn-outline'>
              Ask Community
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
