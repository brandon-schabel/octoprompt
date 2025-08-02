import { lazy, Suspense, ComponentType } from 'react'
import { useInView } from 'react-intersection-observer'
import { cn } from '@/lib/utils'

interface LazyLoadProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  className?: string
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
}

export function LazyLoad({
  children,
  fallback,
  className,
  threshold = 0.1,
  rootMargin = '50px',
  triggerOnce = true
}: LazyLoadProps) {
  const { ref, inView } = useInView({
    threshold,
    rootMargin,
    triggerOnce
  })

  return (
    <div ref={ref} className={className}>
      {inView ? children : fallback || <LazyLoadFallback />}
    </div>
  )
}

function LazyLoadFallback() {
  return (
    <div className='animate-pulse'>
      <div className='h-32 bg-muted rounded-lg' />
    </div>
  )
}

interface LazyComponentProps<T> {
  loader: () => Promise<{ default: ComponentType<T> }>
  props?: T
  fallback?: React.ReactNode
  className?: string
  preload?: boolean
}

export function LazyComponent<T extends {} = {}>({
  loader,
  props,
  fallback,
  className,
  preload = false
}: LazyComponentProps<T>) {
  const Component = lazy(loader)

  const { ref, inView } = useInView({
    threshold: 0.1,
    rootMargin: '100px',
    triggerOnce: true,
    skip: preload
  })

  const shouldRender = preload || inView

  return (
    <div ref={ref} className={className}>
      {shouldRender ? (
        <Suspense fallback={fallback || <LazyLoadFallback />}>
          <Component {...(props as T)} />
        </Suspense>
      ) : (
        fallback || <LazyLoadFallback />
      )}
    </div>
  )
}

// Utility to create lazy loaded routes
export function createLazyRoute<T extends {} = {}>(
  loader: () => Promise<{ default: ComponentType<T> }>,
  options?: {
    fallback?: React.ReactNode
    preload?: boolean
  }
) {
  return (props: T) => (
    <LazyComponent loader={loader} props={props} fallback={options?.fallback} preload={options?.preload} />
  )
}

// Intersection Observer hook for custom lazy loading
export function useLazyLoad(options?: IntersectionObserverInit & { triggerOnce?: boolean }) {
  const { ref, inView, entry } = useInView({
    threshold: 0.1,
    rootMargin: '50px',
    triggerOnce: true,
    ...options
  })

  return { ref, isVisible: inView, entry }
}

// Preload component utility
export function preloadComponent<T extends {} = {}>(loader: () => Promise<{ default: ComponentType<T> }>) {
  loader()
}

// Progressive image component
export function ProgressiveImage({
  src,
  placeholder,
  alt,
  className,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { placeholder?: string }) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.01,
    rootMargin: '50px'
  })

  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)}>
      {placeholder && (
        <img
          src={placeholder}
          alt=''
          className='absolute inset-0 w-full h-full object-cover filter blur-lg scale-110'
          aria-hidden='true'
        />
      )}
      {inView && (
        <img
          src={src}
          alt={alt}
          className={cn('relative z-10 w-full h-full object-cover', className)}
          loading='lazy'
          {...props}
        />
      )}
    </div>
  )
}
