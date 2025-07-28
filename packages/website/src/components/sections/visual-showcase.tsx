import { ScreenshotGallery } from '@/components/ui'
import { AnimateOnScroll } from '@/components/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const showcaseCategories = {
  workflow: {
    title: 'Development Workflow',
    screenshots: [
      {
        src: '/assets/screenshots/project-context-overview.webp',
        alt: 'Project Context Overview',
        title: 'Project Context Management',
        description: 'Organize files, prompts, and context for AI assistance'
      },
      {
        src: '/assets/screenshots/project-context-selected-files.webp',
        alt: 'Selected Files View',
        title: 'Smart File Selection',
        description: 'Choose relevant files for your current task'
      },
      {
        src: '/assets/screenshots/project-context-multiple-files-selected.webp',
        alt: 'Multiple Files Selected',
        title: 'Batch File Management',
        description: 'Work with multiple files simultaneously'
      }
    ]
  },
  ai: {
    title: 'AI-Powered Features',
    screenshots: [
      {
        src: '/assets/screenshots/recommended-files-dialog.webp',
        alt: 'AI File Recommendations',
        title: 'Smart File Suggestions',
        description: 'AI analyzes your task and suggests relevant files'
      },
      {
        src: '/assets/screenshots/recommended-prompts-dialog.webp',
        alt: 'Recommended Prompts',
        title: 'Context-Aware Prompts',
        description: 'Get prompt suggestions based on your project'
      },
      {
        src: '/assets/screenshots/claude-code-agents-overview.webp',
        alt: 'Claude Code Agents',
        title: 'Specialized AI Agents',
        description: 'Use specialized agents for different tasks'
      }
    ]
  },
  git: {
    title: 'Git Integration',
    screenshots: [
      {
        src: '/assets/screenshots/git-stash-management.webp',
        alt: 'Git Stash Management',
        title: 'Stash Management',
        description: 'Save and manage uncommitted changes'
      },
      {
        src: '/assets/screenshots/git-worktrees-overview.webp',
        alt: 'Git Worktrees',
        title: 'Worktree Support',
        description: 'Work on multiple branches simultaneously'
      },
      {
        src: '/assets/screenshots/git-commit-history-view.webp',
        alt: 'Commit History',
        title: 'Visual Commit History',
        description: 'Browse and understand project history'
      }
    ]
  },
  management: {
    title: 'Project Management',
    screenshots: [
      {
        src: '/assets/screenshots/tickets-overview-with-tasks.webp',
        alt: 'Tickets and Tasks',
        title: 'Ticket Management',
        description: 'Track features and bugs with AI-generated tasks'
      },
      {
        src: '/assets/screenshots/project-statistics-overview.webp',
        alt: 'Project Statistics',
        title: 'Project Analytics',
        description: 'Monitor project health and progress'
      },
      {
        src: '/assets/screenshots/summarization-coverage-overview.webp',
        alt: 'Summarization Coverage',
        title: 'Code Understanding',
        description: 'Track AI understanding of your codebase'
      }
    ]
  },
  chat: {
    title: 'Chat & Collaboration',
    screenshots: [
      {
        src: '/assets/screenshots/chat-interface-conversation.webp',
        alt: 'AI Chat Interface',
        title: 'Interactive AI Chat',
        description: 'Collaborate with AI on your code'
      },
      {
        src: '/assets/screenshots/chat-with-file-context.webp',
        alt: 'Chat with File Context',
        title: 'Contextual Conversations',
        description: 'Chat with full file context awareness'
      },
      {
        src: '/assets/screenshots/prompt-management-library.webp',
        alt: 'Prompt Library',
        title: 'Reusable Prompts',
        description: 'Build and manage your prompt library'
      }
    ]
  }
}

export function VisualShowcaseSection() {
  return (
    <section className='relative py-24 overflow-hidden bg-muted/30'>
      <div className='container mx-auto px-4'>
        <AnimateOnScroll>
          <div className='text-center max-w-3xl mx-auto mb-16'>
            <h2 className='text-3xl md:text-4xl font-bold mb-4'>
              See Promptliano in Action
            </h2>
            <p className='text-lg text-muted-foreground'>
              Explore how Promptliano transforms your development workflow with intelligent context management and AI assistance
            </p>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll>
          <Tabs defaultValue='workflow' className='w-full'>
            <TabsList className='grid w-full max-w-2xl mx-auto grid-cols-5 mb-8'>
              <TabsTrigger value='workflow'>Workflow</TabsTrigger>
              <TabsTrigger value='ai'>AI Features</TabsTrigger>
              <TabsTrigger value='git'>Git Tools</TabsTrigger>
              <TabsTrigger value='management'>Management</TabsTrigger>
              <TabsTrigger value='chat'>Chat</TabsTrigger>
            </TabsList>

            {Object.entries(showcaseCategories).map(([key, category]) => (
              <TabsContent key={key} value={key} className='mt-8'>
                <ScreenshotGallery
                  screenshots={category.screenshots}
                  columns={{ mobile: 1, tablet: 2, desktop: 3 }}
                />
              </TabsContent>
            ))}
          </Tabs>
        </AnimateOnScroll>

        <AnimateOnScroll>
          <div className='mt-16 text-center'>
            <p className='text-muted-foreground mb-6'>
              Ready to experience these features yourself?
            </p>
            <div className='flex gap-4 justify-center'>
              <a href='/demos' className='btn btn-primary'>
                Try Interactive Demos
              </a>
              <a href='/docs/getting-started' className='btn btn-outline'>
                Get Started
              </a>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  )
}