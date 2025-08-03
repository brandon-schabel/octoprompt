import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui'
import { CodeBlock } from '@/components/docs'
import { FeatureScreenshot } from '@/components/ui'
import { TicketIcon, ListTodo, Sparkles, GitBranch, Target, Clock, CheckCircle } from 'lucide-react'

export const Route = createFileRoute('/docs/how-to/tickets-tasks')({
  loader: () => {
    return {
      meta: {
        title: 'Managing Tickets & Tasks - Promptliano How-To Guide',
        description:
          'Learn how to organize your work with tickets and let AI generate implementation tasks based on your codebase.',
        keywords: ['tickets', 'tasks', 'project management', 'AI planning', 'workflow organization']
      } as SeoMetadata
    }
  },
  component: TicketsTasksGuide
})

function TicketsTasksGuide() {
  return (
    <div className='space-y-8'>
      <div>
        <h1 className='text-4xl font-bold mb-4'>Managing Tickets & Tasks</h1>
        <p className='text-xl text-muted-foreground'>
          Organize your development work with Promptliano's ticket system and let AI help plan implementation tasks.
        </p>
      </div>

      {/* Why Use Tickets */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Why Use the Ticket System?</h2>

        <div className='grid md:grid-cols-3 gap-6'>
          <GlassCard className='p-6'>
            <Target className='h-5 w-5 text-primary mb-3' />
            <h3 className='font-medium mb-2'>Stay Organized</h3>
            <p className='text-sm text-muted-foreground'>
              Break down features into manageable pieces. Track what's done and what's next.
            </p>
          </GlassCard>

          <GlassCard className='p-6'>
            <Sparkles className='h-5 w-5 text-primary mb-3' />
            <h3 className='font-medium mb-2'>AI-Powered Planning</h3>
            <p className='text-sm text-muted-foreground'>
              AI analyzes your codebase to suggest implementation tasks specific to your project.
            </p>
          </GlassCard>

          <GlassCard className='p-6'>
            <GitBranch className='h-5 w-5 text-primary mb-3' />
            <h3 className='font-medium mb-2'>Context Preservation</h3>
            <p className='text-sm text-muted-foreground'>
              Tickets maintain context across sessions. Pick up where you left off anytime.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* Creating Your First Ticket */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold'>
            1
          </span>
          Creating Your First Ticket
        </h2>

        <div className='space-y-6'>
          <div>
            <h3 className='text-xl font-medium mb-3'>Navigate to Tickets</h3>
            <p className='text-muted-foreground mb-3'>
              From your project view, find the tickets section in the navigation or use the quick access buttons.
            </p>
            <FeatureScreenshot
              src='/assets/screenshots/tickets-overview-with-tasks.webp'
              alt='Tickets Overview'
              title='Tickets Management Page'
              description='Your central hub for planning and tracking development work'
              layout='centered'
            />
          </div>

          <div>
            <h3 className='text-xl font-medium mb-3'>Create a New Ticket</h3>
            <p className='text-muted-foreground mb-3'>Click "New Ticket" and fill in the details:</p>

            <div className='space-y-4'>
              <GlassCard className='p-6'>
                <h4 className='font-medium mb-3'>Ticket Fields Explained</h4>

                <div className='space-y-4'>
                  <div>
                    <h5 className='font-medium text-sm mb-1'>Title</h5>
                    <p className='text-sm text-muted-foreground mb-2'>
                      A clear, concise description of what needs to be done.
                    </p>
                    <CodeBlock
                      code='Examples:
• "Add user authentication with JWT"
• "Fix memory leak in dashboard component"
• "Implement dark mode toggle"'
                      language='text'
                    />
                  </div>

                  <div>
                    <h5 className='font-medium text-sm mb-1'>Overview</h5>
                    <p className='text-sm text-muted-foreground mb-2'>
                      Detailed description that provides context for AI task generation.
                    </p>
                    <CodeBlock
                      code='Include:
• What the feature/fix should accomplish
• Any specific requirements or constraints
• Which parts of the codebase it affects
• Expected user experience'
                      language='text'
                    />
                  </div>

                  <div>
                    <h5 className='font-medium text-sm mb-1'>Priority</h5>
                    <div className='grid grid-cols-3 gap-3 mt-2'>
                      <div className='text-center p-2 bg-red-500/10 rounded'>
                        <span className='text-xs font-medium text-red-500'>High</span>
                        <p className='text-xs text-muted-foreground mt-1'>Critical/Blocking</p>
                      </div>
                      <div className='text-center p-2 bg-yellow-500/10 rounded'>
                        <span className='text-xs font-medium text-yellow-500'>Normal</span>
                        <p className='text-xs text-muted-foreground mt-1'>Regular Features</p>
                      </div>
                      <div className='text-center p-2 bg-green-500/10 rounded'>
                        <span className='text-xs font-medium text-green-500'>Low</span>
                        <p className='text-xs text-muted-foreground mt-1'>Nice to Have</p>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      </section>

      {/* AI Task Generation */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold'>
            2
          </span>
          AI-Generated Tasks
        </h2>

        <p className='text-muted-foreground'>
          Once you've created a ticket, let AI analyze your codebase and suggest implementation tasks.
        </p>

        <div className='space-y-6'>
          <div>
            <h3 className='text-xl font-medium mb-3'>Generate Tasks</h3>
            <p className='text-muted-foreground mb-3'>Click the "Generate Tasks" button on your ticket. AI will:</p>

            <div className='grid md:grid-cols-2 gap-4'>
              <GlassCard className='p-4'>
                <h4 className='font-medium mb-2'>Analyze Your Codebase</h4>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  <li>• Understand project structure</li>
                  <li>• Identify existing patterns</li>
                  <li>• Find related components</li>
                  <li>• Consider dependencies</li>
                </ul>
              </GlassCard>

              <GlassCard className='p-4'>
                <h4 className='font-medium mb-2'>Create Actionable Tasks</h4>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  <li>• Specific implementation steps</li>
                  <li>• Suggested file locations</li>
                  <li>• Estimated complexity</li>
                  <li>• Logical order of work</li>
                </ul>
              </GlassCard>
            </div>
          </div>

          <div>
            <h3 className='text-xl font-medium mb-3'>Example: Authentication Feature</h3>
            <p className='text-muted-foreground mb-3'>
              Here's what AI might generate for a "Add user authentication" ticket:
            </p>

            <GlassCard className='p-6 bg-muted/30'>
              <div className='space-y-3'>
                <div className='flex items-start gap-3'>
                  <CheckCircle className='h-4 w-4 text-muted-foreground mt-0.5' />
                  <div className='flex-1'>
                    <p className='text-sm font-medium'>Create authentication schema</p>
                    <p className='text-xs text-muted-foreground'>
                      Define Zod schemas for login/register in schemas/auth.schema.ts
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3'>
                  <CheckCircle className='h-4 w-4 text-muted-foreground mt-0.5' />
                  <div className='flex-1'>
                    <p className='text-sm font-medium'>Set up JWT service</p>
                    <p className='text-xs text-muted-foreground'>
                      Implement token generation/validation in services/auth.service.ts
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3'>
                  <CheckCircle className='h-4 w-4 text-muted-foreground mt-0.5' />
                  <div className='flex-1'>
                    <p className='text-sm font-medium'>Create login component</p>
                    <p className='text-xs text-muted-foreground'>
                      Build form with validation in components/auth/LoginForm.tsx
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3'>
                  <CheckCircle className='h-4 w-4 text-muted-foreground mt-0.5' />
                  <div className='flex-1'>
                    <p className='text-sm font-medium'>Add auth API routes</p>
                    <p className='text-xs text-muted-foreground'>
                      Implement /login and /register endpoints in api/auth.route.ts
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3'>
                  <CheckCircle className='h-4 w-4 text-muted-foreground mt-0.5' />
                  <div className='flex-1'>
                    <p className='text-sm font-medium'>Create auth hook</p>
                    <p className='text-xs text-muted-foreground'>
                      Build useAuth hook for state management in hooks/useAuth.ts
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          <div>
            <h3 className='text-xl font-medium mb-3'>Review and Customize</h3>
            <p className='text-muted-foreground mb-3'>AI suggestions are a starting point. You can:</p>
            <ul className='space-y-2'>
              <li className='flex items-center gap-2'>
                <span className='text-primary'>✓</span>
                <span className='text-sm'>Edit task descriptions for clarity</span>
              </li>
              <li className='flex items-center gap-2'>
                <span className='text-primary'>✓</span>
                <span className='text-sm'>Add or remove tasks as needed</span>
              </li>
              <li className='flex items-center gap-2'>
                <span className='text-primary'>✓</span>
                <span className='text-sm'>Reorder tasks for better workflow</span>
              </li>
              <li className='flex items-center gap-2'>
                <span className='text-primary'>✓</span>
                <span className='text-sm'>Add specific implementation notes</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Working with Tasks */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold'>
            3
          </span>
          Working with Tasks
        </h2>

        <div className='space-y-6'>
          <div>
            <h3 className='text-xl font-medium mb-3'>Task Management Features</h3>

            <div className='grid md:grid-cols-2 gap-4'>
              <GlassCard className='p-4'>
                <ListTodo className='h-5 w-5 text-primary mb-2' />
                <h4 className='font-medium mb-2'>Task States</h4>
                <div className='space-y-2 text-sm'>
                  <div className='flex items-center gap-2'>
                    <div className='w-3 h-3 rounded-full bg-gray-400' />
                    <span className='text-muted-foreground'>Pending - Not started</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div className='w-3 h-3 rounded-full bg-blue-500' />
                    <span className='text-muted-foreground'>In Progress - Currently working</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div className='w-3 h-3 rounded-full bg-green-500' />
                    <span className='text-muted-foreground'>Completed - Done!</span>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className='p-4'>
                <Clock className='h-5 w-5 text-primary mb-2' />
                <h4 className='font-medium mb-2'>Time Tracking</h4>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  <li>• Add time estimates to tasks</li>
                  <li>• Track actual time spent</li>
                  <li>• See progress at a glance</li>
                  <li>• Improve future estimates</li>
                </ul>
              </GlassCard>
            </div>
          </div>

          <div>
            <h3 className='text-xl font-medium mb-3'>Task Context & Files</h3>
            <p className='text-muted-foreground mb-3'>Each task can include:</p>

            <GlassCard className='p-6'>
              <div className='space-y-4'>
                <div>
                  <h4 className='font-medium text-sm mb-2'>Description</h4>
                  <p className='text-sm text-muted-foreground'>Detailed steps or requirements for implementation</p>
                </div>

                <div>
                  <h4 className='font-medium text-sm mb-2'>Suggested Files</h4>
                  <p className='text-sm text-muted-foreground mb-2'>
                    AI can suggest which files are relevant to each task
                  </p>
                  <div className='flex flex-wrap gap-2'>
                    <span className='text-xs px-2 py-1 bg-muted rounded'>components/Header.tsx</span>
                    <span className='text-xs px-2 py-1 bg-muted rounded'>hooks/useAuth.ts</span>
                    <span className='text-xs px-2 py-1 bg-muted rounded'>types/user.types.ts</span>
                  </div>
                </div>

                <div>
                  <h4 className='font-medium text-sm mb-2'>Tags</h4>
                  <p className='text-sm text-muted-foreground mb-2'>Categorize tasks for better organization</p>
                  <div className='flex gap-2'>
                    <span className='text-xs px-2 py-1 bg-blue-500/20 text-blue-500 rounded'>frontend</span>
                    <span className='text-xs px-2 py-1 bg-green-500/20 text-green-500 rounded'>feature</span>
                    <span className='text-xs px-2 py-1 bg-purple-500/20 text-purple-500 rounded'>auth</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Workflow Examples */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Real-World Workflow Examples</h2>

        <div className='space-y-6'>
          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>🚀 Feature Development Flow</h3>
            <ol className='space-y-3 text-sm'>
              <li className='flex gap-3'>
                <span className='flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs'>
                  1
                </span>
                <div>
                  <p className='font-medium'>Create feature ticket</p>
                  <p className='text-muted-foreground'>Describe the feature and requirements</p>
                </div>
              </li>
              <li className='flex gap-3'>
                <span className='flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs'>
                  2
                </span>
                <div>
                  <p className='font-medium'>Generate tasks with AI</p>
                  <p className='text-muted-foreground'>Get implementation steps based on your codebase</p>
                </div>
              </li>
              <li className='flex gap-3'>
                <span className='flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs'>
                  3
                </span>
                <div>
                  <p className='font-medium'>Work through tasks</p>
                  <p className='text-muted-foreground'>Mark as in-progress, use suggested files for context</p>
                </div>
              </li>
              <li className='flex gap-3'>
                <span className='flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs'>
                  4
                </span>
                <div>
                  <p className='font-medium'>Track progress</p>
                  <p className='text-muted-foreground'>Complete tasks, add notes for future reference</p>
                </div>
              </li>
            </ol>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>🐛 Bug Fix Workflow</h3>
            <div className='space-y-3'>
              <div className='p-3 bg-red-500/10 rounded'>
                <p className='text-sm font-medium'>Quick Ticket Creation</p>
                <p className='text-xs text-muted-foreground mt-1'>
                  Title: "Fix login form validation error"
                  <br />
                  Priority: High
                  <br />
                  Overview: Include error message and steps to reproduce
                </p>
              </div>
              <div className='p-3 bg-yellow-500/10 rounded'>
                <p className='text-sm font-medium'>AI Suggests Debug Tasks</p>
                <ul className='text-xs text-muted-foreground mt-1 space-y-1'>
                  <li>• Check validation schema in auth.schema.ts</li>
                  <li>• Review form submission handler</li>
                  <li>• Add error boundary for better error handling</li>
                  <li>• Write test to prevent regression</li>
                </ul>
              </div>
              <div className='p-3 bg-green-500/10 rounded'>
                <p className='text-sm font-medium'>Systematic Resolution</p>
                <p className='text-xs text-muted-foreground mt-1'>
                  Work through tasks, marking each complete as you verify the fix
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Best Practices */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Best Practices</h2>

        <div className='grid md:grid-cols-2 gap-6'>
          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>Writing Good Tickets</h3>
            <ul className='space-y-2 text-sm text-muted-foreground'>
              <li>✓ Be specific about the problem or feature</li>
              <li>✓ Include acceptance criteria</li>
              <li>✓ Add relevant context or screenshots</li>
              <li>✓ Link to related tickets if applicable</li>
              <li>✓ Set realistic priorities</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>Task Management Tips</h3>
            <ul className='space-y-2 text-sm text-muted-foreground'>
              <li>✓ Keep tasks small and focused</li>
              <li>✓ Update status as you work</li>
              <li>✓ Add notes for complex implementations</li>
              <li>✓ Use tags for easy filtering</li>
              <li>✓ Review completed tasks for learnings</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>AI Task Generation</h3>
            <ul className='space-y-2 text-sm text-muted-foreground'>
              <li>✓ Provide detailed ticket overviews</li>
              <li>✓ Review and adjust AI suggestions</li>
              <li>✓ Add missing technical tasks</li>
              <li>✓ Consider testing and documentation</li>
              <li>✓ Break down tasks that are too large</li>
            </ul>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>Workflow Optimization</h3>
            <ul className='space-y-2 text-sm text-muted-foreground'>
              <li>✓ Batch similar tasks together</li>
              <li>✓ Use file suggestions for each task</li>
              <li>✓ Keep tickets focused on one feature</li>
              <li>✓ Close tickets when truly complete</li>
              <li>✓ Regular ticket cleanup/review</li>
            </ul>
          </GlassCard>
        </div>
      </section>

      {/* Integration with MCP */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>MCP Integration</h2>

        <p className='text-muted-foreground'>
          When connected via MCP, you can manage tickets directly from your AI editor:
        </p>

        <GlassCard className='p-6'>
          <h3 className='font-medium mb-3'>Available MCP Commands</h3>
          <CodeBlock
            code={`// List all tickets
mcp__promptliano__ticket_manager(
  action: "list",
  projectId: YOUR_PROJECT_ID
)

// Create a new ticket
mcp__promptliano__ticket_manager(
  action: "create",
  projectId: YOUR_PROJECT_ID,
  data: {
    title: "Add user profile page",
    overview: "Create a page to display user information",
    priority: "normal"
  }
)

// Generate tasks for a ticket
mcp__promptliano__ticket_manager(
  action: "auto_generate_tasks",
  ticketId: TICKET_ID
)

// Update task status
mcp__promptliano__task_manager(
  action: "update",
  ticketId: TICKET_ID,
  data: {
    taskId: TASK_ID,
    done: true
  }
)`}
            language='typescript'
          />
          <p className='text-sm text-muted-foreground mt-3'>
            This allows seamless workflow without leaving your editor!
          </p>
        </GlassCard>
      </section>

      {/* Next Steps */}
      <GlassCard className='p-8 bg-primary/5 border-primary/20'>
        <h3 className='text-xl font-semibold mb-3'>Start Organizing Your Work</h3>
        <p className='mb-4 text-muted-foreground'>
          Great development starts with good organization. Use tickets to plan, track, and complete your projects
          efficiently!
        </p>
        <ul className='space-y-2'>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/api#ticket-manager' className='text-primary hover:underline'>
              Explore the Ticket Manager API
            </a>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/guides#workflow-patterns' className='text-primary hover:underline'>
              Learn advanced workflow patterns
            </a>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/integrations' className='text-primary hover:underline'>
              Set up MCP for editor integration
            </a>
          </li>
        </ul>
      </GlassCard>
    </div>
  )
}
