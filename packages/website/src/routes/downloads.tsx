import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui/glass-card'
import { AnimateOnScroll } from '@/components/ui/animation-utils'
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
        description: 'Download Promptliano for your platform. Available for macOS, Windows, Linux, and as a Bun bundle.',
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
    description: 'Server and UI bundle - Recommended for developers',
    version: 'v0.8.0',
    filename: 'promptliano-0.8.0-bun-bundle.zip',
    downloadUrl: 'https://github.com/brandon-schabel/promptliano/releases/download/v0.8.0/promptliano-0.8.0-bun-bundle.zip',
    requirements: ['Bun runtime installed', 'Node.js compatible system'],
    installSteps: [
      'Install Bun: curl -fsSL https://bun.sh/install | bash',
      'Extract the downloaded zip file',
      'cd promptliano-0.8.0-bun-bundle',
      'bun run start'
    ],
    recommended: true
  },
  {
    id: 'macos-arm64',
    name: 'macOS (Apple Silicon)',
    icon: <Apple className='h-8 w-8' />,
    description: 'Native binary for M1, M2, M3 and newer Macs',
    version: 'v0.8.0',
    filename: 'promptliano-0.8.0-macos-arm64.zip',
    downloadUrl: 'https://github.com/brandon-schabel/promptliano/releases/download/v0.8.0/promptliano-0.8.0-macos-arm64.zip',
    requirements: ['macOS 11.0 or later', 'Apple Silicon processor'],
    installSteps: [
      'Extract the downloaded zip file',
      'cd ~/Downloads/promptliano-v0.8.0',
      'Remove quarantine: sudo xattr -r -d com.apple.quarantine ./promptliano',
      'Run: ./promptliano'
    ]
  },
  {
    id: 'windows-x64',
    name: 'Windows x64',
    icon: <MonitorSmartphone className='h-8 w-8' />,
    description: 'Native binary for Windows 10/11',
    version: 'v0.8.0',
    filename: 'promptliano-0.8.0-windows-x64.zip',
    downloadUrl: 'https://github.com/brandon-schabel/promptliano/releases/download/v0.8.0/promptliano-0.8.0-windows-x64.zip',
    requirements: ['Windows 10 or later', '64-bit processor'],
    installSteps: [
      'Extract the downloaded zip file',
      'Open Command Prompt or PowerShell',
      'cd %USERPROFILE%\\Downloads\\promptliano-v0.8.0-windows-x64',
      'Run: .\\promptliano.exe'
    ]
  },
  {
    id: 'linux-x64',
    name: 'Linux x64',
    icon: <Terminal className='h-8 w-8' />,
    description: 'Native binary for Linux distributions',
    version: 'v0.8.0',
    filename: 'promptliano-0.8.0-linux-x64.zip',
    downloadUrl: 'https://github.com/brandon-schabel/promptliano/releases/download/v0.8.0/promptliano-0.8.0-linux-x64.zip',
    requirements: ['Linux kernel 3.10 or later', '64-bit processor'],
    installSteps: [
      'Extract the downloaded zip file',
      'cd ~/Downloads/promptliano-v0.8.0',
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
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>Download Promptliano</h1>
            <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
              Get started with Promptliano on your platform. All downloads include the full server and UI.
            </p>
          </div>
        </AnimateOnScroll>

        {/* Tauri Coming Soon Notice */}
        <AnimateOnScroll>
          <GlassCard className='p-6 mb-8 max-w-4xl mx-auto bg-primary/5 border-primary/20'>
            <div className='flex items-start gap-4'>
              <div className='p-2 rounded-lg bg-primary/10'>
                <MonitorSmartphone className='h-5 w-5 text-primary' />
              </div>
              <div>
                <h3 className='font-semibold mb-1'>Native Desktop Apps Coming Soon!</h3>
                <p className='text-sm text-muted-foreground'>
                  We're working on native Tauri desktop applications for a more integrated experience. 
                  These will include auto-updates, system tray integration, and better OS integration. 
                  For now, the binaries below provide full functionality.
                </p>
              </div>
            </div>
          </GlassCard>
        </AnimateOnScroll>

        {/* Developer Recommendation */}
        <AnimateOnScroll>
          <GlassCard className='p-6 mb-8 max-w-4xl mx-auto bg-green-500/5 border-green-500/20'>
            <div className='flex items-start gap-4'>
              <div className='p-2 rounded-lg bg-green-500/10'>
                <Terminal className='h-5 w-5 text-green-500' />
              </div>
              <div>
                <h3 className='font-semibold mb-2 flex items-center gap-2'>
                  Recommended: Run from Source
                  <span className='text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded'>
                    Best Experience
                  </span>
                </h3>
                <p className='text-sm text-muted-foreground mb-3'>
                  While the downloads below are prepackaged binaries that work out of the box, we recommend 
                  running Promptliano from source code in development mode for the best experience. You'll be able to:
                </p>
                <ul className='text-sm text-muted-foreground space-y-1 mb-3'>
                  <li className='flex items-center gap-2'>
                    <CheckCircle className='h-3 w-3 text-green-500' />
                    Modify any settings and configurations
                  </li>
                  <li className='flex items-center gap-2'>
                    <CheckCircle className='h-3 w-3 text-green-500' />
                    Access the latest features and updates
                  </li>
                  <li className='flex items-center gap-2'>
                    <CheckCircle className='h-3 w-3 text-green-500' />
                    Customize the codebase to your needs
                  </li>
                  <li className='flex items-center gap-2'>
                    <CheckCircle className='h-3 w-3 text-green-500' />
                    Quick setup - only requires Bun installed
                  </li>
                </ul>
                <div className='bg-background/50 rounded-lg p-3 space-y-2'>
                  <p className='text-xs font-medium text-muted-foreground'>Quick Start:</p>
                  <CodeBlock
                    code={`git clone https://github.com/brandon-schabel/promptliano
cd promptliano && bun install
bun run dev`}
                    language='bash'
                    showLineNumbers={false}
                  />
                </div>
                <p className='text-xs text-muted-foreground mt-3'>
                  View full setup instructions in our <a href='https://github.com/brandon-schabel/promptliano' className='text-primary hover:underline'>GitHub README</a>
                </p>
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
                  Promptliano runs on port <code className='text-primary'>3147</code> in development mode 
                  and port <code className='text-primary'>3579</code> in production mode. 
                  The UI is accessible at <code className='text-primary'>http://localhost:3579</code> when running the production bundle.
                </p>
              </div>
            </div>
          </GlassCard>
        </AnimateOnScroll>

        {/* Download Options */}
        <div className='grid gap-6 md:grid-cols-2 mb-12'>
          {downloadOptions.map((option) => (
            <AnimateOnScroll key={option.id}>
              <GlassCard className='p-6 h-full flex flex-col'>
                <div className='flex items-start gap-4 mb-4'>
                  <div className='p-3 rounded-lg bg-primary/10 text-primary'>
                    {option.icon}
                  </div>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2 mb-1'>
                      <h3 className='text-xl font-semibold'>{option.name}</h3>
                      {option.recommended && (
                        <span className='text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded'>
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className='text-sm text-muted-foreground'>{option.description}</p>
                    <p className='text-xs text-muted-foreground mt-1'>Version: {option.version}</p>
                  </div>
                </div>

                {/* Requirements */}
                {option.requirements && (
                  <div className='mb-4'>
                    <h4 className='text-sm font-medium mb-2'>Requirements:</h4>
                    <ul className='space-y-1'>
                      {option.requirements.map((req, idx) => (
                        <li key={idx} className='text-sm text-muted-foreground flex items-center gap-2'>
                          <CheckCircle className='h-3 w-3 text-green-500' />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Download Button */}
                <div className='mt-auto'>
                  <a
                    href={option.downloadUrl}
                    download
                    className='btn btn-primary w-full flex items-center justify-center gap-2'
                  >
                    <Download className='h-4 w-4' />
                    Download {option.filename}
                  </a>
                </div>
              </GlassCard>
            </AnimateOnScroll>
          ))}
        </div>

        {/* Installation Instructions */}
        <AnimateOnScroll>
          <GlassCard className='p-8 max-w-4xl mx-auto'>
            <h2 className='text-2xl font-bold mb-6'>Installation Instructions</h2>
            
            <div className='space-y-8'>
              {downloadOptions.map((option) => (
                <div key={option.id}>
                  <div className='flex items-center gap-3 mb-4'>
                    <div className='p-2 rounded bg-primary/10 text-primary'>
                      {option.icon}
                    </div>
                    <h3 className='text-lg font-semibold'>{option.name}</h3>
                  </div>
                  
                  {option.installSteps && (
                    <div className='space-y-2'>
                      {option.installSteps.map((step, idx) => (
                        <div key={idx} className='flex gap-3'>
                          <span className='text-muted-foreground'>{idx + 1}.</span>
                          <CodeBlock
                            code={step}
                            language='bash'
                            className='flex-1'
                            showLineNumbers={false}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Additional Resources */}
            <div className='mt-8 pt-8 border-t border-border'>
              <h3 className='font-semibold mb-4'>Need Help?</h3>
              <div className='space-y-2'>
                <a
                  href='/docs/getting-started'
                  className='text-primary hover:underline flex items-center gap-2'
                >
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