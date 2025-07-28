import { AnimateOnScroll, GlassCard } from '@/components/ui'
import { MetricsSection as MetricsSectionType, Metric } from '@/schemas'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { TrendingUp, Zap, Users, Code, Clock, CheckCircle } from 'lucide-react'

const metrics: Metric[] = [
  {
    id: 'token-reduction',
    label: 'Token Reduction',
    value: 90,
    unit: '%',
    icon: 'TrendingUp',
    color: 'text-green-500',
    description: 'Average reduction in token usage',
    trend: {
      direction: 'up',
      percentage: 15,
      period: 'month'
    }
  },
  {
    id: 'response-time',
    label: 'Response Time',
    value: 250,
    unit: 'ms',
    icon: 'Zap',
    color: 'text-yellow-500',
    description: 'Average context retrieval time'
  },
  {
    id: 'active-users',
    label: 'Active Developers',
    value: 5000,
    unit: '+',
    icon: 'Users',
    color: 'text-blue-500',
    description: 'Developers using Promptliano daily',
    trend: {
      direction: 'up',
      percentage: 120,
      period: 'month'
    }
  },
  {
    id: 'files-managed',
    label: 'Files Managed',
    value: 1000000,
    unit: '+',
    icon: 'Code',
    color: 'text-purple-500',
    description: 'Total files under context management'
  },
  {
    id: 'time-saved',
    label: 'Time Saved',
    value: 40,
    unit: '%',
    icon: 'Clock',
    color: 'text-orange-500',
    description: 'Average development time saved'
  },
  {
    id: 'accuracy',
    label: 'AI Accuracy',
    value: 95,
    unit: '%',
    icon: 'CheckCircle',
    color: 'text-emerald-500',
    description: 'Improvement in AI suggestions',
    trend: {
      direction: 'up',
      percentage: 12,
      period: 'month'
    }
  }
]

function AnimatedCounter({ value, duration = 2, delay = 0 }: { value: number; duration?: number; delay?: number }) {
  const [displayValue, setDisplayValue] = useState(0)
  const nodeRef = useRef<HTMLSpanElement>(null)
  const inView = useRef(false)

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !inView.current) {
          inView.current = true
          setTimeout(() => {
            const controls = animate(0, value, {
              duration,
              onUpdate: (value) => setDisplayValue(Math.floor(value))
            })
            return () => controls.stop()
          }, delay * 1000)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [value, duration, delay])

  return <span ref={nodeRef}>{displayValue.toLocaleString()}</span>
}

export function MetricsSection() {
  const metricsData: MetricsSectionType = {
    title: 'Proven Results at Scale',
    subtitle: 'Join thousands of developers who are building faster and smarter with Promptliano',
    metrics,
    layout: 'stats',
    animated: true
  }

  const iconMap: Record<string, any> = {
    TrendingUp,
    Zap,
    Users,
    Code,
    Clock,
    CheckCircle
  }

  return (
    <section className='relative py-24 overflow-hidden'>
      {/* Background pattern */}
      <div className='absolute inset-0 -z-10'>
        <div className='absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent' />
        <div className='absolute inset-0 bg-grid-white/[0.02] bg-[length:30px_30px]' />
      </div>

      <div className='container mx-auto px-4'>
        <AnimateOnScroll>
          <div className='text-center max-w-3xl mx-auto mb-16'>
            <h2 className='text-3xl md:text-4xl font-bold mb-4'>{metricsData.title}</h2>
            <p className='text-lg text-muted-foreground'>{metricsData.subtitle}</p>
          </div>
        </AnimateOnScroll>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto'>
          {metricsData.metrics.map((metric, index) => {
            const Icon = iconMap[metric.icon || ''] || Zap
            return (
              <AnimateOnScroll key={metric.id} delay={index * 0.1}>
                <GlassCard className='p-6 hover:scale-105 transition-transform'>
                  <div className='flex items-start justify-between mb-4'>
                    <div className={`p-3 rounded-lg bg-background/50 ${metric.color}`}>
                      <Icon className='h-6 w-6' />
                    </div>
                    {metric.trend && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 + index * 0.1 }}
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          metric.trend.direction === 'up'
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-red-500/10 text-red-500'
                        }`}
                      >
                        {metric.trend.direction === 'up' ? '+' : '-'}
                        {metric.trend.percentage}%
                      </motion.div>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <p className='text-sm text-muted-foreground'>{metric.label}</p>
                    <div className='flex items-baseline gap-1'>
                      <span className='text-3xl font-bold'>
                        {metricsData.animated ? (
                          <AnimatedCounter
                            value={typeof metric.value === 'number' ? metric.value : 0}
                            delay={index * 0.1}
                          />
                        ) : typeof metric.value === 'number' ? (
                          metric.value.toLocaleString()
                        ) : (
                          metric.value
                        )}
                      </span>
                      <span className='text-xl text-muted-foreground'>{metric.unit}</span>
                    </div>
                    <p className='text-xs text-muted-foreground'>{metric.description}</p>
                  </div>
                </GlassCard>
              </AnimateOnScroll>
            )
          })}
        </div>

        {/* Social proof */}
        <AnimateOnScroll>
          <div className='mt-16 text-center'>
            <p className='text-sm text-muted-foreground'>Trusted by developers at</p>
            <div className='mt-6 flex justify-center items-center gap-8 opacity-50 grayscale'>
              {/* Placeholder for company logos */}
              <div className='h-8 w-24 bg-muted rounded' />
              <div className='h-8 w-24 bg-muted rounded' />
              <div className='h-8 w-24 bg-muted rounded' />
              <div className='h-8 w-24 bg-muted rounded' />
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  )
}
