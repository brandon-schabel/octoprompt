import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../utils'
import type { LucideIcon } from 'lucide-react'
import { Download } from 'lucide-react'
import { CTAButton, CTAButtonOutline } from '../marketing/cta-button'
import { GlassCard } from '../surface/glass-card'

export interface DownloadPlatform {
  name: string
  icon: LucideIcon
  label: string
  description?: string
  url: string
  available?: boolean
  recommended?: boolean
}

interface DownloadButtonProps {
  platforms: DownloadPlatform[]
  className?: string
  showPlatforms?: boolean
  variant?: 'default' | 'compact' | 'dropdown'
  size?: 'sm' | 'md' | 'lg'
  title?: string
  subtitle?: string
  detectedPlatform?: string
  guideUrl?: string
  guideText?: string
  version?: string
  allReleasesUrl?: string
  onPlatformSelect?: (platform: DownloadPlatform) => void
}

export function DownloadButton({
  platforms,
  className,
  showPlatforms = true,
  variant = 'default',
  size = 'md',
  title = 'Download',
  subtitle = 'Choose your platform below',
  detectedPlatform: propDetectedPlatform,
  guideUrl,
  guideText = 'View Installation Guide',
  version,
  allReleasesUrl,
  onPlatformSelect
}: DownloadButtonProps) {
  const [detectedPlatform, setDetectedPlatform] = useState<string>(propDetectedPlatform || platforms[0]?.name || '')

  useEffect(() => {
    if (propDetectedPlatform) {
      setDetectedPlatform(propDetectedPlatform)
      return
    }

    // Auto-detect platform
    const platform = navigator.platform.toLowerCase()
    const userAgent = navigator.userAgent.toLowerCase()

    if (platform.includes('mac') || userAgent.includes('mac')) {
      const isM1 = userAgent.includes('arm') || userAgent.includes('aarch64')
      const macPlatform = platforms.find((p) =>
        isM1
          ? p.name.includes('macos-arm') || p.name.includes('mac-arm')
          : p.name.includes('macos') || p.name.includes('mac')
      )
      if (macPlatform) {
        setDetectedPlatform(macPlatform.name)
      }
    } else if (platform.includes('win') || userAgent.includes('win')) {
      const winPlatform = platforms.find((p) => p.name.includes('win'))
      if (winPlatform) {
        setDetectedPlatform(winPlatform.name)
      }
    } else if (platform.includes('linux') || userAgent.includes('linux')) {
      const linuxPlatform = platforms.find((p) => p.name.includes('linux'))
      if (linuxPlatform) {
        setDetectedPlatform(linuxPlatform.name)
      }
    }
  }, [propDetectedPlatform, platforms])

  const recommendedPlatform = platforms.find((p) => p.name === detectedPlatform) || platforms[0]

  const handlePlatformClick = (platform: DownloadPlatform) => {
    if (onPlatformSelect) {
      onPlatformSelect(platform)
    }
  }

  if (variant === 'dropdown' || variant === 'compact') {
    return (
      <a
        href={recommendedPlatform?.url}
        download
        className={cn('inline-flex items-center gap-2', className)}
        onClick={() => recommendedPlatform && handlePlatformClick(recommendedPlatform)}
      >
        <CTAButton size={size} className='gap-2'>
          <Download className='h-4 w-4' />
          Download {recommendedPlatform?.label}
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
              <h3 className='font-semibold text-lg'>{title}</h3>
              <p className='text-sm text-muted-foreground'>{subtitle}</p>
            </div>
          </div>

          {showPlatforms && platforms.length > 0 && (
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
              {platforms.map((platform) => {
                const Icon = platform.icon
                return (
                  <motion.a
                    key={platform.name}
                    href={platform.url}
                    download
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePlatformClick(platform)}
                    className={cn(
                      'relative overflow-hidden rounded-lg border p-3 text-center transition-colors',
                      platform.available !== false
                        ? 'border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10'
                        : 'border-border bg-muted/50 cursor-not-allowed opacity-50'
                    )}
                  >
                    <div className='flex flex-col items-center gap-2'>
                      <Icon className='h-5 w-5' />
                      <span className='text-xs font-medium'>{platform.label}</span>
                    </div>
                    {platform.name === detectedPlatform && (
                      <span className='absolute top-1 right-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded'>
                        Detected
                      </span>
                    )}
                    {platform.recommended && platform.name !== detectedPlatform && (
                      <span className='absolute top-1 right-1 text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded'>
                        Recommended
                      </span>
                    )}
                  </motion.a>
                )
              })}
            </div>
          )}

          <div className='pt-2 space-y-2'>
            {guideUrl && (
              <CTAButtonOutline href={guideUrl} size='md' className='w-full'>
                {guideText}
              </CTAButtonOutline>
            )}
            <p className='text-xs text-center text-muted-foreground'>
              {version && `All downloads are for ${version}`}
              {version && allReleasesUrl && ' • '}
              {allReleasesUrl && (
                <a href={allReleasesUrl} className='underline'>
                  View all releases
                </a>
              )}
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

export function DownloadButtonCompact(props: Omit<DownloadButtonProps, 'variant' | 'showPlatforms'>) {
  return <DownloadButton {...props} variant='compact' showPlatforms={false} />
}

export function DownloadButtonDropdown(props: Omit<DownloadButtonProps, 'variant' | 'showPlatforms'>) {
  return <DownloadButton {...props} variant='dropdown' showPlatforms={false} />
}
