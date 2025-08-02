import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Download, Apple, Terminal, MonitorSmartphone, Package, ChevronDown } from 'lucide-react'
import { CTAButton, CTAButtonOutline } from './cta-button'
import { GlassCard } from './glass-card'
// Dropdown menu import removed - not available in UI components

interface Platform {
  name: string
  icon: React.ReactNode
  label: string
  description: string
  url: string
  available: boolean
  recommended?: boolean
}

const platforms: Platform[] = [
  {
    name: 'bun',
    icon: <Package className='h-5 w-5' />,
    label: 'Bun Bundle',
    description: 'Server and UI Bundle - Requires Bun',
    url: 'https://github.com/brandon-schabel/promptliano/releases/download/v0.8.3/promptliano-0.8.3-bun-bundle.zip',
    available: true,
    recommended: true
  },
  {
    name: 'macos-arm64',
    icon: <Apple className='h-5 w-5' />,
    label: 'macOS (M1+)',
    description: 'Native macOS Binary for Apple Silicon',
    url: 'https://github.com/brandon-schabel/promptliano/releases/download/v0.8.3/promptliano-0.8.3-macos-arm64.zip',
    available: true
  },
  {
    name: 'windows-x64',
    icon: <MonitorSmartphone className='h-5 w-5' />,
    label: 'Windows x64',
    description: 'Native Windows Binary',
    url: 'https://github.com/brandon-schabel/promptliano/releases/download/v0.8.3/promptliano-0.8.3-windows-x64.zip',
    available: true
  },
  {
    name: 'linux-x64',
    icon: <Terminal className='h-5 w-5' />,
    label: 'Linux x64',
    description: 'Native Linux Binary',
    url: 'https://github.com/brandon-schabel/promptliano/releases/download/v0.8.3/promptliano-0.8.3-linux-x64.zip',
    available: true
  }
]

interface DownloadButtonProps {
  className?: string
  showPlatforms?: boolean
  variant?: 'default' | 'compact' | 'dropdown'
  size?: 'sm' | 'md' | 'lg'
}

export function DownloadButton({
  className,
  showPlatforms = true,
  variant = 'default',
  size = 'md'
}: DownloadButtonProps) {
  const [detectedPlatform, setDetectedPlatform] = useState<string>('bun')

  useEffect(() => {
    const platform = navigator.platform.toLowerCase()
    const userAgent = navigator.userAgent.toLowerCase()

    if (platform.includes('mac') || userAgent.includes('mac')) {
      const isM1 = userAgent.includes('arm') || userAgent.includes('aarch64')
      setDetectedPlatform(isM1 ? 'macos-arm64' : 'bun')
    } else if (platform.includes('win') || userAgent.includes('win')) {
      setDetectedPlatform('windows-x64')
    } else if (platform.includes('linux') || userAgent.includes('linux')) {
      setDetectedPlatform('linux-x64')
    }
  }, [])

  const recommendedPlatform = platforms.find((p) => p.name === detectedPlatform) || platforms[0]

  if (variant === 'dropdown') {
    return (
      <a href={recommendedPlatform.url} download className={cn('inline-flex items-center gap-2', className)}>
        <CTAButton size={size} className='gap-2'>
          <Download className='h-4 w-4' />
          Download {recommendedPlatform.label}
        </CTAButton>
      </a>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <GlassCard className='p-6 backdrop-blur-xl bg-background/50'>
        <div className='space-y-4'>
          <div className='flex items-center gap-3'>
            <div className='h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center'>
              <Download className='h-5 w-5 text-primary' />
            </div>
            <div>
              <h3 className='font-semibold text-lg'>Download Promptliano</h3>
              <p className='text-sm text-muted-foreground'>Choose your platform below</p>
            </div>
          </div>

          {showPlatforms && (
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
              {platforms.map((platform) => (
                <motion.a
                  key={platform.name}
                  href={platform.url}
                  download
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'relative overflow-hidden rounded-lg border p-3 text-center transition-colors',
                    'border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10'
                  )}
                >
                  <div className='flex flex-col items-center gap-2'>
                    {platform.icon}
                    <span className='text-xs font-medium'>{platform.label}</span>
                  </div>
                  {platform.name === detectedPlatform && (
                    <span className='absolute top-1 right-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded'>
                      Detected
                    </span>
                  )}
                </motion.a>
              ))}
            </div>
          )}

          <div className='pt-2 space-y-2'>
            <CTAButtonOutline href='/docs/download-installation' size='md' className='w-full'>
              View Installation Guide
            </CTAButtonOutline>
            <p className='text-xs text-center text-muted-foreground'>
              All downloads are for v0.8.3 •{' '}
              <a href='https://github.com/brandon-schabel/promptliano/releases' className='underline'>
                View all releases
              </a>
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

export function DownloadButtonCompact({ className }: DownloadButtonProps) {
  return <DownloadButton variant='dropdown' size='sm' className={className} showPlatforms={false} />
}
