import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button
} from '@promptliano/ui'
import { ArrowRight, Sparkles, Code2 } from 'lucide-react'
import { featuresData, type FeatureItem, type FeatureCategory } from '@/schemas/features.schemas'
import { fadeInUp, staggerContainer } from '@/components/ui/animation-utils'

interface FeatureCardProps {
  feature: FeatureItem
  index: number
}

function FeatureCard({ feature, index }: FeatureCardProps) {
  return (
    <motion.div
      variants={fadeInUp}
      custom={index}
      initial='initial'
      whileInView='animate'
      viewport={{ once: true }}
      className='group h-full'
    >
      <Card className='h-full border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5'>
        <CardHeader>
          <div className='flex items-start justify-between gap-4'>
            <div className='flex items-start gap-3'>
              {feature.icon && (
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-lg transition-colors group-hover:bg-primary/20',
                    feature.icon.color
                  )}
                >
                  {feature.icon.value}
                </div>
              )}
              <div className='flex-1'>
                <CardTitle className='text-lg font-semibold'>{feature.title}</CardTitle>
                {feature.badge && (
                  <Badge variant={feature.badge.variant} className='mt-2'>
                    {feature.badge.text}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <CardDescription className='mt-2 text-sm'>{feature.description}</CardDescription>
        </CardHeader>

        <CardContent className='space-y-4'>
          {feature.metrics && (
            <div className='rounded-lg bg-primary/5 p-3'>
              <div className='text-2xl font-bold text-primary'>{feature.metrics.value}</div>
              <div className='text-xs text-muted-foreground'>{feature.metrics.label}</div>
              {feature.metrics.improvement && (
                <div className='text-xs text-green-600 dark:text-green-400'>{feature.metrics.improvement}</div>
              )}
            </div>
          )}

          {feature.highlights && (
            <ul className='space-y-1'>
              {feature.highlights.map((highlight, idx) => (
                <li key={idx} className='flex items-start gap-2 text-sm text-muted-foreground'>
                  <span className='mt-0.5 text-primary'>•</span>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          )}

          {feature.codeExample && (
            <div className='rounded-md bg-zinc-900 p-3'>
              <div className='flex items-center justify-between mb-2'>
                <div className='flex items-center gap-2'>
                  <Code2 className='h-3 w-3 text-zinc-400' />
                  {feature.codeExample.filename && (
                    <span className='text-xs text-zinc-400'>{feature.codeExample.filename}</span>
                  )}
                </div>
                <span className='text-xs text-zinc-500'>{feature.codeExample.language}</span>
              </div>
              <pre className='text-xs overflow-x-auto'>
                <code className='text-zinc-300'>{feature.codeExample.code}</code>
              </pre>
            </div>
          )}

          {feature.learnMoreLink && (
            <Button variant='ghost' size='sm' className='group/btn w-full justify-between' asChild>
              <a href={feature.learnMoreLink} target='_blank' rel='noopener noreferrer'>
                <span>Learn more</span>
                <ArrowRight className='h-3 w-3 transition-transform group-hover/btn:translate-x-1' />
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

interface CategoryContentProps {
  category: FeatureCategory
  features: FeatureItem[]
}

function CategoryContent({ category, features }: CategoryContentProps) {
  const categoryFeatures = features.filter((f) => f.category === category.id)

  return (
    <motion.div
      initial='initial'
      animate='animate'
      variants={staggerContainer}
      className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
    >
      {categoryFeatures.map((feature, index) => (
        <FeatureCard key={feature.id} feature={feature} index={index} />
      ))}
    </motion.div>
  )
}

export function FeaturesSection() {
  const [activeCategory, setActiveCategory] = useState(featuresData.categories[0].id)

  return (
    <section className='relative py-24 lg:py-32 overflow-hidden'>
      {/* Background decoration */}
      <div className='absolute inset-0 -z-10 overflow-hidden'>
        <div className='absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl' />
        <div className='absolute right-0 bottom-0 h-[400px] w-[400px] rounded-full bg-primary/10 blur-3xl' />
      </div>

      <div className='container relative mx-auto px-4'>
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className='mx-auto max-w-3xl text-center'
        >
          <div className='mb-4 flex items-center justify-center gap-2'>
            <Sparkles className='h-5 w-5 text-primary' />
            <span className='text-sm font-medium text-primary'>Comprehensive Features</span>
          </div>

          <h2 className='mb-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl'>{featuresData.title}</h2>

          <p className='mb-2 text-lg text-muted-foreground sm:text-xl'>{featuresData.subtitle}</p>

          {featuresData.description && <p className='text-base text-muted-foreground'>{featuresData.description}</p>}
        </motion.div>

        {/* Features tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className='mt-16'
        >
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className='w-full overflow-x-hidden'>
            <TabsList className='mb-8 flex h-auto w-full flex-wrap justify-center gap-2 bg-transparent p-0 overflow-x-auto'>
              {featuresData.categories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className={cn(
                    'group relative flex items-center gap-2 rounded-full px-6 py-3',
                    'bg-background/50 backdrop-blur-sm',
                    'border border-border/50',
                    'transition-all duration-300',
                    'hover:border-primary/50 hover:bg-background/80',
                    'data-[state=active]:border-primary data-[state=active]:bg-primary/10',
                    'data-[state=active]:text-primary data-[state=active]:shadow-lg',
                    'data-[state=active]:shadow-primary/20'
                  )}
                >
                  <span className='text-lg'>{category.icon.value}</span>
                  <span className='font-medium'>{category.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <AnimatePresence mode='wait'>
              {featuresData.categories.map((category) => (
                <TabsContent key={category.id} value={category.id} className='mt-0 focus-visible:outline-none'>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className='mb-8 text-center'>
                      <p className='text-lg text-muted-foreground'>{category.description}</p>
                    </div>
                    <CategoryContent category={category} features={featuresData.features} />
                  </motion.div>
                </TabsContent>
              ))}
            </AnimatePresence>
          </Tabs>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className='mt-16 text-center'
        >
          <p className='mb-6 text-lg text-muted-foreground'>Ready to transform your development workflow?</p>
          <div className='flex flex-col sm:flex-row items-center justify-center gap-4'>
            <Button size='lg' className='gap-2'>
              Get Started
              <ArrowRight className='h-4 w-4' />
            </Button>
            <Button size='lg' variant='outline' asChild>
              <a href='/docs' target='_blank' rel='noopener noreferrer'>
                Read Documentation
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
