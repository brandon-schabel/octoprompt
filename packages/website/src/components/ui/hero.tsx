import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface HeroProps {
  title: string | ReactNode
  subtitle?: string | ReactNode
  children?: ReactNode
  className?: string
  centered?: boolean
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.1,
      staggerChildren: 0.2
    }
  }
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1]
    }
  }
}

export function Hero({ title, subtitle, children, className, centered = true }: HeroProps) {
  return (
    <motion.section
      variants={containerVariants}
      initial='hidden'
      animate='visible'
      className={cn('relative w-full px-4 py-24 sm:px-6 sm:py-32 lg:px-8', centered && 'text-center', className)}
    >
      {/* Background gradient */}
      <div className='absolute inset-0 -z-10 overflow-hidden'>
        <div className='absolute left-[50%] top-0 -translate-x-[50%] w-[200%] h-[600px]'>
          <div className='absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent blur-3xl' />
        </div>
      </div>

      <div className='mx-auto max-w-7xl'>
        <motion.h1
          variants={itemVariants}
          className='text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl'
        >
          {typeof title === 'string' ? (
            <span className='bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent'>{title}</span>
          ) : (
            title
          )}
        </motion.h1>

        {subtitle && (
          <motion.p variants={itemVariants} className='mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-muted-foreground'>
            {subtitle}
          </motion.p>
        )}

        {children && (
          <motion.div variants={itemVariants} className='mt-10 flex items-center justify-center gap-4 flex-wrap'>
            {children}
          </motion.div>
        )}
      </div>
    </motion.section>
  )
}

// Hero with animated gradient text
export function HeroGradient({ title, subtitle, children, className }: HeroProps) {
  return (
    <Hero
      title={
        <motion.span
          className='inline-block bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent'
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
        >
          {title}
        </motion.span>
      }
      subtitle={subtitle}
      className={className}
    >
      {children}
    </Hero>
  )
}

// Hero with typing animation
export function HeroTyping({ title, subtitle, children, className }: HeroProps & { title: string }) {
  const letters = title.split('')

  return (
    <Hero
      title={
        <span className='inline-block'>
          {letters.map((letter, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: i * 0.05,
                ease: [0.4, 0, 0.2, 1]
              }}
              className='inline-block bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent'
              style={{
                whiteSpace: letter === ' ' ? 'pre' : 'normal'
              }}
            >
              {letter}
            </motion.span>
          ))}
        </span>
      }
      subtitle={subtitle}
      className={className}
    >
      {children}
    </Hero>
  )
}
