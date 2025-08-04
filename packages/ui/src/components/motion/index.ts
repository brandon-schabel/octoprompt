// Animation utilities and components
export {
  // Animation variants
  fadeIn,
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  rotateIn,
  staggerContainer,
  staggerItem,

  // Hover animations
  hoverScale,
  hoverRotate,
  hoverGlow,

  // Components
  AnimateOnScroll,
  Parallax,
  AnimatedText,
  PageTransition
} from './animation-utils'

// Re-export framer-motion for convenience
export { motion, AnimatePresence } from 'framer-motion'
export type { Variants, MotionProps } from 'framer-motion'
