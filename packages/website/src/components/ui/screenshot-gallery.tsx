import { useState } from 'react'
import { cn } from '@/lib/utils'
import { LazyImage } from '@/components/utils/lazy-image'
import { GlassCard } from './glass-card'
import { AnimateOnScroll } from './animation-utils'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Screenshot {
  src: string
  alt: string
  title?: string
  description?: string
}

interface ScreenshotGalleryProps {
  screenshots: Screenshot[]
  columns?: {
    mobile?: number
    tablet?: number
    desktop?: number
  }
  className?: string
}

export function ScreenshotGallery({
  screenshots,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  className
}: ScreenshotGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const handlePrevious = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < screenshots.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (selectedIndex === null) return

    if (e.key === 'ArrowLeft') handlePrevious()
    if (e.key === 'ArrowRight') handleNext()
    if (e.key === 'Escape') setSelectedIndex(null)
  }

  return (
    <>
      <div
        className={cn(
          'grid gap-4',
          columns.mobile === 1 && 'grid-cols-1',
          columns.tablet === 2 && 'md:grid-cols-2',
          columns.desktop === 3 && 'lg:grid-cols-3',
          columns.desktop === 4 && 'lg:grid-cols-4',
          className
        )}
      >
        {screenshots.map((screenshot, index) => (
          <AnimateOnScroll key={index} delay={index * 0.1}>
            <GlassCard
              className='overflow-hidden p-0 cursor-pointer group hover:scale-[1.02] transition-transform'
              onClick={() => setSelectedIndex(index)}
            >
              <div className='relative'>
                <LazyImage
                  src={screenshot.src.startsWith('/') ? screenshot.src : `/assets/screenshots/${screenshot.src}`}
                  alt={screenshot.alt}
                  className='w-full h-full object-cover'
                />
                <div className='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity'>
                  <div className='absolute bottom-0 left-0 right-0 p-4 text-white'>
                    {screenshot.title && <h4 className='font-semibold mb-1'>{screenshot.title}</h4>}
                    {screenshot.description && <p className='text-sm opacity-90'>{screenshot.description}</p>}
                  </div>
                </div>
              </div>
            </GlassCard>
          </AnimateOnScroll>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedIndex !== null && (
        <div
          className='fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4'
          onClick={() => setSelectedIndex(null)}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <button
            className='absolute top-4 right-4 text-white/80 hover:text-white p-2'
            onClick={() => setSelectedIndex(null)}
          >
            <X className='h-6 w-6' />
          </button>

          {selectedIndex > 0 && (
            <button
              className='absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2'
              onClick={(e) => {
                e.stopPropagation()
                handlePrevious()
              }}
            >
              <ChevronLeft className='h-8 w-8' />
            </button>
          )}

          {selectedIndex < screenshots.length - 1 && (
            <button
              className='absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2'
              onClick={(e) => {
                e.stopPropagation()
                handleNext()
              }}
            >
              <ChevronRight className='h-8 w-8' />
            </button>
          )}

          <div className='max-w-6xl max-h-[90vh] w-full' onClick={(e) => e.stopPropagation()}>
            <LazyImage
              src={
                screenshots[selectedIndex].src.startsWith('/')
                  ? screenshots[selectedIndex].src
                  : `/assets/screenshots/${screenshots[selectedIndex].src}`
              }
              alt={screenshots[selectedIndex].alt}
              className='w-full h-full object-contain'
              priority
            />
            {screenshots[selectedIndex].title && (
              <div className='mt-4 text-white text-center'>
                <h3 className='text-xl font-semibold'>{screenshots[selectedIndex].title}</h3>
                {screenshots[selectedIndex].description && (
                  <p className='text-white/80 mt-2'>{screenshots[selectedIndex].description}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
