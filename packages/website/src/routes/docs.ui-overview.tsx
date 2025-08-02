import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui/glass-card'
import { FeatureScreenshot } from '@/components/ui'
import {
  Home,
  FolderOpen,
  FileText,
  GitBranch,
  MessageSquare,
  TicketIcon,
  Settings,
  Key,
  Users,
  Search,
  Copy,
  Plus
} from 'lucide-react'

export const Route = createFileRoute('/docs/ui-overview')({
  loader: () => {
    return {
      meta: {
        title: 'UI Overview - Promptliano Documentation',
        description:
          "Visual tour of Promptliano's interface. Learn where to find every feature with annotated screenshots.",
        keywords: ['ui overview', 'interface', 'navigation', 'features', 'screenshots', 'visual guide']
      } as SeoMetadata
    }
  },
  component: UIOverviewPage
})

function UIOverviewPage() {
  return (
    <div className='space-y-8'>
      <div>
        <h1 className='text-4xl font-bold mb-4'>UI Overview</h1>
        <p className='text-xl text-muted-foreground'>
          Take a visual tour of Promptliano's interface. This guide shows you exactly where to find every feature.
        </p>
      </div>

      {/* Main Navigation */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Main Navigation Bar</h2>
        <p className='text-muted-foreground'>
          The top navigation bar is your primary way to move between different sections of Promptliano.
        </p>

        <div className='grid md:grid-cols-2 gap-4'>
          <GlassCard className='p-4'>
            <div className='flex items-center gap-3 mb-3'>
              <Home className='h-5 w-5 text-primary' />
              <h3 className='font-medium'>Projects</h3>
            </div>
            <p className='text-sm text-muted-foreground'>
              Your main workspace. Browse files, build context, and manage your codebase.
            </p>
          </GlassCard>

          <GlassCard className='p-4'>
            <div className='flex items-center gap-3 mb-3'>
              <MessageSquare className='h-5 w-5 text-primary' />
              <h3 className='font-medium'>Chat</h3>
            </div>
            <p className='text-sm text-muted-foreground'>Interactive AI chat with project context awareness.</p>
          </GlassCard>

          <GlassCard className='p-4'>
            <div className='flex items-center gap-3 mb-3'>
              <FileText className='h-5 w-5 text-primary' />
              <h3 className='font-medium'>Prompts</h3>
            </div>
            <p className='text-sm text-muted-foreground'>Your library of reusable prompts and templates.</p>
          </GlassCard>

          <GlassCard className='p-4'>
            <div className='flex items-center gap-3 mb-3'>
              <Key className='h-5 w-5 text-primary' />
              <h3 className='font-medium'>Keys</h3>
            </div>
            <p className='text-sm text-muted-foreground'>Manage API keys for different AI providers.</p>
          </GlassCard>
        </div>
      </section>

      {/* Project Overview */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Project Overview Screen</h2>
        <p className='text-muted-foreground'>
          The heart of Promptliano - where you build context and work with your codebase.
        </p>

        <FeatureScreenshot
          src='/assets/screenshots/project-context-overview.webp'
          alt='Project Overview'
          title='Main Project Interface'
          description='Your complete workspace for building AI context'
          layout='centered'
        />

        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>1. Project Selector & Tabs</h3>
            <p className='text-sm text-muted-foreground mb-3'>
              Switch between projects or open multiple tabs to work on different features simultaneously.
            </p>
            <ul className='text-sm space-y-1 text-muted-foreground'>
              <li>• Click project name to switch</li>
              <li>• Use + button for new tabs</li>
              <li>• Tabs persist across sessions</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>2. File Browser (Left)</h3>
            <p className='text-sm text-muted-foreground mb-3'>Navigate your codebase and select files for context.</p>
            <ul className='text-sm space-y-1 text-muted-foreground'>
              <li>• Click files to add to context</li>
              <li>• Search with Ctrl/Cmd + K</li>
              <li>• Folder actions on hover</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>3. Selected Files (Right)</h3>
            <p className='text-sm text-muted-foreground mb-3'>View and manage your context selections.</p>
            <ul className='text-sm space-y-1 text-muted-foreground'>
              <li>• See token counts per file</li>
              <li>• Remove files with X button</li>
              <li>• Total tokens at bottom</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>4. User Input Area</h3>
            <p className='text-sm text-muted-foreground mb-3'>Add instructions or context for your AI interactions.</p>
            <ul className='text-sm space-y-1 text-muted-foreground'>
              <li>• Describe your task</li>
              <li>• Tokens counted in real-time</li>
              <li>• Persists between sessions</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>5. Action Buttons</h3>
            <p className='text-sm text-muted-foreground mb-3'>Quick actions for common tasks.</p>
            <ul className='text-sm space-y-1 text-muted-foreground'>
              <li>• Copy All - Copy complete context</li>
              <li>• Suggest Files - AI recommendations</li>
              <li>• Summary - Project overview</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>6. Token Counter</h3>
            <p className='text-sm text-muted-foreground mb-3'>Real-time tracking of context size.</p>
            <ul className='text-sm space-y-1 text-muted-foreground'>
              <li>• Updates as you select files</li>
              <li>• Includes all context sources</li>
              <li>• Helps manage AI limits</li>
            </ul>
          </GlassCard>
        </div>
      </section>

      {/* File Actions */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Working with Files</h2>

        <div className='space-y-6'>
          <div>
            <h3 className='text-xl font-medium mb-3'>File Selection & Context Building</h3>
            <FeatureScreenshot
              src='/assets/screenshots/project-context-selected-files.webp'
              alt='Selected Files'
              title='Building Your Context'
              description='Selected files appear in the right panel with individual token counts'
              layout='centered'
            />
          </div>

          <div>
            <h3 className='text-xl font-medium mb-3'>AI-Powered File Suggestions</h3>
            <FeatureScreenshot
              src='/assets/screenshots/recommended-files-dialog.webp'
              alt='File Suggestions'
              title='Smart File Discovery'
              description='Let AI suggest relevant files based on your task description'
              layout='centered'
            />
            <p className='text-sm text-muted-foreground mt-2'>
              Access via the "Suggest Files" button or keyboard shortcut Cmd/Ctrl + Shift + S
            </p>
          </div>
        </div>
      </section>

      {/* Ticket Management */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Ticket & Task Management</h2>

        <FeatureScreenshot
          src='/assets/screenshots/tickets-overview-with-tasks.webp'
          alt='Tickets Overview'
          title='Planning Your Work'
          description='Create tickets and let AI generate implementation tasks'
          layout='centered'
        />

        <div className='grid md:grid-cols-2 gap-6'>
          <GlassCard className='p-6'>
            <div className='flex items-center gap-3 mb-3'>
              <TicketIcon className='h-5 w-5 text-primary' />
              <h3 className='font-medium'>Creating Tickets</h3>
            </div>
            <p className='text-sm text-muted-foreground mb-3'>
              Click "New Ticket" button in the top right of the tickets page.
            </p>
            <ul className='text-sm space-y-1 text-muted-foreground'>
              <li>• Add title and overview</li>
              <li>• Set priority level</li>
              <li>• AI generates tasks automatically</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <div className='flex items-center gap-3 mb-3'>
              <Plus className='h-5 w-5 text-primary' />
              <h3 className='font-medium'>Task Generation</h3>
            </div>
            <p className='text-sm text-muted-foreground mb-3'>
              Click "Generate Tasks" on any ticket to let AI plan implementation.
            </p>
            <ul className='text-sm space-y-1 text-muted-foreground'>
              <li>• Uses full project context</li>
              <li>• Creates actionable steps</li>
              <li>• Suggests relevant files</li>
            </ul>
          </GlassCard>
        </div>
      </section>

      {/* Prompt Library */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Prompt Library</h2>

        <FeatureScreenshot
          src='/assets/screenshots/prompt-management-library.webp'
          alt='Prompt Library'
          title='Your Prompt Collection'
          description='Save and organize reusable prompts for consistent AI interactions'
          layout='centered'
        />

        <div className='grid md:grid-cols-3 gap-4'>
          <GlassCard className='p-4'>
            <h4 className='font-medium mb-2'>Create Prompts</h4>
            <p className='text-sm text-muted-foreground'>Click "New Prompt" button to save a new template.</p>
          </GlassCard>

          <GlassCard className='p-4'>
            <h4 className='font-medium mb-2'>Import to Project</h4>
            <p className='text-sm text-muted-foreground'>Use "Import" button to add prompts to current project.</p>
          </GlassCard>

          <GlassCard className='p-4'>
            <h4 className='font-medium mb-2'>Quick Copy</h4>
            <p className='text-sm text-muted-foreground'>Click any prompt to copy it instantly to clipboard.</p>
          </GlassCard>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Keyboard Shortcuts</h2>

        <GlassCard className='p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <Search className='h-5 w-5 text-primary' />
            <h3 className='text-lg font-medium'>Essential Shortcuts</h3>
          </div>

          <div className='grid md:grid-cols-2 gap-6'>
            <div>
              <h4 className='font-medium mb-3'>Navigation</h4>
              <ul className='space-y-2 text-sm'>
                <li className='flex justify-between'>
                  <span className='text-muted-foreground'>Search files</span>
                  <code className='px-2 py-1 bg-muted rounded text-xs'>Cmd/Ctrl + K</code>
                </li>
                <li className='flex justify-between'>
                  <span className='text-muted-foreground'>Quick project switch</span>
                  <code className='px-2 py-1 bg-muted rounded text-xs'>Cmd/Ctrl + P</code>
                </li>
                <li className='flex justify-between'>
                  <span className='text-muted-foreground'>Show shortcuts</span>
                  <code className='px-2 py-1 bg-muted rounded text-xs'>?</code>
                </li>
              </ul>
            </div>

            <div>
              <h4 className='font-medium mb-3'>Actions</h4>
              <ul className='space-y-2 text-sm'>
                <li className='flex justify-between'>
                  <span className='text-muted-foreground'>Copy all context</span>
                  <code className='px-2 py-1 bg-muted rounded text-xs'>Cmd/Ctrl + Shift + C</code>
                </li>
                <li className='flex justify-between'>
                  <span className='text-muted-foreground'>Suggest files</span>
                  <code className='px-2 py-1 bg-muted rounded text-xs'>Cmd/Ctrl + Shift + S</code>
                </li>
                <li className='flex justify-between'>
                  <span className='text-muted-foreground'>Undo/Redo selection</span>
                  <code className='px-2 py-1 bg-muted rounded text-xs'>Cmd/Ctrl + Z/Shift+Z</code>
                </li>
              </ul>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Settings & Configuration */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Settings & Configuration</h2>

        <FeatureScreenshot
          src='/assets/screenshots/settings-dialog.webp'
          alt='Settings Dialog'
          title='Customizing Promptliano'
          description='Access settings via the gear icon in the top navigation'
          layout='centered'
        />

        <div className='grid md:grid-cols-2 gap-6'>
          <GlassCard className='p-6'>
            <Settings className='h-5 w-5 text-primary mb-3' />
            <h3 className='font-medium mb-2'>Project Settings</h3>
            <p className='text-sm text-muted-foreground'>
              Configure file exclusions, AI settings, and project-specific options.
            </p>
          </GlassCard>

          <GlassCard className='p-6'>
            <Key className='h-5 w-5 text-primary mb-3' />
            <h3 className='font-medium mb-2'>API Keys</h3>
            <p className='text-sm text-muted-foreground'>
              Manage provider keys and set spending limits via the Keys page.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* Next Steps */}
      <GlassCard className='p-8 bg-primary/5 border-primary/20'>
        <h3 className='text-xl font-semibold mb-3'>Ready to Start Building?</h3>
        <p className='mb-4 text-muted-foreground'>Now that you know your way around, dive into the how-to guides:</p>
        <ul className='space-y-2'>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/how-to/first-project' className='text-primary hover:underline'>
              Create your first project
            </a>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/how-to/building-context' className='text-primary hover:underline'>
              Learn context building strategies
            </a>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/integrations' className='text-primary hover:underline'>
              Connect your AI editor
            </a>
          </li>
        </ul>
      </GlassCard>
    </div>
  )
}
