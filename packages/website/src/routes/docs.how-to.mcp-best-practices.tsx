import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui'
import { CodeBlock } from '@/components/docs'
import { FeatureScreenshot } from '@/components/ui'
import { Brain, Zap, Target, Sparkles, Code2, GitBranch, FileSearch, Layers, Bot, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/docs/how-to/mcp-best-practices')({
  loader: () => {
    return {
      meta: {
        title: 'Getting the Most Out of Promptliano MCP - Best Practices Guide',
        description:
          'Learn how to effectively use Promptliano MCP tools, optimize AI interactions, and build efficient development workflows.',
        keywords: ['MCP', 'best practices', 'AI workflow', 'prompting', 'context building', 'token optimization']
      } as SeoMetadata
    }
  },
  component: McpBestPracticesGuide
})

function McpBestPracticesGuide() {
  return (
    <div className='space-y-12'>
      <div>
        <h1 className='text-4xl font-bold mb-4'>Getting the Most Out of Promptliano MCP</h1>
        <p className='text-xl text-muted-foreground'>
          Master the art of using Promptliano's Model Context Protocol to build efficient AI-powered development
          workflows.
        </p>
      </div>

      {/* Introduction */}
      <section className='space-y-6'>
        <GlassCard className='p-6 border-primary/20'>
          <div className='flex items-start gap-3'>
            <Brain className='h-6 w-6 text-primary mt-0.5' />
            <div>
              <h2 className='text-2xl font-semibold mb-3'>The Human-in-the-Loop Approach</h2>
              <p className='text-muted-foreground mb-4'>
                Promptliano MCP is designed around a "human-in-the-loop" philosophy. Instead of AI making autonomous
                decisions, it gathers context efficiently and presents options for you to guide the development process.
              </p>
              <div className='grid md:grid-cols-3 gap-4 mt-4'>
                <div className='bg-primary/5 rounded-lg p-4'>
                  <Zap className='h-5 w-5 text-primary mb-2' />
                  <h4 className='font-medium text-sm mb-1'>60-70% Token Reduction</h4>
                  <p className='text-xs text-muted-foreground'>Intelligent pre-filtering and caching</p>
                </div>
                <div className='bg-primary/5 rounded-lg p-4'>
                  <Target className='h-5 w-5 text-primary mb-2' />
                  <h4 className='font-medium text-sm mb-1'>Precise Context</h4>
                  <p className='text-xs text-muted-foreground'>AI gets exactly what it needs</p>
                </div>
                <div className='bg-primary/5 rounded-lg p-4'>
                  <Layers className='h-5 w-5 text-primary mb-2' />
                  <h4 className='font-medium text-sm mb-1'>Structured Workflow</h4>
                  <p className='text-xs text-muted-foreground'>Tickets and tasks maintain context</p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Essential First Steps */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold'>
            1
          </span>
          Essential First Steps
        </h2>

        <div className='space-y-6'>
          <div>
            <h3 className='text-xl font-medium mb-3'>Always Start with Project Overview</h3>
            <p className='text-muted-foreground mb-4'>
              The first command in any AI session should be getting the project overview. This provides essential
              context about the current state of your project.
            </p>

            <CodeBlock
              code={`// ALWAYS start your session with this:
mcp__promptliano__project_manager(
  action: "overview",
  projectId: 1754111018844
)`}
              language='typescript'
            />

            <div className='mt-4'>
              <h4 className='font-medium mb-2'>What the Overview Provides:</h4>
              <GlassCard className='p-4 bg-muted/30'>
                <ul className='space-y-2 text-sm'>
                  <li className='flex items-start gap-2'>
                    <span className='text-primary'>•</span>
                    <span>
                      <strong>Project Info:</strong> Name, path, current Git branch
                    </span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <span className='text-primary'>•</span>
                    <span>
                      <strong>Ticket Status:</strong> Open, in-progress, and closed tickets with recent activity
                    </span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <span className='text-primary'>•</span>
                    <span>
                      <strong>Project Structure:</strong> File counts, summarization coverage, total size
                    </span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <span className='text-primary'>•</span>
                    <span>
                      <strong>Active Context:</strong> Currently selected files and token usage
                    </span>
                  </li>
                </ul>
              </GlassCard>
            </div>
          </div>

          <div className='bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4'>
            <div className='flex items-start gap-3'>
              <AlertCircle className='h-5 w-5 text-yellow-500 mt-0.5' />
              <div>
                <h4 className='font-medium mb-1'>Pro Tip: Force AI to Use Overview</h4>
                <p className='text-sm text-muted-foreground'>
                  Include this in your AI system prompt: "Always start by getting the project overview using
                  mcp__promptliano__project_manager with action: overview"
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Creating and Managing Tickets */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold'>
            2
          </span>
          Creating and Managing Tickets
        </h2>

        <div className='space-y-6'>
          <div>
            <h3 className='text-xl font-medium mb-3'>When to Create Tickets</h3>
            <p className='text-muted-foreground mb-4'>
              Use tickets for any feature or task that requires multiple steps or will span multiple coding sessions.
            </p>

            <div className='grid md:grid-cols-2 gap-4'>
              <GlassCard className='p-4'>
                <h4 className='font-medium text-green-500 mb-2'>✓ Good for Tickets</h4>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  <li>• Adding authentication to your app</li>
                  <li>• Implementing a new API endpoint</li>
                  <li>• Refactoring a module</li>
                  <li>• Creating a new UI component set</li>
                </ul>
              </GlassCard>
              <GlassCard className='p-4'>
                <h4 className='font-medium text-red-500 mb-2'>✗ Too Small for Tickets</h4>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  <li>• Fixing a typo</li>
                  <li>• Adding a single console.log</li>
                  <li>• Updating a color value</li>
                  <li>• Renaming a single variable</li>
                </ul>
              </GlassCard>
            </div>
          </div>

          <div>
            <h3 className='text-xl font-medium mb-3'>Creating Effective Tickets</h3>
            <p className='text-muted-foreground mb-4'>
              The key to good AI-generated tasks is providing a detailed overview when creating the ticket.
            </p>

            <CodeBlock
              code={`// Step 1: Create ticket with detailed overview
mcp__promptliano__ticket_manager(
  action: "create",
  projectId: 1754111018844,
  data: {
    title: "Implement user authentication",
    overview: "Add complete authentication system with JWT tokens, login/logout, password reset, and session management. Should integrate with existing user model and use bcrypt for password hashing.",
    priority: "high",
    status: "open"
  }
)

// Step 2: Auto-generate tasks based on your codebase
mcp__promptliano__ticket_manager(
  action: "auto_generate_tasks",
  ticketId: 456  // ID from the create response
)`}
              language='typescript'
              showLineNumbers
            />

            <div className='mt-4'>
              <h4 className='font-medium mb-2'>AI Task Generation Features:</h4>
              <div className='grid md:grid-cols-2 gap-4'>
                <GlassCard className='p-4 bg-primary/5'>
                  <Sparkles className='h-5 w-5 text-primary mb-2' />
                  <h5 className='font-medium text-sm mb-1'>Codebase Awareness</h5>
                  <p className='text-xs text-muted-foreground'>
                    AI analyzes your existing patterns, frameworks, and conventions
                  </p>
                </GlassCard>
                <GlassCard className='p-4 bg-primary/5'>
                  <FileSearch className='h-5 w-5 text-primary mb-2' />
                  <h5 className='font-medium text-sm mb-1'>File Suggestions</h5>
                  <p className='text-xs text-muted-foreground'>
                    Each task includes suggested file locations based on your structure
                  </p>
                </GlassCard>
                <GlassCard className='p-4 bg-primary/5'>
                  <Target className='h-5 w-5 text-primary mb-2' />
                  <h5 className='font-medium text-sm mb-1'>Logical Ordering</h5>
                  <p className='text-xs text-muted-foreground'>
                    Tasks are ordered by dependencies and implementation flow
                  </p>
                </GlassCard>
                <GlassCard className='p-4 bg-primary/5'>
                  <Code2 className='h-5 w-5 text-primary mb-2' />
                  <h5 className='font-medium text-sm mb-1'>Tech Stack Specific</h5>
                  <p className='text-xs text-muted-foreground'>
                    Suggestions match your project's languages and frameworks
                  </p>
                </GlassCard>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* File Discovery and Context */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold'>
            3
          </span>
          File Discovery and Context Building
        </h2>

        <div className='space-y-6'>
          <div>
            <h3 className='text-xl font-medium mb-3'>Three Levels of File Suggestions</h3>
            <p className='text-muted-foreground mb-4'>
              Promptliano offers file suggestions at different granularity levels, each optimized for specific use
              cases.
            </p>

            <div className='space-y-4'>
              <GlassCard className='p-6'>
                <h4 className='font-medium mb-3'>1. Project-Level Suggestions</h4>
                <p className='text-sm text-muted-foreground mb-3'>
                  Use for general exploration and understanding codebase structure.
                </p>
                <CodeBlock
                  code={`mcp__promptliano__project_manager(
  action: "suggest_files",
  projectId: 1754111018844,
  data: {
    prompt: "authentication and user management",
    limit: 15
  }
)`}
                  language='typescript'
                />
              </GlassCard>

              <GlassCard className='p-6'>
                <h4 className='font-medium mb-3'>2. Ticket-Level Suggestions (Optimized)</h4>
                <p className='text-sm text-muted-foreground mb-3'>
                  Best for finding all files related to a feature. Supports three strategies:
                </p>

                <div className='grid md:grid-cols-3 gap-3 mb-4'>
                  <div className='bg-green-500/10 border border-green-500/20 rounded-lg p-3'>
                    <h5 className='font-medium text-sm mb-1'>Fast Strategy</h5>
                    <p className='text-xs text-muted-foreground'>
                      No AI, pure relevance scoring. Best for large projects.
                    </p>
                  </div>
                  <div className='bg-blue-500/10 border border-blue-500/20 rounded-lg p-3'>
                    <h5 className='font-medium text-sm mb-1'>Balanced Strategy</h5>
                    <p className='text-xs text-muted-foreground'>Pre-filters 50 files, AI refines. Default choice.</p>
                  </div>
                  <div className='bg-purple-500/10 border border-purple-500/20 rounded-lg p-3'>
                    <h5 className='font-medium text-sm mb-1'>Thorough Strategy</h5>
                    <p className='text-xs text-muted-foreground'>
                      Pre-filters 100 files, high-quality AI. Complex tickets.
                    </p>
                  </div>
                </div>

                <CodeBlock
                  code={`// Fast - for quick results or large codebases
mcp__promptliano__ticket_manager(
  action: "suggest_files",
  ticketId: 456,
  data: {
    strategy: "fast",
    maxResults: 20
  }
)

// Balanced - default for most use cases
mcp__promptliano__ticket_manager(
  action: "suggest_files",
  ticketId: 456,
  data: {
    strategy: "balanced",
    maxResults: 15,
    extraUserInput: "include database models and API routes"
  }
)

// Thorough - for complex features needing comprehensive coverage
mcp__promptliano__ticket_manager(
  action: "suggest_files",
  ticketId: 456,
  data: {
    strategy: "thorough",
    maxResults: 25,
    extraUserInput: "find all authentication-related files including tests"
  }
)`}
                  language='typescript'
                  showLineNumbers
                />
              </GlassCard>

              <GlassCard className='p-6'>
                <h4 className='font-medium mb-3'>3. Task-Level Suggestions</h4>
                <p className='text-sm text-muted-foreground mb-3'>
                  Most focused - finds files for implementing a specific task.
                </p>
                <CodeBlock
                  code={`mcp__promptliano__task_manager(
  action: "suggest_files",
  ticketId: 456,
  data: {
    taskId: 789,
    context: "need to modify the login form component"
  }
)`}
                  language='typescript'
                />
              </GlassCard>
            </div>
          </div>

          <div className='bg-green-500/10 border border-green-500/20 rounded-lg p-4'>
            <div className='flex items-start gap-3'>
              <Zap className='h-5 w-5 text-green-500 mt-0.5' />
              <div>
                <h4 className='font-medium mb-1'>Token Savings Metrics</h4>
                <p className='text-sm text-muted-foreground'>
                  File suggestions typically save 60-70% of tokens compared to sending full file contents. Each response
                  includes metrics showing tokens used vs. saved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Available MCP Tools */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold'>
            4
          </span>
          Complete MCP Tools Reference
        </h2>

        <p className='text-muted-foreground'>
          Here's a comprehensive overview of all available MCP tools and when to use them:
        </p>

        <div className='space-y-4'>
          {/* Project Manager */}
          <GlassCard className='p-6'>
            <div className='flex items-start gap-3'>
              <Layers className='h-5 w-5 text-primary mt-0.5' />
              <div className='flex-1'>
                <h3 className='text-lg font-medium mb-2'>project_manager</h3>
                <p className='text-sm text-muted-foreground mb-3'>Core project operations and file management.</p>
                <div className='space-y-2'>
                  <details className='group'>
                    <summary className='cursor-pointer text-sm font-medium hover:text-primary'>
                      View all actions →
                    </summary>
                    <div className='mt-2 pl-4 space-y-1 text-sm text-muted-foreground'>
                      <div>
                        <code>overview</code> - Get essential project context (recommended first tool)
                      </div>
                      <div>
                        <code>list</code> - List all projects
                      </div>
                      <div>
                        <code>get</code> - Get project details
                      </div>
                      <div>
                        <code>create</code> - Create new project
                      </div>
                      <div>
                        <code>update</code> - Update project metadata
                      </div>
                      <div>
                        <code>delete</code> - Delete entire project (requires confirmDelete: true)
                      </div>
                      <div>
                        <code>suggest_files</code> - Get intelligent file suggestions
                      </div>
                      <div>
                        <code>search</code> - Search within project
                      </div>
                      <div>
                        <code>get_file_tree</code> - Get project structure with file IDs
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Ticket Manager */}
          <GlassCard className='p-6'>
            <div className='flex items-start gap-3'>
              <Target className='h-5 w-5 text-primary mt-0.5' />
              <div className='flex-1'>
                <h3 className='text-lg font-medium mb-2'>ticket_manager</h3>
                <p className='text-sm text-muted-foreground mb-3'>Feature planning with AI-powered task generation.</p>
                <div className='space-y-2'>
                  <details className='group'>
                    <summary className='cursor-pointer text-sm font-medium hover:text-primary'>
                      View all actions →
                    </summary>
                    <div className='mt-2 pl-4 space-y-1 text-sm text-muted-foreground'>
                      <div>
                        <code>create</code> - Create new ticket
                      </div>
                      <div>
                        <code>auto_generate_tasks</code> - AI generates implementation tasks
                      </div>
                      <div>
                        <code>suggest_files</code> - Find files for ticket (with strategies)
                      </div>
                      <div>
                        <code>list_with_task_count</code> - List tickets with task counts
                      </div>
                      <div>
                        <code>batch_create</code> - Create multiple tickets
                      </div>
                      <div>
                        <code>search</code> - Search tickets by text
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Task Manager */}
          <GlassCard className='p-6'>
            <div className='flex items-start gap-3'>
              <Code2 className='h-5 w-5 text-primary mt-0.5' />
              <div className='flex-1'>
                <h3 className='text-lg font-medium mb-2'>task_manager</h3>
                <p className='text-sm text-muted-foreground mb-3'>Fine-grained task management within tickets.</p>
                <div className='space-y-2'>
                  <details className='group'>
                    <summary className='cursor-pointer text-sm font-medium hover:text-primary'>
                      View all actions →
                    </summary>
                    <div className='mt-2 pl-4 space-y-1 text-sm text-muted-foreground'>
                      <div>
                        <code>create</code> - Create single task
                      </div>
                      <div>
                        <code>batch_create</code> - Create multiple tasks
                      </div>
                      <div>
                        <code>suggest_files</code> - Find files for specific task
                      </div>
                      <div>
                        <code>get_with_context</code> - Get task with full context
                      </div>
                      <div>
                        <code>analyze_complexity</code> - Estimate task complexity
                      </div>
                      <div>
                        <code>reorder</code> - Change task order
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Prompt Manager */}
          <GlassCard className='p-6'>
            <div className='flex items-start gap-3'>
              <Brain className='h-5 w-5 text-primary mt-0.5' />
              <div className='flex-1'>
                <h3 className='text-lg font-medium mb-2'>prompt_manager</h3>
                <p className='text-sm text-muted-foreground mb-3'>
                  Save and reuse prompts, documentation, and knowledge.
                </p>
                <div className='space-y-2'>
                  <details className='group'>
                    <summary className='cursor-pointer text-sm font-medium hover:text-primary'>
                      View all actions →
                    </summary>
                    <div className='mt-2 pl-4 space-y-1 text-sm text-muted-foreground'>
                      <div>
                        <code>create</code> - Save new prompt/documentation
                      </div>
                      <div>
                        <code>list_by_project</code> - Get project prompts
                      </div>
                      <div>
                        <code>suggest_prompts</code> - AI suggests relevant prompts
                      </div>
                      <div>
                        <code>add_to_project</code> - Associate prompt with project
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Git Manager */}
          <GlassCard className='p-6'>
            <div className='flex items-start gap-3'>
              <GitBranch className='h-5 w-5 text-primary mt-0.5' />
              <div className='flex-1'>
                <h3 className='text-lg font-medium mb-2'>git_manager</h3>
                <p className='text-sm text-muted-foreground mb-3'>Comprehensive Git operations including worktrees.</p>
                <div className='space-y-2'>
                  <details className='group'>
                    <summary className='cursor-pointer text-sm font-medium hover:text-primary'>
                      View all actions →
                    </summary>
                    <div className='mt-2 pl-4 space-y-1 text-sm text-muted-foreground'>
                      <div>
                        <code>status</code> - Get current status
                      </div>
                      <div>
                        <code>worktree_add</code> - Create new worktree
                      </div>
                      <div>
                        <code>worktree_list</code> - List all worktrees
                      </div>
                      <div>
                        <code>branch_create</code> - Create new branch
                      </div>
                      <div>
                        <code>stash</code> - Stash changes
                      </div>
                      <div>
                        <code>log_enhanced</code> - Get detailed commit history
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Agent Manager */}
          <GlassCard className='p-6'>
            <div className='flex items-start gap-3'>
              <Bot className='h-5 w-5 text-primary mt-0.5' />
              <div className='flex-1'>
                <h3 className='text-lg font-medium mb-2'>agent_manager</h3>
                <p className='text-sm text-muted-foreground mb-3'>
                  Manage AI agent configurations from .claude/agents directory.
                </p>
                <div className='space-y-2'>
                  <details className='group'>
                    <summary className='cursor-pointer text-sm font-medium hover:text-primary'>
                      View all actions →
                    </summary>
                    <div className='mt-2 pl-4 space-y-1 text-sm text-muted-foreground'>
                      <div>
                        <code>list</code> - List available agents
                      </div>
                      <div>
                        <code>get</code> - Get agent configuration
                      </div>
                      <div>
                        <code>suggest_agents</code> - AI suggests relevant agents
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Prompting Best Practices */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold'>
            5
          </span>
          Prompting AI to Use Promptliano
        </h2>

        <div className='space-y-6'>
          <div>
            <h3 className='text-xl font-medium mb-3'>System Prompt Additions</h3>
            <p className='text-muted-foreground mb-4'>
              Add these to your AI assistant's system prompt to ensure it uses Promptliano effectively:
            </p>

            <CodeBlock
              code={`# Promptliano MCP Usage Instructions

1. ALWAYS start each session by getting the project overview:
   mcp__promptliano__project_manager(action: "overview", projectId: <PROJECT_ID>)

2. Before searching for files manually, ALWAYS use file suggestions:
   - For general exploration: use project_manager with action: "suggest_files"
   - For ticket work: use ticket_manager with action: "suggest_files" and appropriate strategy
   - For specific tasks: use task_manager with action: "suggest_files"

3. When starting a new feature:
   - Create a ticket with detailed overview
   - Use auto_generate_tasks to get AI-powered task breakdown
   - Review and customize the generated tasks

4. Check prompt_manager for existing documentation before searching the web:
   mcp__promptliano__prompt_manager(action: "list_by_project", projectId: <PROJECT_ID>)

5. Use git_manager for version control operations instead of direct git commands when possible.`}
              language='markdown'
              showLineNumbers
            />
          </div>

          <div>
            <h3 className='text-xl font-medium mb-3'>Trigger Phrases</h3>
            <p className='text-muted-foreground mb-4'>These phrases help trigger Promptliano tool usage:</p>

            <div className='grid md:grid-cols-2 gap-4'>
              <GlassCard className='p-4'>
                <h4 className='font-medium text-sm mb-2'>Project Context</h4>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  <li>• "What's the current state of this project?"</li>
                  <li>• "Show me the project overview"</li>
                  <li>• "What tickets are open?"</li>
                  <li>• "What am I working on?"</li>
                </ul>
              </GlassCard>

              <GlassCard className='p-4'>
                <h4 className='font-medium text-sm mb-2'>File Discovery</h4>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  <li>• "Find files related to [feature]"</li>
                  <li>• "What files should I modify for this ticket?"</li>
                  <li>• "Suggest files for authentication"</li>
                  <li>• "Where is the [component] implemented?"</li>
                </ul>
              </GlassCard>

              <GlassCard className='p-4'>
                <h4 className='font-medium text-sm mb-2'>Planning</h4>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  <li>• "Create a ticket for [feature]"</li>
                  <li>• "Plan out the implementation"</li>
                  <li>• "Generate tasks for this feature"</li>
                  <li>• "Break this down into steps"</li>
                </ul>
              </GlassCard>

              <GlassCard className='p-4'>
                <h4 className='font-medium text-sm mb-2'>Knowledge</h4>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  <li>• "Check if we have docs for [library]"</li>
                  <li>• "What prompts do we have saved?"</li>
                  <li>• "Save this as a prompt"</li>
                  <li>• "Find relevant documentation"</li>
                </ul>
              </GlassCard>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Workflows */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold'>
            6
          </span>
          Advanced Workflows
        </h2>

        <div className='space-y-6'>
          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>Parallel Development with Worktrees</h3>
            <p className='text-sm text-muted-foreground mb-4'>
              Work on multiple features simultaneously without switching branches:
            </p>
            <CodeBlock
              code={`// Create a worktree for a new feature
mcp__promptliano__git_manager(
  action: "worktree_add",
  projectId: 1754111018844,
  data: {
    path: "../feature-auth",
    newBranch: "feature/authentication"
  }
)

// List all worktrees
mcp__promptliano__git_manager(
  action: "worktree_list",
  projectId: 1754111018844
)`}
              language='typescript'
            />
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>Batch Operations for Efficiency</h3>
            <p className='text-sm text-muted-foreground mb-4'>
              Create multiple related tickets or tasks in one operation:
            </p>
            <CodeBlock
              code={`// Create multiple tickets for a large feature
mcp__promptliano__ticket_manager(
  action: "batch_create",
  projectId: 1754111018844,
  data: {
    tickets: [
      {
        title: "Frontend: User Dashboard",
        overview: "Create responsive dashboard with user stats",
        priority: "high"
      },
      {
        title: "Backend: Dashboard API",
        overview: "Create API endpoints for dashboard data",
        priority: "high"
      },
      {
        title: "Database: Dashboard Analytics",
        overview: "Add tables for tracking user analytics",
        priority: "medium"
      }
    ]
  }
)`}
              language='typescript'
            />
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-lg font-medium mb-3'>Combining Tools for Complex Tasks</h3>
            <p className='text-sm text-muted-foreground mb-4'>Example workflow for implementing a complete feature:</p>
            <CodeBlock
              code={`// 1. Get project context
mcp__promptliano__project_manager(action: "overview", projectId: 1754111018844)

// 2. Create feature ticket
mcp__promptliano__ticket_manager(
  action: "create",
  projectId: 1754111018844,
  data: {
    title: "Add real-time notifications",
    overview: "Implement WebSocket-based notifications with UI indicators"
  }
)

// 3. Generate implementation tasks
mcp__promptliano__ticket_manager(action: "auto_generate_tasks", ticketId: 789)

// 4. Find relevant files for the feature
mcp__promptliano__ticket_manager(
  action: "suggest_files",
  ticketId: 789,
  data: { strategy: "thorough", extraUserInput: "websocket and notification components" }
)

// 5. Check for existing documentation
mcp__promptliano__prompt_manager(
  action: "suggest_prompts",
  projectId: 1754111018844,
  data: { query: "websocket implementation patterns" }
)`}
              language='typescript'
              showLineNumbers
            />
          </GlassCard>
        </div>
      </section>

      {/* Summary */}
      <section className='space-y-6'>
        <GlassCard className='p-8 border-primary/30 bg-primary/5'>
          <h2 className='text-2xl font-semibold mb-4'>Key Takeaways</h2>

          <div className='grid md:grid-cols-2 gap-6'>
            <div>
              <h3 className='font-medium mb-3'>Essential Practices</h3>
              <ul className='space-y-2 text-sm'>
                <li className='flex items-start gap-2'>
                  <span className='text-primary'>1.</span>
                  <span>Always start with project overview</span>
                </li>
                <li className='flex items-start gap-2'>
                  <span className='text-primary'>2.</span>
                  <span>Use tickets for multi-step features</span>
                </li>
                <li className='flex items-start gap-2'>
                  <span className='text-primary'>3.</span>
                  <span>Let AI generate tasks from detailed overviews</span>
                </li>
                <li className='flex items-start gap-2'>
                  <span className='text-primary'>4.</span>
                  <span>Use file suggestions instead of manual search</span>
                </li>
                <li className='flex items-start gap-2'>
                  <span className='text-primary'>5.</span>
                  <span>Check saved prompts before web searches</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className='font-medium mb-3'>Efficiency Tips</h3>
              <ul className='space-y-2 text-sm'>
                <li className='flex items-start gap-2'>
                  <Zap className='h-4 w-4 text-primary mt-0.5' />
                  <span>File suggestions save 60-70% tokens</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Target className='h-4 w-4 text-primary mt-0.5' />
                  <span>Choose strategy based on project size</span>
                </li>
                <li className='flex items-start gap-2'>
                  <GitBranch className='h-4 w-4 text-primary mt-0.5' />
                  <span>Use worktrees for parallel development</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Layers className='h-4 w-4 text-primary mt-0.5' />
                  <span>Batch operations reduce round trips</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Brain className='h-4 w-4 text-primary mt-0.5' />
                  <span>Configure AI system prompts properly</span>
                </li>
              </ul>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Next Steps */}
      <div className='mt-12 p-8 bg-primary/5 border border-primary/20 rounded-lg'>
        <h2 className='text-2xl font-semibold mb-4'>Ready to Get Started?</h2>
        <p className='text-muted-foreground mb-6'>
          Now that you understand how to use Promptliano MCP effectively, explore these resources:
        </p>
        <div className='flex flex-wrap gap-4'>
          <a href='/docs/api' className='btn btn-primary'>
            API Reference
          </a>
          <a href='/docs/how-to/tickets-tasks' className='btn btn-outline'>
            Tickets & Tasks Guide
          </a>
          <a href='/integrations' className='btn btn-outline'>
            Integration Setup
          </a>
        </div>
      </div>
    </div>
  )
}
