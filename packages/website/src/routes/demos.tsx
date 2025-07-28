import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui/glass-card'
import { CodeTerminal } from '@/components/ui/code-terminal'
import { ScreenshotGallery, FeatureScreenshot } from '@/components/ui'
import { LiveDemo, ContextVisualizer, CodePlayground, MCPToolsDemo } from '@/components/demos'
import { ArrowLeft } from 'lucide-react'

const demoSchema = z.object({
  demo: z
    .enum([
      'file-suggestions',
      'project-context',
      'git-workflow',
      'prompt-library',
      'live-walkthrough',
      'context-visualization',
      'code-improvement',
      'mcp-tools'
    ])
    .optional()
})

type DemoId = z.infer<typeof demoSchema>['demo']

export const Route = createFileRoute('/demos')({
  validateSearch: demoSchema,
  loader: () => {
    return {
      meta: {
        title: 'Interactive Demos - Promptliano',
        description: 'Experience Promptliano in action with interactive demonstrations of key features.',
        keywords: ['demos', 'interactive', 'examples', 'features', 'live demo']
      } as SeoMetadata
    }
  },
  component: DemosPage
})

interface Demo {
  id: NonNullable<DemoId>
  title: string
  description: string
  icon: string
  duration: string
}

const demos: Demo[] = [
  {
    id: 'live-walkthrough',
    title: 'Interactive Walkthrough',
    description: "Step-by-step demonstration of Promptliano's core features",
    icon: '🚀',
    duration: '5 min'
  },
  {
    id: 'context-visualization',
    title: 'Context Building Visualization',
    description: 'See how Promptliano reduces tokens by 95% while improving relevance',
    icon: '📊',
    duration: '3 min'
  },
  {
    id: 'code-improvement',
    title: 'Code Improvement Playground',
    description: 'Watch Promptliano transform your code with best practices',
    icon: '✨',
    duration: '4 min'
  },
  {
    id: 'mcp-tools',
    title: 'MCP Tools Showcase',
    description: 'Explore the powerful Model Context Protocol tools',
    icon: '🛠️',
    duration: '3 min'
  },
  {
    id: 'file-suggestions',
    title: 'Intelligent File Suggestions',
    description: 'See how Promptliano suggests relevant files based on context and task requirements',
    icon: '🎯',
    duration: '2 min'
  },
  {
    id: 'project-context',
    title: 'Building Project Context',
    description: 'Watch how Promptliano builds and maintains rich context about your codebase',
    icon: '🧠',
    duration: '3 min'
  },
  {
    id: 'git-workflow',
    title: 'Git Integration Workflow',
    description: 'Experience seamless Git operations with worktree support and intelligent diffs',
    icon: '🔀',
    duration: '4 min'
  },
  {
    id: 'prompt-library',
    title: 'Prompt Library Management',
    description: 'Learn how to organize and reuse prompts across projects',
    icon: '📚',
    duration: '2 min'
  }
]

function DemosPage() {
  const navigate = Route.useNavigate()
  const { demo } = Route.useSearch()

  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        <div className='text-center mb-12'>
          <h1 className='text-4xl md:text-5xl font-bold mb-4'>Interactive Demos</h1>
          <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
            Experience the power of Promptliano through interactive demonstrations
          </p>
        </div>

        {!demo ? (
          <div className='grid md:grid-cols-2 gap-8'>
            {demos.map((demoItem) => (
              <button
                key={demoItem.id}
                onClick={() => navigate({ search: { demo: demoItem.id } })}
                className='text-left transition-transform hover:scale-[1.02]'
              >
                <GlassCard className='p-8 h-full hover:border-primary/50'>
                  <div className='flex items-start justify-between mb-4'>
                    <span className='text-4xl'>{demoItem.icon}</span>
                    <span className='text-sm text-muted-foreground'>{demoItem.duration}</span>
                  </div>
                  <h3 className='text-2xl font-semibold mb-2'>{demoItem.title}</h3>
                  <p className='text-muted-foreground'>{demoItem.description}</p>
                </GlassCard>
              </button>
            ))}
          </div>
        ) : (
          <DemoPlayer demoId={demo} />
        )}

        <div className='mt-16 text-center'>
          <h2 className='text-2xl font-semibold mb-4'>Want to Try It Yourself?</h2>
          <p className='text-muted-foreground mb-8'>
            Get started with Promptliano and experience these features in your own projects
          </p>
          <a href='/docs/getting-started' className='btn btn-primary'>
            Get Started Now
          </a>
        </div>
      </div>
    </div>
  )
}

