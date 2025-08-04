import { motion, useInView, useAnimation, useScroll, useTransform } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

// Common animation variants
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  }
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  }
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  }
}

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  }
}

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  }
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  }
}

export const rotateIn: Variants = {
  hidden: { opacity: 0, rotate: -10 },
  visible: {
    opacity: 1,
    rotate: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  }
}

// Stagger children animations
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  }
}

// Animation wrapper components
interface AnimateOnScrollProps {
  children: ReactNode
  variants?: Variants
  className?: string
  threshold?: number
  triggerOnce?: boolean
  delay?: number
}

export function AnimateOnScroll({
  children,
  variants = fadeInUp,
  className,
  threshold = 0.1,
  triggerOnce = true,
  delay = 0
}: AnimateOnScrollProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, {
    once: triggerOnce,
    margin: '0px 0px -100px 0px',
    amount: threshold
  })
  const controls = useAnimation()

  useEffect(() => {
    if (isInView) {
      if (delay > 0) {
        const timeout = setTimeout(() => {
          controls.start('visible')
        }, delay * 1000)
        return () => clearTimeout(timeout)
      } else {
        controls.start('visible')
      }
    } else if (!triggerOnce) {
      controls.start('hidden')
    }
  }, [isInView, controls, triggerOnce, delay])

  return (
    <motion.div ref={ref} initial='hidden' animate={controls} variants={variants} className={className}>
      {children}
    </motion.div>
  )
}

// Parallax scroll effect
interface ParallaxProps {
  children: ReactNode
  speed?: number
  className?: string
}

export function Parallax({ children, speed = 0.5, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start']
  })

  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 100])

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  )
}

// Text animation components
interface AnimatedTextProps {
  text: string
  className?: string
  delay?: number
}

export function AnimatedText({ text, className, delay = 0 }: AnimatedTextProps) {
  const words = text.split(' ')

  return (
    <motion.span initial='hidden' animate='visible' className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className='inline-block'
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: {
              opacity: 1,
              y: 0,
              transition: {
                duration: 0.5,
                delay: delay + i * 0.1,
                ease: [0.4, 0, 0.2, 1]
              }
            }
          }}
        >
          {word}{' '}
        </motion.span>
      ))}
    </motion.span>
  )
}

// Hover animations
export const hoverScale = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.95 },
  transition: { type: 'spring', stiffness: 400, damping: 17 }
}

export const hoverRotate = {
  whileHover: { rotate: 5 },
  transition: { type: 'spring', stiffness: 400, damping: 17 }
}

export const hoverGlow = {
  whileHover: {
    boxShadow: '0 0 20px rgba(var(--primary), 0.5)',
    transition: { duration: 0.3 }
  }
}

// Page transition wrapper
interface PageTransitionProps {
  children: ReactNode
  className?: string
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
