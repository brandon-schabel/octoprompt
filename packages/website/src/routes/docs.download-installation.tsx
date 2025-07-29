import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui/glass-card'
import { CodeBlock } from '@/components/docs'
import { FeatureScreenshot, DownloadButton } from '@/components/ui'
import { AlertCircle, CheckCircle, Terminal, Package } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const Route = createFileRoute('/docs/download-installation')({
  loader: () => {
    return {
      meta: {
        title: 'Download & Installation - Promptliano Documentation',
        description:
          'Download and install Promptliano on your platform. Get started in minutes with our prebuilt binaries.',
        keywords: ['download', 'installation', 'setup', 'binary', 'bun', 'macos', 'windows', 'linux']
      } as SeoMetadata
    }
  },
  component: DownloadInstallationPage
})

function DownloadInstallationPage() {
  return (
    <div className='space-y-8'>
      <div>
        <h1 className='text-4xl font-bold mb-4'>Download & Installation</h1>
        <p className='text-xl text-muted-foreground'>
          Get Promptliano running on your machine in minutes. Choose from our prebuilt binaries or the Bun bundle.
        </p>
      </div>

      {/* Quick Download Section */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Quick Download</h2>
        <DownloadButton variant='dropdown' size='lg' />
        <p className='text-muted-foreground'>
          The download button above will automatically detect your platform and recommend the best option.
        </p>
      </section>

      {/* Prerequisites */}
      <GlassCard className='p-8'>
        <h2 className='text-2xl font-semibold mb-4'>Prerequisites</h2>
        <div className='space-y-4'>
          <div className='flex items-start gap-3'>
            <Package className='h-5 w-5 text-primary mt-0.5' />
            <div>
              <h3 className='font-medium mb-1'>For Bun Bundle (Recommended)</h3>
              <p className='text-sm text-muted-foreground'>Bun runtime installed. If you don't have it:</p>
              <div className='mt-2 space-y-2'>
                <CodeBlock
                  code='# Install with npm
npm install -g bun

# Or install with curl (Mac/Linux)
curl -fsSL https://bun.sh/install | bash

# Or install with PowerShell (Windows)
powershell -c "irm bun.sh/install.ps1 | iex"'
                  language='bash'
                />
              </div>
            </div>
          </div>
          <div className='flex items-start gap-3'>
            <Terminal className='h-5 w-5 text-primary mt-0.5' />
            <div>
              <h3 className='font-medium mb-1'>For Native Binaries</h3>
              <p className='text-sm text-muted-foreground'>
                No prerequisites! The binaries are self-contained and ready to run.
              </p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Platform-Specific Instructions */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Platform-Specific Instructions</h2>

        <Tabs defaultValue='bun' className='w-full'>
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='bun'>Bun Bundle</TabsTrigger>
            <TabsTrigger value='macos'>macOS</TabsTrigger>
            <TabsTrigger value='windows'>Windows</TabsTrigger>
            <TabsTrigger value='linux'>Linux</TabsTrigger>
          </TabsList>

          <TabsContent value='bun' className='space-y-4'>
            <GlassCard className='p-6'>
              <h3 className='text-xl font-semibold mb-4'>Bun Bundle Installation</h3>
              <p className='text-muted-foreground mb-4'>
                The Bun bundle includes both server and UI. This is the recommended option if you have Bun installed.
              </p>

              <div className='space-y-4'>
                <div>
                  <h4 className='font-medium mb-2'>1. Download and extract</h4>
                  <CodeBlock
                    code='# Download the bundle
curl -L https://github.com/brandon-schabel/promptliano/releases/download/v0.8.1/promptliano-0.8.1-bun-bundle.zip -o promptliano.zip

# Extract the zip file
unzip promptliano.zip

# Navigate to the extracted folder
cd promptliano-0.8.1-bun-bundle'
                    language='bash'
                  />
                </div>

                <div>
                  <h4 className='font-medium mb-2'>2. Start Promptliano</h4>
                  <CodeBlock code='bun run start' language='bash' />
                </div>

                <div>
                  <h4 className='font-medium mb-2'>3. Open in your browser</h4>
                  <p className='text-sm text-muted-foreground'>
                    Navigate to{' '}
                    <a href='http://localhost:3579' className='text-primary underline'>
                      http://localhost:3579
                    </a>
                  </p>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value='macos' className='space-y-4'>
            <GlassCard className='p-6'>
              <h3 className='text-xl font-semibold mb-4'>macOS Installation</h3>

              <div className='bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4'>
                <div className='flex items-start gap-2'>
                  <AlertCircle className='h-5 w-5 text-yellow-500 mt-0.5' />
                  <div>
                    <p className='font-medium'>Important: Quarantine Removal Required</p>
                    <p className='text-sm text-muted-foreground mt-1'>
                      macOS will quarantine the binary since it's not code-signed. You'll need to remove the quarantine
                      flag.
                    </p>
                  </div>
                </div>
              </div>

              <div className='space-y-4'>
                <div>
                  <h4 className='font-medium mb-2'>1. Download and extract</h4>
                  <CodeBlock
                    code='# Download for Apple Silicon (M1 and newer)
curl -L https://github.com/brandon-schabel/promptliano/releases/download/v0.8.1/promptliano-0.8.1-macos-arm64.zip -o promptliano.zip

# Extract the zip file
unzip promptliano.zip

# Navigate to the extracted folder
cd promptliano-0.8.1-macos-arm64'
                    language='bash'
                  />
                </div>

                <div>
                  <h4 className='font-medium mb-2'>2. Remove quarantine flag</h4>
                  <CodeBlock code='sudo xattr -r -d com.apple.quarantine ./promptliano' language='bash' />
                </div>

                <div>
                  <h4 className='font-medium mb-2'>3. Make executable and run</h4>
                  <CodeBlock
                    code='# Make the binary executable
chmod +x ./promptliano

# Run Promptliano
./promptliano'
                    language='bash'
                  />
                </div>

                <div>
                  <h4 className='font-medium mb-2'>4. Open in your browser</h4>
                  <p className='text-sm text-muted-foreground'>
                    Navigate to{' '}
                    <a href='http://localhost:3579' className='text-primary underline'>
                      http://localhost:3579
                    </a>
                  </p>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value='windows' className='space-y-4'>
            <GlassCard className='p-6'>
              <h3 className='text-xl font-semibold mb-4'>Windows Installation</h3>

              <div className='space-y-4'>
                <div>
                  <h4 className='font-medium mb-2'>1. Download and extract</h4>
                  <p className='text-sm text-muted-foreground mb-2'>
                    Download the Windows binary and extract it to your desired location.
                  </p>
                  <CodeBlock
                    code='# Using PowerShell
Invoke-WebRequest -Uri "https://github.com/brandon-schabel/promptliano/releases/download/v0.8.1/promptliano-0.8.1-windows-x64.zip" -OutFile "promptliano.zip"

# Extract the zip file
Expand-Archive -Path "promptliano.zip" -DestinationPath "."

# Navigate to the extracted folder
cd promptliano-0.8.1-windows-x64'
                    language='powershell'
                  />
                </div>

                <div>
                  <h4 className='font-medium mb-2'>2. Run Promptliano</h4>
                  <CodeBlock
                    code='# Run the executable
.\promptliano.exe

# Or simply double-click promptliano.exe in File Explorer'
                    language='batch'
                  />
                </div>

                <div className='bg-blue-500/10 border border-blue-500/20 rounded-lg p-4'>
                  <p className='text-sm'>
                    <span className='font-medium'>Windows Defender Note:</span> You may need to click "More info" and
                    then "Run anyway" if Windows Defender SmartScreen appears.
                  </p>
                </div>

                <div>
                  <h4 className='font-medium mb-2'>3. Open in your browser</h4>
                  <p className='text-sm text-muted-foreground'>
                    Navigate to{' '}
                    <a href='http://localhost:3579' className='text-primary underline'>
                      http://localhost:3579
                    </a>
                  </p>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value='linux' className='space-y-4'>
            <GlassCard className='p-6'>
              <h3 className='text-xl font-semibold mb-4'>Linux Installation</h3>

              <div className='space-y-4'>
                <div>
                  <h4 className='font-medium mb-2'>1. Download and extract</h4>
                  <CodeBlock
                    code='# Download the Linux binary
wget https://github.com/brandon-schabel/promptliano/releases/download/v0.8.1/promptliano-0.8.1-linux-x64.zip

# Extract the zip file
unzip promptliano-0.8.1-linux-x64.zip

# Navigate to the extracted folder
cd promptliano-0.8.1-linux-x64'
                    language='bash'
                  />
                </div>

                <div>
                  <h4 className='font-medium mb-2'>2. Make executable and run</h4>
                  <CodeBlock
                    code='# Make the binary executable
chmod +x ./promptliano

# Run Promptliano
./promptliano'
                    language='bash'
                  />
                </div>

                <div>
                  <h4 className='font-medium mb-2'>3. Open in your browser</h4>
                  <p className='text-sm text-muted-foreground'>
                    Navigate to{' '}
                    <a href='http://localhost:3579' className='text-primary underline'>
                      http://localhost:3579
                    </a>
                  </p>
                </div>

                <div className='bg-green-500/10 border border-green-500/20 rounded-lg p-4'>
                  <p className='text-sm'>
                    <span className='font-medium'>Tip:</span> You can add Promptliano to your PATH for easier access
                    from anywhere.
                  </p>
                </div>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </section>

      {/* Verification Steps */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Verify Installation</h2>

        <GlassCard className='p-6'>
          <div className='space-y-4'>
            <div className='flex items-start gap-3'>
              <CheckCircle className='h-5 w-5 text-green-500 mt-0.5' />
              <div>
                <h4 className='font-medium'>Server is running</h4>
                <p className='text-sm text-muted-foreground'>
                  You should see output like:{' '}
                  <code className='px-1.5 py-0.5 bg-muted rounded text-xs'>
                    Server running at http://localhost:3579
                  </code>
                </p>
              </div>
            </div>

            <div className='flex items-start gap-3'>
              <CheckCircle className='h-5 w-5 text-green-500 mt-0.5' />
              <div>
                <h4 className='font-medium'>UI is accessible</h4>
                <p className='text-sm text-muted-foreground'>
                  Open your browser and navigate to{' '}
                  <a href='http://localhost:3579' className='text-primary underline'>
                    http://localhost:3579
                  </a>
                </p>
              </div>
            </div>

            <div className='flex items-start gap-3'>
              <CheckCircle className='h-5 w-5 text-green-500 mt-0.5' />
              <div>
                <h4 className='font-medium'>Create your first project</h4>
                <p className='text-sm text-muted-foreground'>
                  You should see the project creation dialog when you first open Promptliano.
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

        <FeatureScreenshot
          src='/assets/screenshots/project-selector-dialog.webp'
          alt='Project Selector Dialog'
          title='Welcome to Promptliano!'
          description="This is what you'll see when you first open Promptliano - ready to create your first project."
          layout='centered'
        />
      </section>

      {/* Next Steps */}
      <GlassCard className='p-8 bg-primary/5 border-primary/20'>
        <h3 className='text-xl font-semibold mb-3'>Installation Complete! 🎉</h3>
        <p className='mb-4 text-muted-foreground'>Now that you have Promptliano running, here's what to do next:</p>
        <ul className='space-y-2'>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/getting-started' className='text-primary hover:underline'>
              Continue to Getting Started
            </a>
            <span className='text-muted-foreground'>to create your first project</span>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/integrations' className='text-primary hover:underline'>
              Set up MCP integration
            </a>
            <span className='text-muted-foreground'>with your AI editor</span>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='/docs/ui-overview' className='text-primary hover:underline'>
              Explore the UI
            </a>
            <span className='text-muted-foreground'>with our visual tour</span>
          </li>
        </ul>
      </GlassCard>
    </div>
  )
}