function DemoPlayer({ demoId }: { demoId: string }) {
  const navigate = Route.useNavigate()
  const demo = demos.find((d) => d.id === demoId)

  if (!demo) return null

  // Define demo steps for the live walkthrough
  const walkthroughSteps = [
    {
      id: 1,
      title: 'Connect Your Project',
      description: 'Start by connecting Promptliano to your project repository',
      code: `mcp__promptliano__project_manager(
  action: "create",
  data: {
    name: "My Awesome Project",
    path: "/path/to/project"
  }
)`,
      output: `{
  "projectId": 1753220774680,
  "name": "My Awesome Project",
  "status": "connected",
  "filesIndexed": 629
}`,
      duration: 3000
    },
    {
      id: 2,
      title: 'Create a Ticket',
      description: 'Organize your work by creating tickets for features or bugs',
      code: `mcp__promptliano__ticket_manager(
  action: "create",
  projectId: 1753220774680,
  data: {
    title: "Add user authentication",
    priority: "high"
  }
)`,
      output: `{
  "ticketId": 1753633266818,
  "title": "Add user authentication",
  "suggestedTasks": [
    "Create auth schemas",
    "Build login component",
    "Add JWT middleware"
  ]
}`,
      duration: 3000
    },
    {
      id: 3,
      title: 'Get Smart File Suggestions',
      description: 'Promptliano suggests the most relevant files for your task',
      code: `mcp__promptliano__ticket_manager(
  action: "suggest_files",
  ticketId: 1753633266818,
  data: { strategy: "balanced" }
)`,
      output: `{
  "suggestedFiles": [
    "src/auth/login.tsx",
    "src/hooks/useAuth.ts",
    "src/api/auth.service.ts"
  ],
  "tokensSaved": "95%"
}`,
      duration: 3000
    }
  ]

  const renderDemo = () => {
    switch (demoId) {
      case 'live-walkthrough':
        return (
          <LiveDemo
            title='Promptliano Walkthrough'
            description='Experience the core features of Promptliano in action'
            steps={walkthroughSteps}
            onComplete={() => console.log('Demo completed!')}
          />
        )

      case 'context-visualization':
        return <ContextVisualizer scenario='file-search' />

      case 'code-improvement':
        return <CodePlayground />

      case 'mcp-tools':
        return <MCPToolsDemo />

      case 'file-suggestions':
        return (
          <GlassCard className='p-8'>
            <div className='mb-6'>
              <h2 className='text-3xl font-bold mb-2'>{demo.title}</h2>
              <p className='text-muted-foreground'>{demo.description}</p>
            </div>
            <ScreenshotGallery
              screenshots={[
                {
                  src: '/assets/screenshots/recommended-files-dialog.webp',
                  alt: 'AI File Recommendations',
                  title: 'Initial Suggestions',
                  description: 'AI analyzes your prompt and suggests relevant files'
                },
                {
                  src: '/assets/screenshots/recommended-files-dialog-filtered.webp',
                  alt: 'Filtered File Recommendations',
                  title: 'Refined Results',
                  description: 'Filter and refine suggestions for better accuracy'
                }
              ]}
              columns={{ mobile: 1, tablet: 2, desktop: 2 }}
            />
          </GlassCard>
        )

      case 'project-context':
        return (
          <GlassCard className='p-8'>
            <div className='mb-6'>
              <h2 className='text-3xl font-bold mb-2'>{demo.title}</h2>
              <p className='text-muted-foreground'>{demo.description}</p>
            </div>
            <ScreenshotGallery
              screenshots={[
                {
                  src: '/assets/screenshots/project-context-overview.webp',
                  alt: 'Project Context Overview',
                  title: 'Main Context View',
                  description: 'Central hub for managing project context'
                },
                {
                  src: '/assets/screenshots/project-context-selected-files.webp',
                  alt: 'Selected Files',
                  title: 'File Selection',
                  description: 'Choose and organize relevant files'
                },
                {
                  src: '/assets/screenshots/project-context-multiple-files-selected.webp',
                  alt: 'Multiple Files',
                  title: 'Batch Management',
                  description: 'Work with multiple files simultaneously'
                }
              ]}
              columns={{ mobile: 1, tablet: 2, desktop: 3 }}
            />
          </GlassCard>
        )

      case 'git-workflow':
        return (
          <GlassCard className='p-8'>
            <div className='mb-6'>
              <h2 className='text-3xl font-bold mb-2'>{demo.title}</h2>
              <p className='text-muted-foreground'>{demo.description}</p>
            </div>
            <ScreenshotGallery
              screenshots={[
                {
                  src: '/assets/screenshots/git-commit-history-view.webp',
                  alt: 'Git Commit History',
                  title: 'Commit History',
                  description: 'Visual timeline of project commits'
                },
                {
                  src: '/assets/screenshots/git-branch-management.webp',
                  alt: 'Branch Management',
                  title: 'Branch Operations',
                  description: 'Create, switch, and manage branches'
                },
                {
                  src: '/assets/screenshots/git-stashes-list.webp',
                  alt: 'Git Stashes',
                  title: 'Stash Management',
                  description: 'Save and restore work in progress'
                }
              ]}
              columns={{ mobile: 1, tablet: 2, desktop: 3 }}
            />
          </GlassCard>
        )

      case 'prompt-library':
        return (
          <GlassCard className='p-8'>
            <div className='mb-6'>
              <h2 className='text-3xl font-bold mb-2'>{demo.title}</h2>
              <p className='text-muted-foreground'>{demo.description}</p>
            </div>
            <FeatureScreenshot
              src='/assets/screenshots/prompt-management-library.webp'
              alt='Prompt Management Library'
              title='Organized Prompt Collection'
              description='Build a library of reusable prompts for different scenarios'
              layout='centered'
              priority
            />
          </GlassCard>
        )

      // Legacy demos using simple display
      default:
        return (
          <GlassCard className='p-8'>
            <div className='flex items-start justify-between mb-6'>
              <div>
                <h2 className='text-3xl font-bold mb-2'>{demo.title}</h2>
                <p className='text-muted-foreground'>{demo.description}</p>
              </div>
              <span className='text-4xl'>{demo.icon}</span>
            </div>

            <div className='space-y-6'>
              <div className='text-center p-12'>
                <p className='text-muted-foreground'>
                  This demo is coming soon. Try one of our interactive demos above!
                </p>
              </div>
            </div>
          </GlassCard>
        )
    }
  }

  return (
    <div className='max-w-5xl mx-auto'>
      <button
        onClick={() => navigate({ search: { demo: undefined } })}
        className='mb-8 text-primary hover:underline flex items-center space-x-2'
      >
        <ArrowLeft className='h-4 w-4' />
        <span>Back to all demos</span>
      </button>

      {renderDemo()}

      <div className='mt-12 text-center'>
        <p className='text-muted-foreground mb-4'>Ready to use this feature in your workflow?</p>
        <a href='/docs/guides' className='btn btn-outline'>
          View Documentation
        </a>
      </div>
    </div>
  )
}
