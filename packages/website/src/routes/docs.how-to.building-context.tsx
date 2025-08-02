import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui/glass-card'
import { CodeBlock } from '@/components/docs'
import { FeatureScreenshot } from '@/components/ui'
import { Zap, Target, Brain, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'

export const Route = createFileRoute('/docs/how-to/building-context')({
  loader: () => {
    return {
      meta: {
        title: 'Building Context for AI - Promptliano How-To Guide',
        description:
          'Master the art of building effective context for AI interactions. Learn strategies to maximize quality while minimizing tokens.',
        keywords: ['context building', 'AI context', 'file selection', 'token optimization', 'best practices']
      } as SeoMetadata
    }
  },
  component: BuildingContextGuide
})

function BuildingContextGuide() {
  return (
    <div className='space-y-8'>
      <div>
        <h1 className='text-4xl font-bold mb-4'>Building Context for AI</h1>
        <p className='text-xl text-muted-foreground'>
          Learn how to build effective context that helps AI understand your codebase while managing token usage
          efficiently.
        </p>
      </div>

      {/* Why Context Matters */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Why Context Matters</h2>

        <div className='grid md:grid-cols-2 gap-6'>
          <GlassCard className='p-6'>
            <Brain className='h-5 w-5 text-primary mb-3' />
            <h3 className='font-medium mb-2'>AI Understanding</h3>
            <p className='text-sm text-muted-foreground'>
              The right context helps AI understand your code structure, patterns, and dependencies, leading to better
              suggestions.
            </p>
          </GlassCard>

          <GlassCard className='p-6'>
            <TrendingUp className='h-5 w-5 text-primary mb-3' />
            <h3 className='font-medium mb-2'>Quality vs Quantity</h3>
            <p className='text-sm text-muted-foreground'>
              More context isn't always better. Quality drops with too much irrelevant code. Focus on what's essential.
            </p>
          </GlassCard>
        </div>

        <div className='bg-blue-500/10 border border-blue-500/20 rounded-lg p-6'>
          <h3 className='font-medium mb-3'>The Context Sweet Spot</h3>
          <p className='text-sm text-muted-foreground mb-3'>
            Aim for 5,000-15,000 tokens for most tasks. This typically includes:
          </p>
          <ul className='text-sm text-muted-foreground space-y-1'>
            <li>• 3-10 core files directly related to your task</li>
            <li>• 1-3 configuration or schema files for context</li>
            <li>• Clear instructions about what you want to achieve</li>
          </ul>
        </div>
      </section>

      {/* Strategy 1: Start with AI Suggestions */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary'>
            <Zap className='h-5 w-5' />
          </span>
          Strategy 1: Start with AI Suggestions
        </h2>

        <p className='text-muted-foreground'>
          The fastest way to build good context is letting AI analyze your task and suggest relevant files.
        </p>

        <div className='space-y-6'>
          <div>
            <h3 className='text-xl font-medium mb-3'>Step 1: Describe Your Task Clearly</h3>
            <p className='text-muted-foreground mb-3'>Be specific about what you want to accomplish:</p>

            <div className='grid md:grid-cols-2 gap-4'>
              <GlassCard className='p-4'>
                <h4 className='font-medium text-red-500 mb-2'>❌ Too Vague</h4>
                <CodeBlock code='Fix the login' language='text' />
              </GlassCard>

              <GlassCard className='p-4'>
                <h4 className='font-medium text-green-500 mb-2'>✅ Clear & Specific</h4>
                <CodeBlock
                  code='Fix the login form validation to show error messages when email format is invalid'
                  language='text'
                />
              </GlassCard>
            </div>
          </div>

          <div>
            <h3 className='text-xl font-medium mb-3'>Step 2: Use File Suggestions</h3>
            <FeatureScreenshot
              src='/assets/screenshots/recommended-files-dialog.webp'
              alt='File Suggestions Dialog'
              title='AI File Suggestions'
              description='AI analyzes your task and suggests files ranked by relevance'
              layout='centered'
            />

            <div className='mt-4 space-y-3'>
              <h4 className='font-medium'>Understanding the Strategies:</h4>

              <div className='grid md:grid-cols-3 gap-4'>
                <GlassCard className='p-4'>
                  <h5 className='font-medium mb-1'>Fast (No AI)</h5>
                  <p className='text-xs text-muted-foreground'>
                    Pure keyword matching. Best for large codebases or when you know exact file names.
                  </p>
                </GlassCard>

                <GlassCard className='p-4'>
                  <h5 className='font-medium mb-1'>Balanced (Default)</h5>
                  <p className='text-xs text-muted-foreground'>
                    Pre-filters 50 files, AI refines. Good balance of speed and accuracy.
                  </p>
                </GlassCard>

                <GlassCard className='p-4'>
                  <h5 className='font-medium mb-1'>Thorough</h5>
                  <p className='text-xs text-muted-foreground'>
                    Pre-filters 100 files, best AI model. For complex tasks needing high accuracy.
                  </p>
                </GlassCard>
              </div>
            </div>
          </div>

          <div>
            <h3 className='text-xl font-medium mb-3'>Step 3: Review and Select</h3>
            <p className='text-muted-foreground mb-3'>
              Don't blindly accept all suggestions. Review each file and ask yourself:
            </p>
            <ul className='space-y-2'>
              <li className='flex items-start gap-2'>
                <CheckCircle className='h-4 w-4 text-green-500 mt-0.5' />
                <span className='text-sm'>Is this file directly related to my task?</span>
              </li>
              <li className='flex items-start gap-2'>
                <CheckCircle className='h-4 w-4 text-green-500 mt-0.5' />
                <span className='text-sm'>Does it contain code I need to modify or understand?</span>
              </li>
              <li className='flex items-start gap-2'>
                <CheckCircle className='h-4 w-4 text-green-500 mt-0.5' />
                <span className='text-sm'>Will AI need this for context about data structures or APIs?</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Strategy 2: Manual Curation */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold flex items-center gap-3'>
          <span className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary'>
            <Target className='h-5 w-5' />
          </span>
          Strategy 2: Manual Context Curation
        </h2>

        <p className='text-muted-foreground'>
          Sometimes you know exactly which files you need. Here's how to build context manually for maximum precision.
        </p>

        <div className='space-y-6'>
          <div>
            <h3 className='text-xl font-medium mb-3'>The Context Layers Approach</h3>
            <p className='text-muted-foreground mb-3'>Think of context as layers, starting from the most essential:</p>

            <div className='space-y-4'>
              <GlassCard className='p-6'>
                <div className='flex items-center gap-3 mb-3'>
                  <span className='flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-500 text-sm font-bold'>
                    1
                  </span>
                  <h4 className='font-medium'>Core Files (Must Have)</h4>
                </div>
                <p className='text-sm text-muted-foreground mb-2'>
                  Files you'll directly modify or that contain the bug/feature area.
                </p>
                <div className='bg-muted/50 rounded p-3 font-mono text-xs'>
                  <div>components/LoginForm.tsx</div>
                  <div>hooks/useAuth.ts</div>
                  <div>services/authService.ts</div>
                </div>
              </GlassCard>

              <GlassCard className='p-6'>
                <div className='flex items-center gap-3 mb-3'>
                  <span className='flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 text-sm font-bold'>
                    2
                  </span>
                  <h4 className='font-medium'>Supporting Files (Important)</h4>
                </div>
                <p className='text-sm text-muted-foreground mb-2'>Types, schemas, and closely related components.</p>
                <div className='bg-muted/50 rounded p-3 font-mono text-xs'>
                  <div>types/auth.types.ts</div>
                  <div>schemas/user.schema.ts</div>
                  <div>components/ErrorMessage.tsx</div>
                </div>
              </GlassCard>

              <GlassCard className='p-6'>
                <div className='flex items-center gap-3 mb-3'>
                  <span className='flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 text-green-500 text-sm font-bold'>
                    3
                  </span>
                  <h4 className='font-medium'>Context Files (Nice to Have)</h4>
                </div>
                <p className='text-sm text-muted-foreground mb-2'>
                  Configuration, routes, or high-level architecture files.
                </p>
                <div className='bg-muted/50 rounded p-3 font-mono text-xs'>
                  <div>app/routes/auth.route.ts</div>
                  <div>config/validation.config.ts</div>
                  <div>README.md (if it has relevant docs)</div>
                </div>
              </GlassCard>
            </div>
          </div>

          <div>
            <h3 className='text-xl font-medium mb-3'>Quick Selection Tips</h3>

            <div className='grid md:grid-cols-2 gap-4'>
              <GlassCard className='p-4'>
                <h4 className='font-medium mb-2'>Use Search (Cmd/Ctrl + K)</h4>
                <p className='text-sm text-muted-foreground'>
                  Quickly find files by name or content. Great when you know what you're looking for.
                </p>
              </GlassCard>

              <GlassCard className='p-4'>
                <h4 className='font-medium mb-2'>Follow Imports</h4>
                <p className='text-sm text-muted-foreground'>
                  If a file imports something relevant, consider adding that imported file too.
                </p>
              </GlassCard>
            </div>
          </div>
        </div>
      </section>

      {/* Common Patterns */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Context Patterns for Common Tasks</h2>

        <div className='space-y-4'>
          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>🐛 Bug Fixing</h3>
            <div className='grid md:grid-cols-2 gap-4'>
              <div>
                <h4 className='text-sm font-medium mb-2'>Include:</h4>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  <li>• File with the bug</li>
                  <li>• Related test files</li>
                  <li>• Error stack trace (in user input)</li>
                  <li>• Any files mentioned in error</li>
                </ul>
              </div>
              <div>
                <h4 className='text-sm font-medium mb-2'>Example Context:</h4>
                <div className='bg-muted/50 rounded p-2 text-xs font-mono'>
                  <div>components/UserProfile.tsx</div>
                  <div>hooks/useUserData.ts</div>
                  <div>services/userService.test.ts</div>
                  <div>types/user.types.ts</div>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>✨ New Feature</h3>
            <div className='grid md:grid-cols-2 gap-4'>
              <div>
                <h4 className='text-sm font-medium mb-2'>Include:</h4>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  <li>• Similar existing features</li>
                  <li>• Relevant schemas/types</li>
                  <li>• API routes if backend work</li>
                  <li>• Parent components</li>
                </ul>
              </div>
              <div>
                <h4 className='text-sm font-medium mb-2'>Example Context:</h4>
                <div className='bg-muted/50 rounded p-2 text-xs font-mono'>
                  <div>features/posts/PostList.tsx</div>
                  <div>features/posts/PostItem.tsx</div>
                  <div>api/posts.api.ts</div>
                  <div>schemas/post.schema.ts</div>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>♻️ Refactoring</h3>
            <div className='grid md:grid-cols-2 gap-4'>
              <div>
                <h4 className='text-sm font-medium mb-2'>Include:</h4>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  <li>• All files to be refactored</li>
                  <li>• Their dependencies</li>
                  <li>• Test files</li>
                  <li>• Usage examples</li>
                </ul>
              </div>
              <div>
                <h4 className='text-sm font-medium mb-2'>Example Context:</h4>
                <div className='bg-muted/50 rounded p-2 text-xs font-mono'>
                  <div>utils/oldHelpers.ts</div>
                  <div>utils/newHelpers.ts</div>
                  <div>components/*(files using helpers)</div>
                  <div>tests/helpers.test.ts</div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Token Management */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Managing Token Usage</h2>

        <FeatureScreenshot
          src='/assets/screenshots/project-context-selected-files.webp'
          alt='Token Counter'
          title='Real-time Token Tracking'
          description='Monitor token usage as you build context'
          layout='centered'
        />

        <div className='grid md:grid-cols-2 gap-6'>
          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>Token Guidelines by Model</h3>
            <ul className='space-y-2 text-sm'>
              <li className='flex justify-between'>
                <span className='text-muted-foreground'>GPT-4</span>
                <span className='font-mono'>8k - 128k tokens</span>
              </li>
              <li className='flex justify-between'>
                <span className='text-muted-foreground'>Claude 3</span>
                <span className='font-mono'>200k tokens</span>
              </li>
              <li className='flex justify-between'>
                <span className='text-muted-foreground'>GPT-3.5</span>
                <span className='font-mono'>4k - 16k tokens</span>
              </li>
            </ul>
            <p className='text-xs text-muted-foreground mt-3'>Leave ~20% headroom for AI responses</p>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>Optimization Tips</h3>
            <ul className='space-y-2 text-sm text-muted-foreground'>
              <li>• Remove large test files unless needed</li>
              <li>• Exclude generated files (build, dist)</li>
              <li>• Skip repetitive code (multiple similar components)</li>
              <li>• Use summaries for large documentation files</li>
            </ul>
          </GlassCard>
        </div>

        <div className='bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6'>
          <div className='flex items-start gap-3'>
            <AlertCircle className='h-5 w-5 text-yellow-500 mt-0.5' />
            <div>
              <h3 className='font-medium mb-2'>Pro Tip: Progressive Enhancement</h3>
              <p className='text-sm text-muted-foreground'>
                Start with minimal context and add more if AI asks for specific files. This iterative approach often
                uses fewer tokens overall.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Tips */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Advanced Context Building</h2>

        <div className='space-y-4'>
          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>Use Prompts for Repeated Context</h3>
            <p className='text-sm text-muted-foreground mb-3'>
              Save frequently used instructions as prompts to avoid retyping:
            </p>
            <CodeBlock
              code={`Prompt: "Code Review Standards"
Content: "Review this code for:
- Security vulnerabilities
- Performance issues
- Code style consistency
- Missing error handling
- Test coverage"`}
              language='text'
            />
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>Combine Multiple Selection Methods</h3>
            <p className='text-sm text-muted-foreground mb-3'>Use all available tools for best results:</p>
            <ol className='space-y-2 text-sm'>
              <li>1. Start with AI suggestions for the main files</li>
              <li>2. Use search to find specific utilities or configs</li>
              <li>3. Browse to add any missed dependencies</li>
              <li>4. Review total context and remove unnecessary files</li>
            </ol>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='font-medium mb-3'>Learn from Patterns</h3>
            <p className='text-sm text-muted-foreground mb-3'>
              Pay attention to which files AI finds most useful for different tasks. Over time, you'll develop intuition
              for building perfect context quickly.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* Next Steps */}
      <GlassCard className='p-8 bg-primary/5 border-primary/20'>
        <h3 className='text-xl font-semibold mb-3'>Master Context Building</h3>
        <p className='mb-4 text-muted-foreground'>
          Great context is the foundation of effective AI assistance. Keep practicing these strategies!
        </p>
        <ul className='space-y-2'>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/how-to/tickets-tasks' className='text-primary hover:underline'>
              Learn to organize work with tickets
            </a>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/guides#file-suggestions' className='text-primary hover:underline'>
              Deep dive into file suggestions
            </a>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/guides#performance' className='text-primary hover:underline'>
              Optimize for performance
            </a>
          </li>
        </ul>
      </GlassCard>
    </div>
  )
}
