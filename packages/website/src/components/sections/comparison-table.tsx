import { AnimateOnScroll, GlassCard } from '@/components/ui'
import { motion } from 'framer-motion'
import { Check, X, Minus } from 'lucide-react'

interface ComparisonFeature {
  feature: string
  description?: string
  withPromptliano: boolean | 'partial'
  withoutPromptliano: boolean | 'partial'
  highlight?: boolean
}

const comparisonData: ComparisonFeature[] = [
  {
    feature: 'Context Awareness',
    description: 'AI understands your entire codebase structure',
    withPromptliano: true,
    withoutPromptliano: false,
    highlight: true
  },
  {
    feature: 'Token Efficiency',
    description: 'Optimized context reduces API costs by 90%',
    withPromptliano: true,
    withoutPromptliano: false,
    highlight: true
  },
  {
    feature: 'Multi-Editor Support',
    description: 'Consistent experience across all MCP editors',
    withPromptliano: true,
    withoutPromptliano: false
  },
  {
    feature: 'Git Integration',
    description: 'Full access to branches, commits, and history',
    withPromptliano: true,
    withoutPromptliano: 'partial'
  },
  {
    feature: 'Project Management',
    description: 'Built-in tickets, tasks, and prompt library',
    withPromptliano: true,
    withoutPromptliano: false
  },
  {
    feature: 'File Relevance Scoring',
    description: 'Smart file suggestions based on context',
    withPromptliano: true,
    withoutPromptliano: false
  },
  {
    feature: 'Semantic Search',
    description: 'Find code by meaning, not just text',
    withPromptliano: true,
    withoutPromptliano: 'partial'
  },
  {
    feature: 'Human-in-the-Loop',
    description: 'Review and approve AI actions',
    withPromptliano: true,
    withoutPromptliano: 'partial'
  },
  {
    feature: 'Performance Metrics',
    description: 'Track AI efficiency and improvements',
    withPromptliano: true,
    withoutPromptliano: false
  },
  {
    feature: 'Automated Summaries',
    description: 'AI-generated file and project summaries',
    withPromptliano: true,
    withoutPromptliano: false
  }
]

function ComparisonIcon({ value }: { value: boolean | 'partial' }) {
  if (value === true) {
    return <Check className='h-5 w-5 text-green-500' />
  } else if (value === 'partial') {
    return <Minus className='h-5 w-5 text-yellow-500' />
  } else {
    return <X className='h-5 w-5 text-red-500' />
  }
}

export function ComparisonTable() {
  return (
    <section className='relative py-24'>
      <div className='container mx-auto px-4'>
        <AnimateOnScroll>
          <div className='text-center max-w-3xl mx-auto mb-16'>
            <h2 className='text-3xl md:text-4xl font-bold mb-4'>See the Difference Promptliano Makes</h2>
            <p className='text-lg text-muted-foreground'>
              Compare your AI development experience with and without Promptliano
            </p>
          </div>
        </AnimateOnScroll>

        <div className='max-w-5xl mx-auto'>
          <AnimateOnScroll>
            <GlassCard className='overflow-hidden'>
              {/* Desktop Table */}
              <div className='hidden md:block'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b border-border'>
                      <th className='text-left p-6 font-semibold'>Feature</th>
                      <th className='text-center p-6 font-semibold'>
                        <div className='inline-flex items-center gap-2'>
                          <span className='text-primary'>With Promptliano</span>
                          <div className='h-2 w-2 rounded-full bg-green-500 animate-pulse' />
                        </div>
                      </th>
                      <th className='text-center p-6 font-semibold text-muted-foreground'>Without Promptliano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((item, index) => (
                      <motion.tr
                        key={item.feature}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`border-b border-border/50 ${item.highlight ? 'bg-primary/5' : ''}`}
                      >
                        <td className='p-6'>
                          <div>
                            <p className='font-medium'>{item.feature}</p>
                            {item.description && (
                              <p className='text-sm text-muted-foreground mt-1'>{item.description}</p>
                            )}
                          </div>
                        </td>
                        <td className='p-6 text-center'>
                          <div className='flex justify-center'>
                            <ComparisonIcon value={item.withPromptliano} />
                          </div>
                        </td>
                        <td className='p-6 text-center'>
                          <div className='flex justify-center'>
                            <ComparisonIcon value={item.withoutPromptliano} />
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className='md:hidden'>
                <div className='p-4 border-b border-border'>
                  <div className='grid grid-cols-2 gap-4 text-center'>
                    <div className='font-semibold text-primary'>With Promptliano</div>
                    <div className='font-semibold text-muted-foreground'>Without</div>
                  </div>
                </div>
                {comparisonData.map((item, index) => (
                  <motion.div
                    key={item.feature}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 border-b border-border/50 ${item.highlight ? 'bg-primary/5' : ''}`}
                  >
                    <div className='mb-3'>
                      <p className='font-medium'>{item.feature}</p>
                      {item.description && <p className='text-sm text-muted-foreground mt-1'>{item.description}</p>}
                    </div>
                    <div className='grid grid-cols-2 gap-4'>
                      <div className='flex justify-center'>
                        <ComparisonIcon value={item.withPromptliano} />
                      </div>
                      <div className='flex justify-center'>
                        <ComparisonIcon value={item.withoutPromptliano} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </AnimateOnScroll>

          {/* Summary */}
          <AnimateOnScroll>
            <div className='mt-8 text-center'>
              <p className='text-muted-foreground mb-4'>Don't let context limitations slow down your AI development</p>
              <div className='inline-flex items-center gap-2 text-primary font-semibold'>
                <Check className='h-5 w-5' />
                <span>10+ exclusive features that transform your workflow</span>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  )
}
