import { z } from 'zod'

/**
 * Feature category schema
 */
export const FeatureCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.object({
    type: z.enum(['icon', 'emoji', 'svg']),
    value: z.string(),
    color: z.string().optional()
  })
})

/**
 * Feature item detail schema
 */
export const FeatureItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  icon: z
    .object({
      type: z.enum(['icon', 'emoji', 'svg']),
      value: z.string(),
      color: z.string().optional()
    })
    .optional(),
  highlights: z.array(z.string()).optional(),
  badge: z
    .object({
      text: z.string(),
      variant: z.enum(['default', 'secondary', 'destructive', 'outline', 'count', 'warning', 'high']).default('default')
    })
    .optional(),
  metrics: z
    .object({
      value: z.string(),
      label: z.string(),
      improvement: z.string().optional()
    })
    .optional(),
  codeExample: z
    .object({
      language: z.string(),
      code: z.string(),
      filename: z.string().optional()
    })
    .optional(),
  learnMoreLink: z.string().optional()
})

/**
 * Features section configuration schema
 */
export const FeaturesSectionSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  description: z.string().optional(),
  categories: z.array(FeatureCategorySchema),
  features: z.array(FeatureItemSchema),
  layout: z.object({
    type: z.enum(['grid', 'tabs', 'accordion', 'cards']).default('tabs'),
    columns: z
      .object({
        mobile: z.number().min(1).max(2).default(1),
        tablet: z.number().min(2).max(3).default(2),
        desktop: z.number().min(3).max(4).default(3),
        wide: z.number().min(4).max(6).default(4)
      })
      .optional()
  })
})

// Type exports
export type FeatureCategory = z.infer<typeof FeatureCategorySchema>
export type FeatureItem = z.infer<typeof FeatureItemSchema>
export type FeaturesSection = z.infer<typeof FeaturesSectionSchema>

