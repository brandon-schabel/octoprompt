import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface RouteTransitionProps {
  children: ReactNode
}

export function RouteTransition({ children }: RouteTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        duration: 0.3,
        ease: 'easeInOut'
      }}
    >
      {children}
    </motion.div>
  )
}
