import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui/glass-card'
import { CodeBlock } from '@/components/docs'
import { FeatureScreenshot, DownloadButton } from '@/components/ui'

export const Route = createFileRoute('/docs/getting-started')({
  loader: () => {
    return {
      meta: {
        title: 'Getting Started - Promptliano Documentation',
        description: 'Learn how to install and configure Promptliano for your development environment.',
        keywords: ['getting started', 'installation', 'setup', 'quickstart', 'tutorial']
      } as SeoMetadata
    }
  },
  component: GettingStartedPage
})

function GettingStartedPage() {
  return (
    <div className='space-y-8'>
      <div>
        <h1 className='text-4xl font-bold mb-4'>Getting Started with Promptliano</h1>
        <p className='text-xl text-muted-foreground'>
          Get up and running with Promptliano in just a few minutes. This guide will walk you through installation,
          initial setup, and creating your first project.
        </p>
      </div>

      <GlassCard className='p-8'>
        <h2 className='text-2xl font-semibold mb-4'>What You'll Need</h2>
        <ul className='space-y-2 list-disc list-inside text-muted-foreground'>
          <li>A computer running macOS, Windows, or Linux</li>
          <li>An AI-powered editor (VS Code, Cursor, Claude Desktop, or Claude Code) for MCP integration</li>
          <li>5 minutes to get up and running</li>
        </ul>
      </GlassCard>

      <section id='quickstart' className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Quick Start (3 Steps)</h2>

        <div className='space-y-6'>
          <div className='space-y-3'>
            <h3 className='text-xl font-medium'>1. Download Promptliano</h3>
            <p className='text-muted-foreground mb-4'>
              Download the right version for your platform. The button below will auto-detect your system.
            </p>
            <DownloadButton variant='dropdown' size='lg' />
            <p className='text-sm text-muted-foreground mt-2'>
              Need help? See our{' '}
              <a href='/docs/download-installation' className='text-primary hover:underline'>
                detailed installation guide
              </a>
              .
            </p>
          </div>

          <div className='space-y-3'>
            <h3 className='text-xl font-medium'>2. Run Promptliano</h3>
            <p className='text-muted-foreground'>Extract the download and start Promptliano:</p>
            <CodeBlock
              code={`# For Bun bundle (recommended)
cd promptliano-0.8.1-bun-bundle
bun run start

# For native binaries
./promptliano  # macOS/Linux
promptliano.exe  # Windows`}
              language='bash'
            />
            <p className='text-sm text-muted-foreground'>
              Promptliano will start on{' '}
              <a href='http://localhost:3579' className='text-primary hover:underline'>
                http://localhost:3579
              </a>
            </p>
          </div>

          <div className='space-y-3'>
            <h3 className='text-xl font-medium'>3. Configure Your AI Editor (Optional)</h3>
            <p className='text-muted-foreground'>
              Connect Promptliano to your AI-powered editor for seamless integration:
            </p>
            <div className='grid md:grid-cols-2 gap-4'>
              <a
                href='/integrations/cursor'
                className='block p-4 border rounded-md hover:border-primary transition-colors'
              >
                <div className='font-medium'>Cursor</div>
                <div className='text-sm text-muted-foreground'>Popular AI-first code editor</div>
              </a>
              <a
                href='/integrations/claude-desktop'
                className='block p-4 border rounded-md hover:border-primary transition-colors'
              >
                <div className='font-medium'>Claude Desktop</div>
                <div className='text-sm text-muted-foreground'>Anthropic's official desktop app</div>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id='first-project' className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Your First Project</h2>

        <div className='space-y-6'>
          <div className='space-y-3'>
            <h3 className='text-lg font-medium'>1. Open Promptliano and Create a Project</h3>
            <p className='text-muted-foreground'>
              When you first open Promptliano, you'll see the project creation dialog:
            </p>
            <FeatureScreenshot
              src='/assets/screenshots/project-selector-dialog.webp'
              alt='Project Selector Dialog'
              title='Create Your First Project'
              description='Click "Create New Project" and point it to your codebase folder'
              layout='centered'
            />
            <FeatureScreenshot
              src='/assets/screenshots/project-selector-dialog.webp'
              alt='Project Selector Dialog'
              title='Select Your Project'
              description='Choose or create a project to start working with Promptliano'
              layout='centered'
            />
          </div>

          <div className='space-y-3'>
            <h3 className='text-lg font-medium'>2. Explore Your Project Overview</h3>
            <p className='text-muted-foreground'>
              Once created, you'll see your project overview with file browser, context builder, and more:
            </p>
            <FeatureScreenshot
              src='/assets/screenshots/project-context-overview.webp'
              alt='Project Overview'
              title='Project Overview'
              description='Your command center for building AI context from your codebase'
              layout='centered'
            />
          </div>

          <div className='space-y-3'>
            <h3 className='text-lg font-medium'>3. Start Building Context</h3>
            <p className='text-muted-foreground'>
              Select files from the file browser to add them to your context. Watch the token counter to manage context
              size:
            </p>
            <FeatureScreenshot
              src='/assets/screenshots/project-context-selected-files.webp'
              alt='Selected Files'
              title='Building Context'
              description='Selected files appear on the right with token counts'
              layout='centered'
            />
            <FeatureScreenshot
              src='/assets/screenshots/tickets-overview-with-tasks.webp'
              alt='Tickets Overview'
              title='Manage Your Work'
              description='Track features and bugs with AI-generated task suggestions'
              layout='centered'
            />
          </div>
        </div>
      </section>

      <section id='key-features' className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Key Features to Explore</h2>

        <div className='grid md:grid-cols-2 gap-6'>
          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>🎯 Smart File Suggestions</h3>
            <p className='text-sm text-muted-foreground mb-3'>
              Let AI suggest relevant files based on what you're working on. Saves 60-70% tokens compared to manual
              search.
            </p>
            <FeatureScreenshot
              src='/assets/screenshots/recommended-files-dialog.webp'
              alt='File Suggestions'
              title='AI-Powered File Discovery'
              layout='centered'
            />
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>📝 Prompt Library</h3>
            <p className='text-sm text-muted-foreground mb-3'>
              Save and reuse your best prompts. Import them into any project for consistent AI interactions.
            </p>
            <FeatureScreenshot
              src='/assets/screenshots/prompt-management-library.webp'
              alt='Prompt Library'
              title='Your Prompt Collection'
              layout='centered'
            />
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>🎫 Ticket & Task Management</h3>
            <p className='text-sm text-muted-foreground mb-3'>
              Plan features with tickets and let AI generate implementation tasks based on your codebase.
            </p>
            <FeatureScreenshot
              src='/assets/screenshots/tickets-overview-with-tasks.webp'
              alt='Tickets'
              title='AI-Assisted Planning'
              layout='centered'
            />
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>🔄 MCP Integration</h3>
            <p className='text-sm text-muted-foreground mb-3'>
              Connect to AI editors via Model Context Protocol for seamless codebase access.
            </p>
            <a href='/integrations' className='text-primary text-sm hover:underline'>
              View integration guides →
            </a>
          </GlassCard>
        </div>
      </section>

      <GlassCard className='p-8 bg-primary/5 border-primary/20'>
        <h3 className='text-xl font-semibold mb-3'>Next Steps</h3>
        <p className='mb-4 text-muted-foreground'>Now that you have Promptliano set up, explore these resources:</p>
        <ul className='space-y-2'>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/guides' className='text-primary hover:underline'>
              Read the guides
            </a>
            <span className='text-muted-foreground'>for best practices</span>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/api' className='text-primary hover:underline'>
              Explore the API
            </a>
            <span className='text-muted-foreground'>for advanced features</span>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/download-installation' className='text-primary hover:underline'>
              Download & Installation
            </a>
            <span className='text-muted-foreground'>for your platform</span>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/community' className='text-primary hover:underline'>
              Join the community
            </a>
            <span className='text-muted-foreground'>for support</span>
          </li>
        </ul>
      </GlassCard>
    </div>
  )
}
