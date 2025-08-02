import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface FeatureCardProps {
  title: string
  description: string
  icon?: LucideIcon
  children?: ReactNode
  className?: string
  variant?: 'default' | 'gradient' | 'glass'
}

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1]
    }
  }
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  variant = 'default'
}: FeatureCardProps) {
  const baseStyles = 'relative overflow-hidden rounded-lg p-6 transition-all duration-300'

  const variants = {
    default: 'bg-card border border-border hover:border-primary/50 hover:shadow-lg',
    gradient:
      'bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 border border-primary/20 hover:border-primary/40',
    glass: 'backdrop-blur-md bg-card/50 border border-border/50 hover:bg-card/60'
  }

  return (
    <motion.div
      variants={cardVariants}
      initial='hidden'
      whileInView='visible'
      viewport={{ once: true, margin: '-50px' }}
      whileHover={{ y: -4 }}
      className={cn(baseStyles, variants[variant], className)}
    >
      {Icon && (
        <div className='mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10'>
          <Icon className='h-6 w-6 text-primary' />
        </div>
      )}

      <h3 className='mb-2 text-xl font-semibold'>{title}</h3>
      <p className='text-sm text-muted-foreground'>{description}</p>

      {children && <div className='mt-4'>{children}</div>}

      {/* Hover effect overlay */}
      <motion.div
        className='absolute inset-0 -z-10 opacity-0'
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className='absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent' />
      </motion.div>
    </motion.div>
  )
}

// Feature card with animated border
export function FeatureCardAnimated({ title, description, icon: Icon, children, className }: FeatureCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial='hidden'
      whileInView='visible'
      viewport={{ once: true, margin: '-50px' }}
      className={cn('relative group', className)}
    >
      {/* Animated border */}
      <div className='absolute -inset-[1px] rounded-lg bg-gradient-to-r from-primary via-secondary to-accent opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500' />

      <div className='relative rounded-lg bg-card p-6'>
        {Icon && (
          <motion.div
            className='mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10'
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <Icon className='h-6 w-6 text-primary' />
          </motion.div>
        )}

        <h3 className='mb-2 text-xl font-semibold'>{title}</h3>
        <p className='text-sm text-muted-foreground'>{description}</p>

        {children && <div className='mt-4'>{children}</div>}
      </div>
    </motion.div>
  )
}

// Grid container for feature cards
interface FeatureGridProps {
  children: ReactNode
  columns?:
    | 1
    | 2
    | 3
    | 4
    | {
        mobile?: number
        tablet?: number
        desktop?: number
      }
  className?: string
}

export function FeatureGrid({ children, columns = 3, className }: FeatureGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }

  const getGridClasses = () => {
    if (typeof columns === 'object') {
      const classes = []
      if (columns.mobile) classes.push(`grid-cols-${columns.mobile}`)
      if (columns.tablet) classes.push(`md:grid-cols-${columns.tablet}`)
      if (columns.desktop) classes.push(`lg:grid-cols-${columns.desktop}`)
      return classes.join(' ')
    }
    return gridCols[columns]
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, staggerChildren: 0.1 }}
      className={cn('grid gap-6', getGridClasses(), className)}
    >
      {children}
    </motion.div>
  )
}
