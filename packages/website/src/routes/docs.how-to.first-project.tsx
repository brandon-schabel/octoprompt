import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui'
import { CodeBlock } from '@/components/docs'
import { FeatureScreenshot } from '@/components/ui'
import { CheckCircle, AlertCircle, Lightbulb } from 'lucide-react'

export const Route = createFileRoute('/docs/how-to/first-project')({
  loader: () => {
    return {
      meta: {
        title: 'Your First Project - Promptliano How-To Guide',
        description: 'Step-by-step guide to creating and setting up your first project in Promptliano.',
        keywords: ['first project', 'getting started', 'tutorial', 'how to', 'beginner guide']
      } as SeoMetadata
    }
  },
  component: FirstProjectGuide
})

function FirstProjectGuide() {
  return (
    <div className='space-y-8'>
      <div>
        <h1 className='text-4xl font-bold mb-4'>Creating Your First Project</h1>
        <p className='text-xl text-muted-foreground'>
          This guide walks you through creating your first Promptliano project, from initial setup to your first
          AI-powered workflow.
        </p>
      </div>

      {/* Prerequisites */}
      <GlassCard className='p-6 bg-blue-500/5 border-blue-500/20'>
        <div className='flex items-start gap-3'>
          <CheckCircle className='h-5 w-5 text-blue-500 mt-0.5' />
          <div>
            <h3 className='font-medium mb-2'>Before You Start</h3>
            <p className='text-sm text-muted-foreground'>
              Make sure you have Promptliano running. If not, see our{' '}
              <a href='/docs/download-installation' className='text-primary hover:underline'>
                installation guide
              </a>
              .
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Step 1: Create Project */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold'>
            1
          </span>
          Create Your Project
        </h2>

        <div className='space-y-6'>
          <p className='text-muted-foreground'>
            When you first open Promptliano, you'll see the project creation dialog. If you already have projects, click
            the project name in the top-left to access the project selector.
          </p>

          <FeatureScreenshot
            src='/assets/screenshots/project-selector-dialog.webp'
            alt='Project Creation Dialog'
            title='Project Creation Dialog'
            description='Click "Create New Project" to get started'
            layout='centered'
          />

          <div className='space-y-4'>
            <h3 className='text-xl font-medium'>Fill in Project Details</h3>

            <div className='grid md:grid-cols-2 gap-4'>
              <GlassCard className='p-4'>
                <h4 className='font-medium mb-2'>Project Name</h4>
                <p className='text-sm text-muted-foreground'>
                  Give your project a descriptive name like "My App" or "Client Website"
                </p>
              </GlassCard>

              <GlassCard className='p-4'>
                <h4 className='font-medium mb-2'>Project Path</h4>
                <p className='text-sm text-muted-foreground'>
                  Click "Browse" and select your project's root folder (where your code lives)
                </p>
              </GlassCard>
            </div>

            <div className='bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4'>
              <div className='flex items-start gap-2'>
                <AlertCircle className='h-5 w-5 text-yellow-500 mt-0.5' />
                <div>
                  <p className='font-medium'>Pro Tip: Choose the Right Folder</p>
                  <p className='text-sm text-muted-foreground mt-1'>
                    Select the root folder that contains your entire codebase. Promptliano will respect your .gitignore
                    file and won't index excluded files.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Step 2: Explore Interface */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold'>
            2
          </span>
          Explore Your Project Interface
        </h2>

        <p className='text-muted-foreground'>
          Once created, you'll see your project overview. Let's understand what you're looking at:
        </p>

        <FeatureScreenshot
          src='/assets/screenshots/project-context-overview.webp'
          alt='Project Overview'
          title='Your Project Workspace'
          description='The main interface for working with your codebase'
          layout='centered'
        />

        <div className='grid md:grid-cols-2 gap-6'>
          <div className='space-y-4'>
            <h3 className='text-lg font-medium'>Key Areas to Know</h3>

            <GlassCard className='p-4'>
              <h4 className='font-medium mb-2'>File Browser (Left)</h4>
              <ul className='text-sm text-muted-foreground space-y-1'>
                <li>• Shows all files in your project</li>
                <li>• Click any file to add it to context</li>
                <li>• Search with Cmd/Ctrl + K</li>
              </ul>
            </GlassCard>

            <GlassCard className='p-4'>
              <h4 className='font-medium mb-2'>Selected Files (Right)</h4>
              <ul className='text-sm text-muted-foreground space-y-1'>
                <li>• Shows files you've selected</li>
                <li>• Displays token count per file</li>
                <li>• Remove files with the X button</li>
              </ul>
            </GlassCard>
          </div>

          <div className='space-y-4'>
            <h3 className='text-lg font-medium'>Quick Actions</h3>

            <GlassCard className='p-4'>
              <h4 className='font-medium mb-2'>User Input Box</h4>
              <p className='text-sm text-muted-foreground'>
                Describe what you want to work on. This helps AI understand your context and suggest relevant files.
              </p>
            </GlassCard>

            <GlassCard className='p-4'>
              <h4 className='font-medium mb-2'>Action Buttons</h4>
              <ul className='text-sm text-muted-foreground space-y-1'>
                <li>
                  • <strong>Copy All</strong> - Copy your entire context
                </li>
                <li>
                  • <strong>Suggest Files</strong> - Get AI recommendations
                </li>
                <li>
                  • <strong>Summary</strong> - View project overview
                </li>
              </ul>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Step 3: First Context */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold'>
            3
          </span>
          Build Your First Context
        </h2>

        <p className='text-muted-foreground'>
          Let's practice building context for a simple task. We'll use the example of adding a new feature to your
          project.
        </p>

        <div className='space-y-6'>
          <div>
            <h3 className='text-xl font-medium mb-3'>Step 3.1: Describe Your Task</h3>
            <p className='text-muted-foreground mb-3'>In the User Input box, describe what you want to do:</p>
            <CodeBlock
              code='I need to add a user authentication feature with login and logout functionality'
              language='text'
              filename='User Input'
            />
          </div>

          <div>
            <h3 className='text-xl font-medium mb-3'>Step 3.2: Get File Suggestions</h3>
            <p className='text-muted-foreground mb-3'>
              Click the "Suggest Files" button to let AI recommend relevant files:
            </p>
            <FeatureScreenshot
              src='/assets/screenshots/recommended-files-dialog.webp'
              alt='File Suggestions'
              title='AI File Suggestions'
              description='AI analyzes your task and suggests relevant files from your codebase'
              layout='centered'
            />
            <p className='text-sm text-muted-foreground mt-2'>
              Review the suggestions and select the ones that look relevant to your task.
            </p>
          </div>

          <div>
            <h3 className='text-xl font-medium mb-3'>Step 3.3: Add Additional Files</h3>
            <p className='text-muted-foreground mb-3'>You can also manually browse and select files:</p>
            <ul className='space-y-2 text-muted-foreground'>
              <li>• Navigate through folders in the file browser</li>
              <li>• Click files to add them to your selection</li>
              <li>• Watch the token counter to manage context size</li>
            </ul>
          </div>

          <div>
            <h3 className='text-xl font-medium mb-3'>Step 3.4: Copy Your Context</h3>
            <FeatureScreenshot
              src='/assets/screenshots/project-context-selected-files.webp'
              alt='Selected Files with Copy Button'
              title='Ready to Use Your Context'
              description='Click "Copy All" to copy your complete context to clipboard'
              layout='centered'
            />
            <p className='text-muted-foreground mt-3'>
              Click "Copy All" to copy your selected files, prompts, and instructions to your clipboard. You can now
              paste this into any AI tool!
            </p>
          </div>
        </div>
      </section>

      {/* Step 4: MCP Integration */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold'>
            4
          </span>
          Connect Your AI Editor (Optional)
        </h2>

        <p className='text-muted-foreground'>
          For the best experience, connect Promptliano to your AI-powered editor via MCP (Model Context Protocol).
        </p>

        <div className='grid md:grid-cols-2 gap-6'>
          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>Benefits of MCP Integration</h3>
            <ul className='space-y-2 text-sm text-muted-foreground'>
              <li>✓ Direct access to project context from your editor</li>
              <li>✓ No manual copying and pasting</li>
              <li>✓ AI can read files and understand your codebase</li>
              <li>✓ Create tickets and tasks directly from chat</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>Supported Editors</h3>
            <div className='space-y-3'>
              <a href='/integrations/cursor' className='block text-sm hover:text-primary transition-colors'>
                → Cursor Setup Guide
              </a>
              <a href='/integrations/claude-desktop' className='block text-sm hover:text-primary transition-colors'>
                → Claude Desktop Setup Guide
              </a>
              <a href='/integrations' className='block text-sm hover:text-primary transition-colors'>
                → View All Integrations
              </a>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Best Practices */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Best Practices for New Users</h2>

        <div className='grid md:grid-cols-2 gap-6'>
          <GlassCard className='p-6'>
            <Lightbulb className='h-5 w-5 text-yellow-500 mb-3' />
            <h3 className='font-medium mb-3'>Start Small</h3>
            <p className='text-sm text-muted-foreground mb-3'>
              Begin with simple tasks to get familiar with the interface:
            </p>
            <ul className='text-sm text-muted-foreground space-y-1'>
              <li>• Add a single function or component</li>
              <li>• Fix a specific bug</li>
              <li>• Refactor a small piece of code</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <Lightbulb className='h-5 w-5 text-yellow-500 mb-3' />
            <h3 className='font-medium mb-3'>Use File Suggestions</h3>
            <p className='text-sm text-muted-foreground mb-3'>Let AI help you find relevant files:</p>
            <ul className='text-sm text-muted-foreground space-y-1'>
              <li>• Saves time searching manually</li>
              <li>• Discovers related files you might miss</li>
              <li>• Uses 60-70% fewer tokens</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <Lightbulb className='h-5 w-5 text-yellow-500 mb-3' />
            <h3 className='font-medium mb-3'>Watch Token Usage</h3>
            <p className='text-sm text-muted-foreground mb-3'>Keep an eye on the token counter:</p>
            <ul className='text-sm text-muted-foreground space-y-1'>
              <li>• Most AI models have token limits</li>
              <li>• Start with 5-10 files max</li>
              <li>• Add more context as needed</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <Lightbulb className='h-5 w-5 text-yellow-500 mb-3' />
            <h3 className='font-medium mb-3'>Save Useful Prompts</h3>
            <p className='text-sm text-muted-foreground mb-3'>Build your prompt library over time:</p>
            <ul className='text-sm text-muted-foreground space-y-1'>
              <li>• Navigate to the Prompts page</li>
              <li>• Save prompts that work well</li>
              <li>• Reuse them across projects</li>
            </ul>
          </GlassCard>
        </div>
      </section>

      {/* Next Steps */}
      <GlassCard className='p-8 bg-primary/5 border-primary/20'>
        <h3 className='text-xl font-semibold mb-3'>What's Next?</h3>
        <p className='mb-4 text-muted-foreground'>
          Great job creating your first project! Here's what to explore next:
        </p>
        <ul className='space-y-2'>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/how-to/building-context' className='text-primary hover:underline'>
              Learn advanced context building strategies
            </a>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/how-to/tickets-tasks' className='text-primary hover:underline'>
              Organize work with tickets and tasks
            </a>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/guides#file-suggestions' className='text-primary hover:underline'>
              Master the file suggestion feature
            </a>
          </li>
        </ul>
      </GlassCard>
    </div>
  )
}
