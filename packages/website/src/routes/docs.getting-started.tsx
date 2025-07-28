import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui/glass-card'
import { CodeBlock } from '@/components/docs'
import { FeatureScreenshot } from '@/components/ui'

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
        <h2 className='text-2xl font-semibold mb-4'>Prerequisites</h2>
        <ul className='space-y-2 list-disc list-inside text-muted-foreground'>
          <li>Node.js 18.0.0 or later</li>
          <li>VS Code, Cursor, Claude Desktop, or Claude Code</li>
          <li>Git installed on your system</li>
        </ul>
      </GlassCard>

      <section id='installation' className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Installation</h2>

        <div className='space-y-3'>
          <h3 className='text-xl font-medium'>1. Install the MCP Server</h3>
          <CodeBlock code='npm install -g @promptliano/mcp-server' language='bash' />
        </div>

        <div className='space-y-3'>
          <h3 className='text-xl font-medium'>2. Initialize Promptliano</h3>
          <CodeBlock code='promptliano init' language='bash' />
        </div>

        <div className='space-y-3'>
          <h3 className='text-xl font-medium'>3. Configure your editor</h3>
          <p className='text-muted-foreground'>Choose your editor for specific setup instructions:</p>
          <div className='grid md:grid-cols-2 gap-4'>
            <a
              href='/integrations/vscode'
              className='block p-4 border rounded-md hover:border-primary transition-colors'
            >
              <div className='font-medium'>VS Code</div>
              <div className='text-sm text-muted-foreground'>Configure Promptliano for VS Code</div>
            </a>
            <a
              href='/integrations/cursor'
              className='block p-4 border rounded-md hover:border-primary transition-colors'
            >
              <div className='font-medium'>Cursor</div>
              <div className='text-sm text-muted-foreground'>Set up Promptliano in Cursor</div>
            </a>
            <a
              href='/integrations/claude-desktop'
              className='block p-4 border rounded-md hover:border-primary transition-colors'
            >
              <div className='font-medium'>Claude Desktop</div>
              <div className='text-sm text-muted-foreground'>Use with Claude Desktop app</div>
            </a>
            <a
              href='/integrations/claude-code'
              className='block p-4 border rounded-md hover:border-primary transition-colors'
            >
              <div className='font-medium'>Claude Code</div>
              <div className='text-sm text-muted-foreground'>Integrate with Claude Code</div>
            </a>
          </div>
        </div>
      </section>

      <section id='first-project' className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Creating Your First Project</h2>

        <div className='space-y-6'>
          <div className='space-y-3'>
            <h3 className='text-lg font-medium'>1. Create a new project</h3>
            <CodeBlock
              code="promptliano project create --name 'My First Project' --path ./my-project"
              language='bash'
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
            <h3 className='text-lg font-medium'>2. Add your first prompt</h3>
            <CodeBlock
              code={`promptliano prompt add --name "Code Review" --content "Review this code for best practices and potential improvements"`}
              language='bash'
            />
          </div>

          <div className='space-y-3'>
            <h3 className='text-lg font-medium'>3. Create a ticket</h3>
            <CodeBlock
              code={`promptliano ticket create --title "Implement user authentication" --priority high`}
              language='bash'
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

      <section id='configuration' className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Configuration</h2>

        <p className='text-muted-foreground'>
          Promptliano can be configured through the{' '}
          <code className='px-1.5 py-0.5 bg-muted rounded text-sm'>.promptliano/config.json</code> file in your project
          root:
        </p>

        <CodeBlock
          code={`{
  "project": {
    "name": "My Project",
    "description": "A sample project",
    "excludePatterns": ["node_modules", ".git", "dist"]
  },
  "ai": {
    "maxTokens": 10000,
    "temperature": 0.7
  },
  "git": {
    "autoCommit": false,
    "commitMessageTemplate": "feat: {description}"
  }
}`}
          language='json'
          filename='.promptliano/config.json'
          showLineNumbers
        />
        
        <FeatureScreenshot
          src='/assets/screenshots/settings-dialog.webp'
          alt='Settings Dialog'
          title='Configure Your Preferences'
          description='Customize Promptliano settings through the UI or configuration files'
          layout='centered'
        />
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
            <a href='/demos' className='text-primary hover:underline'>
              Watch demos
            </a>
            <span className='text-muted-foreground'>to see Promptliano in action</span>
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
