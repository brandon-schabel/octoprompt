import { motion, MotionProps } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassCardProps extends MotionProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'dark' | 'light' | 'colorful'
  blur?: 'sm' | 'md' | 'lg' | 'xl'
  border?: boolean
  glow?: boolean
  onClick?: () => void
}

export function GlassCard({
  children,
  className,
  variant = 'default',
  blur = 'md',
  border = true,
  glow = false,
  onClick,
  ...motionProps
}: GlassCardProps) {
  const blurValues = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
    xl: 'backdrop-blur-xl'
  }

  const variants = {
    default: 'bg-card/30',
    dark: 'bg-black/40',
    light: 'bg-white/30',
    colorful: 'bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      onClick={onClick}
      {...motionProps}
      className={cn(
        'relative overflow-hidden rounded-lg',
        blurValues[blur],
        variants[variant],
        border && 'border border-white/10',
        glow && 'shadow-xl shadow-primary/20',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {/* Noise texture overlay */}
      <div className='absolute inset-0 opacity-[0.015] mix-blend-overlay'>
        <svg width='100%' height='100%'>
          <filter id='noiseFilter'>
            <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch' />
          </filter>
          <rect width='100%' height='100%' filter='url(#noiseFilter)' />
        </svg>
      </div>

      {/* Content */}
      <div className='relative z-10'>{children}</div>
    </motion.div>
  )
}

// Glass card with animated gradient border
export function GlassCardGradient({
  children,
  className,
  blur = 'md',
  ...motionProps
}: Omit<GlassCardProps, 'variant' | 'border' | 'glow'>) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={cn('relative p-[1px] rounded-lg', className)}
      {...motionProps}
    >
      {/* Animated gradient border */}
      <motion.div
        className='absolute inset-0 rounded-lg bg-gradient-to-r from-primary via-secondary to-accent'
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
        }}
        transition={{
          duration: 5,
          ease: 'linear',
          repeat: Infinity
        }}
        style={{
          backgroundSize: '200% 200%'
        }}
      />

      {/* Glass content */}
      <div
        className={cn(
          'relative rounded-lg bg-background/50',
          blur === 'sm' && 'backdrop-blur-sm',
          blur === 'md' && 'backdrop-blur-md',
          blur === 'lg' && 'backdrop-blur-lg',
          blur === 'xl' && 'backdrop-blur-xl'
        )}
      >
        {children}
      </div>
    </motion.div>
  )
}

// Floating glass elements for backgrounds
interface FloatingGlassProps {
  count?: number
  className?: string
}

export function FloatingGlass({ count = 3, className }: FloatingGlassProps) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className='absolute h-64 w-64 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-xl'
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight
          }}
          animate={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight
          }}
          transition={{
            duration: Math.random() * 20 + 20,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'linear'
          }}
          style={{
            filter: 'blur(40px)'
          }}
        />
      ))}
    </div>
  )
}

// Glass morphism panel with sections
interface GlassPanelProps {
  title?: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export function GlassPanel({ title, description, children, actions, className }: GlassPanelProps) {
  return (
    <GlassCard
      className={cn('p-6', className)}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      {(title || description) && (
        <div className='mb-6'>
          {title && <h3 className='text-2xl font-semibold mb-2'>{title}</h3>}
          {description && <p className='text-muted-foreground'>{description}</p>}
        </div>
      )}

      <div className='space-y-4'>{children}</div>

      {actions && (
        <div className='mt-6 flex items-center justify-end gap-2 pt-6 border-t border-white/10'>{actions}</div>
      )}
    </GlassCard>
  )
}
