import { useState, useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import { cn } from '@/lib/utils'

interface LazyImageProps {
  src: string
  srcSet?: string
  sizes?: string
  alt: string
  width?: number
  height?: number
  className?: string
  placeholderSrc?: string
  loading?: 'lazy' | 'eager'
  priority?: boolean
  onLoad?: () => void
  onError?: () => void
}

export function LazyImage({
  src,
  srcSet,
  sizes,
  alt,
  width,
  height,
  className,
  placeholderSrc,
  loading = 'lazy',
  priority = false,
  onLoad,
  onError
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.01,
    rootMargin: '50px'
  })

  const shouldLoad = priority || inView || loading === 'eager'

  useEffect(() => {
    if (!shouldLoad || !imgRef.current) return

    const img = imgRef.current

    const handleLoad = () => {
      setIsLoaded(true)
      onLoad?.()
    }

    const handleError = () => {
      setHasError(true)
      onError?.()
    }

    if (img.complete && img.naturalWidth) {
      handleLoad()
    } else {
      img.addEventListener('load', handleLoad)
      img.addEventListener('error', handleError)
    }

    return () => {
      img.removeEventListener('load', handleLoad)
      img.removeEventListener('error', handleError)
    }
  }, [shouldLoad, onLoad, onError])

  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)} style={{ width, height }}>
      {placeholderSrc && !isLoaded && (
        <img
          src={placeholderSrc}
          alt=''
          className='absolute inset-0 w-full h-full object-cover filter blur-sm scale-110'
          aria-hidden='true'
        />
      )}

      {shouldLoad && (
        <img
          ref={imgRef}
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          className={cn(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
            hasError && 'hidden'
          )}
        />
      )}

      {hasError && (
        <div className='absolute inset-0 flex items-center justify-center bg-muted'>
          <span className='text-muted-foreground text-sm'>Failed to load image</span>
        </div>
      )}
    </div>
  )
}

interface PictureProps extends Omit<LazyImageProps, 'src' | 'srcSet'> {
  sources: Array<{
    srcSet: string
    type: string
    media?: string
  }>
  fallbackSrc: string
}

export function LazyPicture({
  sources,
  fallbackSrc,
  alt,
  width,
  height,
  className,
  placeholderSrc,
  loading = 'lazy',
  priority = false,
  onLoad,
  onError
}: PictureProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.01,
    rootMargin: '50px'
  })

  const shouldLoad = priority || inView || loading === 'eager'

  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)} style={{ width, height }}>
      {placeholderSrc && !isLoaded && (
        <img
          src={placeholderSrc}
          alt=''
          className='absolute inset-0 w-full h-full object-cover filter blur-sm scale-110'
          aria-hidden='true'
        />
      )}

      {shouldLoad && (
        <picture>
          {sources.map((source, index) => (
            <source key={index} srcSet={source.srcSet} type={source.type} media={source.media} />
          ))}
          <img
            src={fallbackSrc}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            onLoad={() => {
              setIsLoaded(true)
              onLoad?.()
            }}
            onError={onError}
            className={cn('transition-opacity duration-300', isLoaded ? 'opacity-100' : 'opacity-0')}
          />
        </picture>
      )}
    </div>
  )
}
