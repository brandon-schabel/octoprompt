import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { LazyImage } from '@/components/utils/lazy-image'
import { GlassCard } from './glass-card'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Screenshot {
  src: string
  alt: string
  title?: string
  description?: string
}

interface ScreenshotCarouselProps {
  screenshots: Screenshot[]
  autoPlay?: boolean
  interval?: number
  showIndicators?: boolean
  showControls?: boolean
  className?: string
}

export function ScreenshotCarousel({
  screenshots,
  autoPlay = true,
  interval = 5000,
  showIndicators = true,
  showControls = true,
  className
}: ScreenshotCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (!autoPlay || isPaused) return

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % screenshots.length)
    }, interval)

    return () => clearInterval(timer)
  }, [autoPlay, interval, isPaused, screenshots.length])

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length)
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % screenshots.length)
  }

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <GlassCard className='overflow-hidden p-0'>
        <div className='relative aspect-[16/9]'>
          {screenshots.map((screenshot, index) => (
            <div
              key={index}
              className={cn(
                'absolute inset-0 transition-opacity duration-500',
                index === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
            >
              <LazyImage
                src={screenshot.src.startsWith('/') ? screenshot.src : `/assets/screenshots/${screenshot.src}`}
                alt={screenshot.alt}
                className='w-full h-full object-cover'
                priority={index === 0}
              />
              {(screenshot.title || screenshot.description) && (
                <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6'>
                  {screenshot.title && (
                    <h3 className='text-white text-xl font-semibold mb-1'>
                      {screenshot.title}
                    </h3>
                  )}
                  {screenshot.description && (
                    <p className='text-white/90 text-sm'>
                      {screenshot.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Controls */}
        {showControls && screenshots.length > 1 && (
          <>
            <button
              className='absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors'
              onClick={goToPrevious}
            >
              <ChevronLeft className='h-5 w-5' />
            </button>
            <button
              className='absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors'
              onClick={goToNext}
            >
              <ChevronRight className='h-5 w-5' />
            </button>
          </>
        )}
      </GlassCard>

      {/* Indicators */}
      {showIndicators && screenshots.length > 1 && (
        <div className='flex justify-center gap-2 mt-4'>
          {screenshots.map((_, index) => (
            <button
              key={index}
              className={cn(
                'h-2 rounded-full transition-all',
                index === currentIndex
                  ? 'w-8 bg-primary'
                  : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              )}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}