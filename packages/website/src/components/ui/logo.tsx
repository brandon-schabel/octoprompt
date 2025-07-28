import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showGlow?: boolean
}

const sizeMap = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24'
}

export function Logo({ size = 'lg', className, showGlow = true }: LogoProps) {
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      {showGlow && (
        <div className='absolute inset-0 blur-xl bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full' />
      )}
      <img
        src='/icon-512.png'
        alt='Promptliano Logo'
        className={cn(
          sizeMap[size],
          'relative z-10 drop-shadow-lg',
          'transition-transform duration-300 hover:scale-105'
        )}
      />
    </div>
  )
}