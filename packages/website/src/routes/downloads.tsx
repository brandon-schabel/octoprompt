import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui'
import { AnimateOnScroll } from '@/components/ui'
import { CodeBlock } from '@/components/ui/code-terminal'
import {
  Download,
  Package,
  Apple,
  MonitorSmartphone,
  Terminal,
  ExternalLink,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

export const Route = createFileRoute('/downloads')({
  loader: () => {
    return {
      meta: {
        title: 'Downloads - Promptliano',
        description:
          'Download Promptliano for your platform. Available for macOS, Windows, Linux, and as a Bun bundle.',
        keywords: ['download', 'install', 'promptliano', 'macos', 'windows', 'linux', 'bun']
      } as SeoMetadata
    }
  },
  component: DownloadsPage
})

interface DownloadOption {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  version: string
  filename: string
  downloadUrl: string
  size?: string
  requirements?: string[]
  installSteps?: string[]
  recommended?: boolean
}

const downloadOptions: DownloadOption[] = [
  {
    id: 'bun-bundle',
    name: 'Bun Bundle',
    icon: <Package className='h-8 w-8' />,
    description: 'Server and UI bundle for Bun runtime',
    version: 'v0.9.2',
    filename: 'promptliano-0.9.2-bun-bundle.zip',
    downloadUrl:
      'https://github.com/brandon-schabel/promptliano/releases/download/v0.9.2/promptliano-0.9.2-bun-bundle.zip',
    requirements: ['Bun runtime installed', 'Node.js compatible system'],
    installSteps: [
      'Install Bun: curl -fsSL https://bun.sh/install | bash',
      'Extract the downloaded zip file',
      'cd promptliano-0.9.2-bun-bundle',
      'bun run start'
    ]
  },
  {
    id: 'macos-arm64',
    name: 'macOS (Apple Silicon)',
    icon: <Apple className='h-8 w-8' />,
    description: 'Native binary for M1, M2, M3 and newer Macs',
    version: 'v0.9.2',
    filename: 'promptliano-0.9.2-macos-arm64.zip',
    downloadUrl:
      'https://github.com/brandon-schabel/promptliano/releases/download/v0.9.2/promptliano-0.9.2-macos-arm64.zip',
    requirements: ['macOS 11.0 or later', 'Apple Silicon processor'],
    installSteps: [
      'Extract the downloaded zip file',
      'cd ~/Downloads/promptliano-v0.9.2',
      'Remove quarantine: sudo xattr -r -d com.apple.quarantine ./promptliano',
      'Run: ./promptliano'
    ]
  },
  {
    id: 'windows-x64',
    name: 'Windows x64',
    icon: <MonitorSmartphone className='h-8 w-8' />,
    description: 'Native binary for Windows 10/11',
    version: 'v0.9.2',
    filename: 'promptliano-0.9.2-windows-x64.zip',
    downloadUrl:
      'https://github.com/brandon-schabel/promptliano/releases/download/v0.9.2/promptliano-0.9.2-windows-x64.zip',
    requirements: ['Windows 10 or later', '64-bit processor'],
    installSteps: [
      'Extract the downloaded zip file',
      'Open Command Prompt or PowerShell',
      'cd %USERPROFILE%\\Downloads\\promptliano-v0.8.1-windows-x64',
      'Run: .\\promptliano.exe'
    ]
  },
  {
    id: 'linux-x64',
    name: 'Linux x64',
    icon: <Terminal className='h-8 w-8' />,
    description: 'Native binary for Linux distributions',
    version: 'v0.9.2',
    filename: 'promptliano-0.9.2-linux-x64.zip',
    downloadUrl:
      'https://github.com/brandon-schabel/promptliano/releases/download/v0.9.2/promptliano-0.9.2-linux-x64.zip',
    requirements: ['Linux kernel 3.10 or later', '64-bit processor'],
    installSteps: [
      'Extract the downloaded zip file',
      'cd ~/Downloads/promptliano-v0.9.2',
      'Make executable: chmod +x ./promptliano',
      'Run: ./promptliano'
    ]
  }
]

function DownloadsPage() {
  return (
    <div className='min-h-screen py-20'>
      <div className='container mx-auto px-4'>
        {/* Header */}
        <AnimateOnScroll>
          <div className='text-center mb-12'>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>Install Promptliano</h1>
            <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
              Get started with Promptliano in seconds with our one-command installer, or download platform-specific
              binaries.
            </p>
          </div>
        </AnimateOnScroll>

        {/* Quick Install Section */}
        <AnimateOnScroll>
          <GlassCard className='p-8 mb-12 max-w-4xl mx-auto bg-green-500/5 border-green-500/20'>
            <div className='flex items-start gap-4'>
              <div className='p-3 rounded-lg bg-green-500/10'>
                <Terminal className='h-6 w-6 text-green-500' />
              </div>
              <div className='flex-1'>
                <h2 className='text-2xl font-semibold mb-3 flex items-center gap-3'>
                  Quick Install
                  <span className='text-sm bg-green-500/10 text-green-500 px-3 py-1 rounded-full'>Recommended</span>
                </h2>
                <p className='text-muted-foreground mb-4'>
                  The fastest way to get started. This command will download, install, and configure everything for you:
                </p>
                <CodeBlock code='npx promptliano@latest' language='bash' showLineNumbers={false} className='text-lg' />
                <div className='mt-4 grid md:grid-cols-2 gap-3'>
                  <div className='flex items-start gap-2'>
                    <CheckCircle className='h-4 w-4 text-green-500 mt-0.5 flex-shrink-0' />
                    <div className='text-sm text-muted-foreground'>
                      <span className='font-medium'>Automatic Setup</span>
                      <p className='text-xs'>Downloads and installs Promptliano</p>
                    </div>
                  </div>
                  <div className='flex items-start gap-2'>
                    <CheckCircle className='h-4 w-4 text-green-500 mt-0.5 flex-shrink-0' />
                    <div className='text-sm text-muted-foreground'>
                      <span className='font-medium'>MCP Configuration</span>
                      <p className='text-xs'>Sets up AI editor integration</p>
                    </div>
                  </div>
                  <div className='flex items-start gap-2'>
                    <CheckCircle className='h-4 w-4 text-green-500 mt-0.5 flex-shrink-0' />
                    <div className='text-sm text-muted-foreground'>
                      <span className='font-medium'>Always Latest Version</span>
                      <p className='text-xs'>Uses @latest for newest features</p>
                    </div>
                  </div>
                  <div className='flex items-start gap-2'>
                    <CheckCircle className='h-4 w-4 text-green-500 mt-0.5 flex-shrink-0' />
                    <div className='text-sm text-muted-foreground'>
                      <span className='font-medium'>Cross-Platform</span>
                      <p className='text-xs'>Works on macOS, Windows, Linux</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </AnimateOnScroll>


        {/* Quick Start Info */}
        <AnimateOnScroll>
          <GlassCard className='p-6 mb-12 max-w-4xl mx-auto'>
            <div className='flex items-start gap-4'>
              <AlertCircle className='h-5 w-5 text-yellow-500 mt-0.5' />
              <div>
                <h3 className='font-semibold mb-2'>Important: Server Ports</h3>
                <p className='text-sm text-muted-foreground'>
                  Promptliano runs on port <code className='text-primary'>3147</code> in development mode and port{' '}
                  <code className='text-primary'>3579</code> in production mode. The UI is accessible at{' '}
                  <code className='text-primary'>http://localhost:3579</code> when running the production bundle.
                </p>
              </div>
            </div>
          </GlassCard>
        </AnimateOnScroll>

        {/* Additional Resources */}
        <AnimateOnScroll>
          <GlassCard className='p-8 max-w-4xl mx-auto'>
            <h2 className='text-2xl font-bold mb-6'>Need More Options?</h2>
            <div className='space-y-4'>
              <p className='text-muted-foreground'>
                Looking for platform-specific binaries or manual installation options?
              </p>
              <div className='space-y-2'>
                <a href='/docs/download-installation' className='text-primary hover:underline flex items-center gap-2'>
                  View Manual Installation Guide
                </a>
                <a href='/docs/getting-started' className='text-primary hover:underline flex items-center gap-2'>
                  Read the Getting Started Guide
                </a>
                <a
                  href='https://github.com/brandon-schabel/promptliano/releases'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary hover:underline flex items-center gap-2'
                >
                  View all releases on GitHub
                  <ExternalLink className='h-3 w-3' />
                </a>
                <a
                  href='https://discord.gg/Z2nDnVQKKm'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary hover:underline flex items-center gap-2'
                >
                  Join our Discord for support
                  <ExternalLink className='h-3 w-3' />
                </a>
              </div>
            </div>
          </GlassCard>
        </AnimateOnScroll>
      </div>
    </div>
  )
}
