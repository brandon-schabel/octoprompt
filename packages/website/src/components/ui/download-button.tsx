// Website-specific download button with platform data
import { DownloadButton as UIDownloadButton, type DownloadPlatform } from '@promptliano/ui'
import { Apple, Terminal, MonitorSmartphone, Package } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const platforms: DownloadPlatform[] = [
  {
    name: 'bun',
    icon: Package as any,
    label: 'Bun Bundle',
    description: 'Server and UI Bundle - Requires Bun',
    url: 'https://github.com/brandon-schabel/promptliano/releases/download/v0.9.0/promptliano-0.9.0-bun-bundle.zip',
    available: true,
    recommended: true
  },
  {
    name: 'macos-arm64',
    icon: Apple as any,
    label: 'macOS (M1+)',
    description: 'Native macOS Binary for Apple Silicon',
    url: 'https://github.com/brandon-schabel/promptliano/releases/download/v0.9.0/promptliano-0.9.0-macos-arm64.zip',
    available: true
  },
  {
    name: 'windows-x64',
    icon: MonitorSmartphone as any,
    label: 'Windows x64',
    description: 'Native Windows Binary',
    url: 'https://github.com/brandon-schabel/promptliano/releases/download/v0.9.0/promptliano-0.9.0-windows-x64.zip',
    available: true
  },
  {
    name: 'linux-x64',
    icon: Terminal as any,
    label: 'Linux x64',
    description: 'Native Linux Binary',
    url: 'https://github.com/brandon-schabel/promptliano/releases/download/v0.9.0/promptliano-0.9.0-linux-x64.zip',
    available: true
  }
]

interface DownloadButtonProps {
  className?: string
  showPlatforms?: boolean
  variant?: 'default' | 'compact' | 'dropdown'
  size?: 'sm' | 'md' | 'lg'
}

export function DownloadButton(props?: DownloadButtonProps) {
  return (
    <UIDownloadButton
      {...(props || {})}
      platforms={platforms}
      title='Download Promptliano'
      subtitle='Choose your platform below'
      guideUrl='/docs/download-installation'
      guideText='View Installation Guide'
      version='v0.9.0'
      allReleasesUrl='https://github.com/brandon-schabel/promptliano/releases'
    />
  )
}

export function DownloadButtonCompact(props: Omit<DownloadButtonProps, 'variant' | 'showPlatforms'>) {
  return <DownloadButton {...props} variant='compact' showPlatforms={false} />
}
