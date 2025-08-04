// Hero components - website specific
export { Hero, HeroGradient, HeroTyping } from './hero'
export { HeroButton } from './hero-button'

// Screenshot components - website specific
export { FeatureScreenshot } from './feature-screenshot'
export { ScreenshotGallery } from './screenshot-gallery'
export { ScreenshotCarousel } from './screenshot-carousel'

// Terminal and code components - website specific (different API than UI library)
// These have animation and website-specific features not in the generic UI library
export { CodeTerminal, CodeBlock } from './code-terminal'

// Website-specific wrappers and components
export { DownloadButton, DownloadButtonCompact } from './download-button'
export { CTAButton, CTAButtonAnimated, CTAButtonOutline, CTAButtonGroup } from './cta-button'

// Re-export components from @promptliano/ui
export {
  // Core components
  Badge,
  Button,
  buttonVariants,
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Label,
  Logo,
  Separator,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,

  // Surface components
  GlassCard,
  GlassCardGradient,
  FloatingGlass,
  GlassPanel,

  // Feedback components
  LoadingDots,
  LoadingSpinner,
  LoadingOverlay,
  LoadingSkeleton,

  // Marketing components
  FeatureCard,
  FeatureCardAnimated,
  FeatureGrid,

  // Animation utilities
  fadeIn,
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  rotateIn,
  staggerContainer,
  staggerItem,
  AnimateOnScroll,
  Parallax,
  AnimatedText,
  PageTransition,
  hoverScale,
  hoverRotate,
  hoverGlow,

  // Types
  type DownloadPlatform
} from '@promptliano/ui'