// Feature data configuration
export const featuresData: FeaturesSection = {
  title: 'Everything You Need for AI-Powered Development',
  subtitle: 'Comprehensive tools designed to supercharge your workflow',
  description:
    'Promptliano brings together powerful features that work seamlessly with your favorite AI coding assistants.',
  layout: {
    type: 'tabs',
    columns: {
      mobile: 1,
      tablet: 2,
      desktop: 3,
      wide: 4
    }
  },
  categories: [
    {
      id: 'core-tools',
      name: 'Core MCP Tools',
      description: 'Essential tools for AI-assisted development',
      icon: { type: 'emoji', value: '🛠️' }
    },
    {
      id: 'workflow',
      name: 'Workflow Management',
      description: 'Organize and track your development tasks',
      icon: { type: 'emoji', value: '📋' }
    },
    {
      id: 'efficiency',
      name: 'Token Efficiency',
      description: 'Optimize AI interactions and reduce costs',
      icon: { type: 'emoji', value: '⚡' }
    },
    {
      id: 'collaboration',
      name: 'AI Collaboration',
      description: 'Enhanced features for working with AI assistants',
      icon: { type: 'emoji', value: '🤝' }
    },
    {
      id: 'git-integration',
      name: 'Git Integration',
      description: 'Complete version control within your workflow',
      icon: { type: 'emoji', value: '🔀' }
    }
  ],
  features: [
    // Core MCP Tools
    {
      id: 'overview-tool',
      title: 'MCP Overview Tool',
      description:
        'Get instant context about your project with a single command. Shows active files, recent tickets, prompts, and project structure.',
      category: 'core-tools',
      icon: { type: 'emoji', value: '🔍' },
      highlights: [
        'Instant project context',
        'Active tab awareness',
        'Recent activity tracking',
        'File summarization status'
      ],
      codeExample: {
        language: 'typescript',
        code: 'mcp__promptliano__project_manager(\n  action: "overview",\n  projectId: 1234567890\n)',
        filename: 'overview-example.ts'
      }
    },
    {
      id: 'mcp-analytics',
      title: 'MCP Analytics Dashboard',
      description: 'Track AI tool usage, monitor performance, and optimize your workflow with detailed analytics.',
      category: 'core-tools',
      icon: { type: 'emoji', value: '📊' },
      highlights: [
        'Tool usage tracking',
        'Performance metrics',
        'Cost optimization insights',
        'Usage patterns analysis'
      ]
    },

    // Workflow Management
    {
      id: 'tickets-tasks',
      title: 'Tickets & Tasks System',
      description:
        'Organize complex projects with a hierarchical ticket and task system designed for AI collaboration.',
      category: 'workflow',
      icon: { type: 'emoji', value: '🎯' },
      highlights: [
        'Hierarchical organization',
        'Priority management',
        'Progress tracking',
        'AI-friendly task descriptions'
      ],
      badge: { text: 'Essential', variant: 'default' }
    },
    {
      id: 'project-tabs',
      title: 'Project Tabs',
      description:
        'Maintain multiple contexts within a project. Switch between different features without losing state.',
      category: 'workflow',
      icon: { type: 'emoji', value: '📑' },
      highlights: [
        'Multiple active contexts',
        'Persistent across sessions',
        'Quick context switching',
        'Tab-specific file selections'
      ]
    },

    // Token Efficiency
    {
      id: 'suggested-files',
      title: 'AI-Powered File Suggestions',
      description: 'Revolutionary file discovery that reduces token usage by 60-70% using intelligent pre-filtering.',
      category: 'efficiency',
      icon: { type: 'emoji', value: '📁' },
      metrics: {
        value: '60-70%',
        label: 'Token Reduction',
        improvement: 'vs. traditional search'
      },
      highlights: [
        'Three strategy levels',
        'Context-aware suggestions',
        'Import relationship analysis',
        'Performance metrics included'
      ],
      badge: { text: 'Game Changer', variant: 'high' }
    },
    {
      id: 'file-summarization',
      title: 'Intelligent File Summarization',
      description:
        'Automatic file summaries that help AI assistants understand your codebase without reading entire files.',
      category: 'efficiency',
      icon: { type: 'emoji', value: '📝' },
      highlights: ['Batch processing', 'Smart grouping strategies', 'Progress tracking', 'Stale summary detection']
    },
    {
      id: 'prompt-library',
      title: 'Global Prompt Library',
      description: 'Save and reuse documentation, patterns, and knowledge across all your projects.',
      category: 'efficiency',
      icon: { type: 'emoji', value: '📚' },
      highlights: ['Project associations', 'Quick retrieval', 'Library organization', 'Knowledge sharing']
    },

    // AI Collaboration
    {
      id: 'suggested-prompts',
      title: 'Context-Aware Prompt Suggestions',
      description: 'Get intelligent prompt suggestions based on your current task and project context.',
      category: 'collaboration',
      icon: { type: 'emoji', value: '💡' },
      highlights: ['Task-specific suggestions', 'Context awareness', 'Prompt optimization', 'Usage tracking']
    },
    {
      id: 'chat-integration',
      title: 'Multi-Provider Chat',
      description: 'Built-in chat with support for all major AI providers in one unified interface.',
      category: 'collaboration',
      icon: { type: 'emoji', value: '💬' },
      highlights: [
        'OpenRouter, OpenAI, Anthropic',
        'XAI, Gemini, Grok',
        'Together, LMStudio, Ollama',
        'Unified conversation history'
      ],
      badge: { text: 'All Providers', variant: 'secondary' }
    },
    {
      id: 'active-tab-sync',
      title: 'Active Tab Syncing',
      description: 'Your selected files and context automatically sync with AI assistants for seamless collaboration.',
      category: 'collaboration',
      icon: { type: 'emoji', value: '🔄' },
      highlights: ['Real-time sync', 'Context preservation', 'Multi-file selection', 'AI awareness']
    },
    {
      id: 'project-assets',
      title: 'Project Assets Management',
      description: 'Manage documentation, diagrams, and visual assets that AI can reference and use.',
      category: 'collaboration',
      icon: { type: 'emoji', value: '🎨' },
      highlights: ['Markdown documentation', 'Mermaid diagrams', 'SVG assets', 'AI-accessible references']
    },

    // Git Integration
    {
      id: 'git-operations',
      title: 'Complete Git Integration',
      description: 'Full git workflow support including staging, commits, branches, and advanced features.',
      category: 'git-integration',
      icon: { type: 'emoji', value: '🌿' },
      highlights: ['Stage and commit files', 'Branch management', 'Interactive diffs', 'Commit history']
    },
    {
      id: 'git-worktrees',
      title: 'Git Worktrees Support',
      description: 'Advanced git worktree management for working on multiple branches simultaneously.',
      category: 'git-integration',
      icon: { type: 'emoji', value: '🌳' },
      highlights: [
        'Multiple working directories',
        'Quick branch switching',
        'Parallel development',
        'Worktree management'
      ],
      badge: { text: 'Advanced', variant: 'outline' }
    },
    {
      id: 'git-stash',
      title: 'Stash Management',
      description: 'Save and manage work in progress with full stash support.',
      category: 'git-integration',
      icon: { type: 'emoji', value: '📦' },
      highlights: ['Quick stashing', 'Named stashes', 'Stash browsing', 'Apply and pop operations']
    }
  ]
}
