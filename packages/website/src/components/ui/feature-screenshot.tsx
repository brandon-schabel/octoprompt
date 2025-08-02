import { cn } from '@/lib/utils'
import { LazyImage } from '@/components/utils/lazy-image'
import { GlassCard } from './glass-card'
import { AnimateOnScroll } from './animation-utils'

interface FeatureScreenshotProps {
  src: string
  alt: string
  title?: string
  description?: string
  layout?: 'left' | 'right' | 'centered'
  priority?: boolean
  className?: string
  imageClassName?: string
  children?: React.ReactNode
}

export function FeatureScreenshot({
  src,
  alt,
  title,
  description,
  layout = 'centered',
  priority = false,
  className,
  imageClassName,
  children
}: FeatureScreenshotProps) {
  const screenshotSrc = src.startsWith('/') ? src : `/assets/screenshots/${src}`

  if (layout === 'centered') {
    return (
      <AnimateOnScroll>
        <div className={cn('space-y-6', className)}>
          {(title || description) && (
            <div className='text-center max-w-2xl mx-auto'>
              {title && <h3 className='text-2xl font-semibold mb-2'>{title}</h3>}
              {description && <p className='text-muted-foreground'>{description}</p>}
            </div>
          )}
          <GlassCard className='overflow-hidden p-0'>
            <LazyImage src={screenshotSrc} alt={alt} className={cn('w-full', imageClassName)} priority={priority} />
          </GlassCard>
          {children}
        </div>
      </AnimateOnScroll>
    )
  }

  const isLeft = layout === 'left'

  return (
    <AnimateOnScroll>
      <div className={cn('grid lg:grid-cols-2 gap-8 items-center', className)}>
        <div className={cn('space-y-4', !isLeft && 'lg:order-2')}>
          {title && <h3 className='text-2xl font-semibold'>{title}</h3>}
          {description && <p className='text-muted-foreground'>{description}</p>}
          {children}
        </div>
        <GlassCard className={cn('overflow-hidden p-0', isLeft && 'lg:order-2')}>
          <LazyImage src={screenshotSrc} alt={alt} className={cn('w-full', imageClassName)} priority={priority} />
        </GlassCard>
      </div>
    </AnimateOnScroll>
  )
}
