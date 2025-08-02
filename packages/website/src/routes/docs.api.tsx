import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui/glass-card'
import { CodeTerminal } from '@/components/ui/code-terminal'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { FeatureScreenshot } from '@/components/ui'

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

            <div className='space-y-6'>
              <div>
                <h4 className='font-medium mb-2'>Example: Get Project Overview</h4>
                <p className='text-sm text-muted-foreground mb-3'>AI Request:</p>
                <CodeTerminal
                  code={`mcp__promptliano__project_manager(
  action: "overview",
  projectId: 1754111018844
)`}
                  language='typescript'
                />
                <p className='text-sm text-muted-foreground mt-3 mb-3'>Response:</p>
                <CodeTerminal
                  code={`{
  "project": {
    "id": 1754111018844,
    "name": "E-Commerce Platform",
    "path": "/Users/dev/projects/ecommerce",
    "currentBranch": "feature/checkout"
  },
  "tickets": {
    "open": 5,
    "inProgress": 3,
    "closed": 47,
    "recent": [
      { "id": 234, "title": "Implement Payment Gateway", "priority": "high", "tasks": 3 },
      { "id": 235, "title": "Add Product Reviews", "priority": "normal", "tasks": 5 }
    ]
  },
  "structure": {
    "totalFiles": 342,
    "sourceFiles": 287,
    "testFiles": 45,
    "summarizedFiles": 231,
    "totalSize": "2.1MB"
  },
  "activeContext": {
    "selectedFiles": 12,
    "totalTokens": 48532
  }
}`}
                  language='json'
                />
              </div>

              <div>
                <h4 className='font-medium mb-2'>Example: Suggest Files</h4>
                <p className='text-sm text-muted-foreground mb-3'>AI Request:</p>
                <CodeTerminal
                  code={`mcp__promptliano__project_manager(
  action: "suggest_files",
  projectId: 1754111018844,
  data: {
    prompt: "authentication components",
    limit: 10
  }
)`}
                  language='typescript'
                />
                <p className='text-sm text-muted-foreground mt-3 mb-3'>Response:</p>
                <CodeTerminal
                  code={`{
  "suggestedFiles": [
    {
      "path": "/src/services/auth.service.ts",
      "reason": "Core authentication service implementation",
      "relevanceScore": 0.95,
      "hasTypeSummary": true
    },
    {
      "path": "/src/components/LoginForm.tsx",
      "reason": "Login UI component with form validation",
      "relevanceScore": 0.92,
      "hasTypeSummary": true
    },
    {
      "path": "/src/middleware/auth.middleware.ts",
      "reason": "JWT token validation middleware",
      "relevanceScore": 0.89,
      "hasTypeSummary": true
    },
    {
      "path": "/src/hooks/useAuth.ts",
      "reason": "React hook for authentication state",
      "relevanceScore": 0.87,
      "hasTypeSummary": true
    }
  ],
  "metrics": {
    "tokensUsed": 1250,
    "tokensSaved": 3750,
    "savingsPercent": "75%"
  }
}`}
                  language='json'
                />
              </div>
            </div>

            <div className='mt-6'>
              <h4 className='font-medium mb-2'>Example: Project Statistics Overview</h4>
              <FeatureScreenshot
                src='/assets/screenshots/project-statistics-overview.webp'
                alt='Project Statistics'
                title='Comprehensive Project Insights'
                description='Get detailed statistics about your project including file counts, token usage, and summarization coverage'
                layout='centered'
              />
            </div>

            <div className='mt-6'>
              <h4 className='font-medium mb-2'>MCP Tools Configuration</h4>
              <FeatureScreenshot
                src='/assets/screenshots/mcp-tools-configuration.webp'
                alt='MCP Tools Configuration'
                title='Available MCP Tools'
                description='View and configure all available MCP tools for your project'
                layout='centered'
              />
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

            <div className='space-y-6'>
              <div>
                <h4 className='font-medium mb-2'>Example: Create Ticket with Auto-Generated Tasks</h4>
                <p className='text-sm text-muted-foreground mb-3'>AI Request (Create Ticket):</p>
                <CodeTerminal
                  code={`mcp__promptliano__ticket_manager(
  action: "create",
  projectId: 1754111018844,
  data: {
    title: "Implement user authentication",
    overview: "Add login/logout functionality with JWT tokens",
    priority: "high",
    status: "open"
  }
)`}
                  language='typescript'
                />
                <p className='text-sm text-muted-foreground mt-3 mb-3'>Response:</p>
                <CodeTerminal
                  code={`{
  "id": 456,
  "projectId": 1754111018844,
  "title": "Implement user authentication",
  "overview": "Add login/logout functionality with JWT tokens",
  "priority": "high",
  "status": "open",
  "createdAt": "2025-01-31T10:30:00Z",
  "updatedAt": "2025-01-31T10:30:00Z"
}`}
                  language='json'
                />

                <p className='text-sm text-muted-foreground mt-6 mb-3'>AI Request (Auto-Generate Tasks):</p>
                <CodeTerminal
                  code={`mcp__promptliano__ticket_manager(
  action: "auto_generate_tasks",
  ticketId: 456
)`}
                  language='typescript'
                />
                <p className='text-sm text-muted-foreground mt-3 mb-3'>Response:</p>
                <CodeTerminal
                  code={`{
  "ticketId": 456,
  "tasksCreated": 8,
  "tasks": [
    {
      "id": 789,
      "content": "Create user model and database schema",
      "description": "Define User model with fields for email, password hash, created/updated timestamps",
      "suggestedFiles": ["/src/models/user.model.ts", "/src/schemas/user.schema.ts"],
      "tags": ["backend", "database"],
      "estimatedHours": 2
    },
    {
      "id": 790,
      "content": "Implement password hashing service",
      "description": "Create service for hashing passwords using bcrypt with salt rounds",
      "suggestedFiles": ["/src/services/crypto.service.ts"],
      "tags": ["backend", "security"],
      "estimatedHours": 1
    },
    {
      "id": 791,
      "content": "Create JWT token service",
      "description": "Implement JWT token generation and validation with refresh token support",
      "suggestedFiles": ["/src/services/token.service.ts"],
      "tags": ["backend", "auth"],
      "estimatedHours": 3
    },
    {
      "id": 792,
      "content": "Build login API endpoint",
      "description": "Create POST /api/auth/login endpoint with email/password validation",
      "suggestedFiles": ["/src/routes/auth.routes.ts"],
      "tags": ["backend", "api"],
      "estimatedHours": 2
    },
    {
      "id": 793,
      "content": "Build logout API endpoint",
      "description": "Create POST /api/auth/logout endpoint to invalidate tokens",
      "suggestedFiles": ["/src/routes/auth.routes.ts"],
      "tags": ["backend", "api"],
      "estimatedHours": 1
    },
    {
      "id": 794,
      "content": "Create auth middleware",
      "description": "Implement middleware to validate JWT tokens on protected routes",
      "suggestedFiles": ["/src/middleware/auth.middleware.ts"],
      "tags": ["backend", "middleware"],
      "estimatedHours": 2
    },
    {
      "id": 795,
      "content": "Build login form component",
      "description": "Create React component with form validation and error handling",
      "suggestedFiles": ["/src/components/LoginForm.tsx"],
      "tags": ["frontend", "ui"],
      "estimatedHours": 3
    },
    {
      "id": 796,
      "content": "Implement auth context and hooks",
      "description": "Create AuthContext and useAuth hook for managing auth state",
      "suggestedFiles": ["/src/contexts/AuthContext.tsx", "/src/hooks/useAuth.ts"],
      "tags": ["frontend", "state"],
      "estimatedHours": 2
    }
  ]
}`}
                  language='json'
                />
              </div>
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

            <div className='space-y-6'>
              <div>
                <h4 className='font-medium mb-2'>Example: Batch Task Creation</h4>
                <p className='text-sm text-muted-foreground mb-3'>AI Request:</p>
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
                <p className='text-sm text-muted-foreground mt-3 mb-3'>Response:</p>
                <CodeTerminal
                  code={`{
  "ticketId": 456,
  "tasksCreated": 3,
  "tasks": [
    {
      "id": 797,
      "ticketId": 456,
      "content": "Create login form component",
      "description": "",
      "done": false,
      "order": 9,
      "tags": ["frontend", "ui"],
      "suggestedFileIds": ["file_123", "file_124"],
      "createdAt": "2025-01-31T10:45:00Z",
      "updatedAt": "2025-01-31T10:45:00Z"
    },
    {
      "id": 798,
      "ticketId": 456,
      "content": "Implement JWT token validation",
      "description": "",
      "done": false,
      "order": 10,
      "tags": ["backend", "auth"],
      "suggestedFileIds": ["file_125", "file_126"],
      "createdAt": "2025-01-31T10:45:00Z",
      "updatedAt": "2025-01-31T10:45:00Z"
    },
    {
      "id": 799,
      "ticketId": 456,
      "content": "Add password hashing",
      "description": "",
      "done": false,
      "order": 11,
      "tags": ["backend", "security"],
      "suggestedFileIds": ["file_127"],
      "createdAt": "2025-01-31T10:45:00Z",
      "updatedAt": "2025-01-31T10:45:00Z"
    }
  ],
  "filesContext": {
    "file_123": { "path": "/src/components/LoginForm.tsx", "hasTypeSummary": true },
    "file_124": { "path": "/src/components/ui/Form.tsx", "hasTypeSummary": true },
    "file_125": { "path": "/src/services/token.service.ts", "hasTypeSummary": true },
    "file_126": { "path": "/src/middleware/auth.middleware.ts", "hasTypeSummary": true },
    "file_127": { "path": "/src/services/crypto.service.ts", "hasTypeSummary": true }
  }
}`}
                  language='json'
                />
              </div>
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

            <div className='space-y-6'>
              <div>
                <h4 className='font-medium mb-2'>Example: Create and Manage Worktree</h4>
                <p className='text-sm text-muted-foreground mb-3'>AI Request (Add Worktree):</p>
                <CodeTerminal
                  code={`mcp__promptliano__git_manager(
  action: "worktree_add",
  projectId: 1754111018844,
  data: {
    path: "../feature-auth",
    newBranch: "feature/authentication"
  }
)`}
                  language='typescript'
                />
                <p className='text-sm text-muted-foreground mt-3 mb-3'>Response:</p>
                <CodeTerminal
                  code={`{
  "success": true,
  "worktree": {
    "path": "/Users/dev/projects/feature-auth",
    "branch": "feature/authentication",
    "commit": "a1b2c3d4e5f6",
    "bare": false,
    "detached": false,
    "locked": false
  },
  "message": "Worktree created successfully at /Users/dev/projects/feature-auth"
}`}
                  language='json'
                />

                <p className='text-sm text-muted-foreground mt-6 mb-3'>AI Request (List Worktrees):</p>
                <CodeTerminal
                  code={`mcp__promptliano__git_manager(
  action: "worktree_list",
  projectId: 1754111018844
)`}
                  language='typescript'
                />
                <p className='text-sm text-muted-foreground mt-3 mb-3'>Response:</p>
                <CodeTerminal
                  code={`{
  "worktrees": [
    {
      "path": "/Users/dev/projects/ecommerce",
      "branch": "main",
      "commit": "f5e4d3c2b1a0",
      "bare": false,
      "detached": false,
      "locked": false,
      "isMain": true
    },
    {
      "path": "/Users/dev/projects/feature-auth",
      "branch": "feature/authentication",
      "commit": "a1b2c3d4e5f6",
      "bare": false,
      "detached": false,
      "locked": false,
      "isMain": false
    },
    {
      "path": "/Users/dev/projects/hotfix-payment",
      "branch": "hotfix/payment-bug",
      "commit": "9f8e7d6c5b4a",
      "bare": false,
      "detached": false,
      "locked": true,
      "lockReason": "Critical hotfix in progress",
      "isMain": false
    }
  ],
  "count": 3
}`}
                  language='json'
                />
              </div>
            </div>

            <div className='mt-6'>
              <h4 className='font-medium mb-2'>Git Branches Management</h4>
              <FeatureScreenshot
                src='/assets/screenshots/git-branches-list.webp'
                alt='Git Branches'
                title='Branch Management Interface'
                description='View and manage all Git branches with visual indicators for current branch and remote tracking'
                layout='centered'
              />
            </div>

            <div className='mt-6'>
              <h4 className='font-medium mb-2'>Git Worktrees Overview</h4>
              <FeatureScreenshot
                src='/assets/screenshots/git-worktrees-overview.webp'
                alt='Git Worktrees'
                title='Parallel Development with Worktrees'
                description='Manage multiple worktrees for parallel development workflows'
                layout='centered'
              />
            </div>

            <div className='mt-6'>
              <h4 className='font-medium mb-2'>Git Commit History</h4>
              <FeatureScreenshot
                src='/assets/screenshots/git-commit-history-view.webp'
                alt='Git History'
                title='Detailed Commit History'
                description='Browse commit history with full details, diffs, and file changes'
                layout='centered'
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
