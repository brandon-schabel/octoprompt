import { createFileRoute } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui'
import { CodeBlock } from '@/components/docs'
import { FeatureScreenshot, DownloadButton } from '@/components/ui'
import { AlertCircle, CheckCircle, Terminal, Package, Settings, Shield, HelpCircle } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'

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
          Get Promptliano running on your machine in minutes with our one-command installer.
        </p>
      </div>

      {/* Quick Install Section */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Quick Install (Recommended)</h2>
        <GlassCard className='p-8 bg-green-500/5 border-green-500/20'>
          <div className='flex items-start gap-4'>
            <div className='p-3 rounded-lg bg-green-500/10'>
              <Terminal className='h-6 w-6 text-green-500' />
            </div>
            <div className='flex-1'>
              <h3 className='text-xl font-semibold mb-3'>One-Command Installation</h3>
              <p className='text-muted-foreground mb-4'>
                The easiest way to get started with Promptliano. This command will handle everything for you:
              </p>
              <CodeBlock code='npx promptliano@latest' language='bash' />
              <div className='mt-4 space-y-2'>
                <p className='text-sm font-medium'>This command will:</p>
                <ul className='text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2'>
                  <li>Download and install Promptliano server</li>
                  <li>Configure MCP for your AI editor (Claude, Cursor, etc.)</li>
                  <li>Start the Promptliano server</li>
                  <li>Create your first project</li>
                </ul>
              </div>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Manual Installation */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Manual Installation</h2>
        <p className='text-muted-foreground'>
          If you prefer to manually download and install Promptliano, you can choose from our prebuilt binaries below.
        </p>
        <DownloadButton variant='dropdown' size='lg' />
        <p className='text-sm text-muted-foreground text-center'>
          The download button above will automatically detect your platform and recommend the best option.
        </p>
      </section>

      {/* Prerequisites */}
      <GlassCard className='p-8'>
        <h2 className='text-2xl font-semibold mb-4'>Manual Installation Prerequisites</h2>
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
        <h2 className='text-3xl font-semibold'>Manual Installation by Platform</h2>

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
curl -L https://github.com/brandon-schabel/promptliano/releases/download/v0.8.3/promptliano-0.8.3-bun-bundle.zip -o promptliano.zip

# Extract the zip file
unzip promptliano.zip

# Navigate to the extracted folder
cd promptliano-0.8.3-bun-bundle'
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
curl -L https://github.com/brandon-schabel/promptliano/releases/download/v0.8.3/promptliano-0.8.3-macos-arm64.zip -o promptliano.zip

# Extract the zip file
unzip promptliano.zip

# Navigate to the extracted folder
cd promptliano-0.8.3-macos-arm64'
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
Invoke-WebRequest -Uri "https://github.com/brandon-schabel/promptliano/releases/download/v0.8.3/promptliano-0.8.3-windows-x64.zip" -OutFile "promptliano.zip"

# Extract the zip file
Expand-Archive -Path "promptliano.zip" -DestinationPath "."

# Navigate to the extracted folder
cd promptliano-0.8.3-windows-x64'
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
wget https://github.com/brandon-schabel/promptliano/releases/download/v0.8.3/promptliano-0.8.3-linux-x64.zip

# Extract the zip file
unzip promptliano-0.8.3-linux-x64.zip

# Navigate to the extracted folder
cd promptliano-0.8.3-linux-x64'
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

      {/* MCP Configuration Section */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>MCP Configuration</h2>
        <p className='text-muted-foreground'>
          Configure your AI editor to connect with Promptliano using the Model Context Protocol (MCP).
        </p>

        <GlassCard className='p-6 bg-blue-500/5 border-blue-500/20'>
          <div className='flex items-start gap-3'>
            <Settings className='h-5 w-5 text-blue-500 mt-0.5' />
            <div>
              <h3 className='font-medium mb-1'>Prerequisites for MCP Setup</h3>
              <ul className='text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2'>
                <li>Promptliano server running</li>
                <li>A project created in Promptliano with a noted Project ID</li>
                <li>Your preferred AI editor installed (Claude Desktop, Cursor, etc.)</li>
              </ul>
            </div>
          </div>
        </GlassCard>

        <Tabs defaultValue='claude' className='w-full'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='claude'>Claude Desktop</TabsTrigger>
            <TabsTrigger value='cursor'>Cursor</TabsTrigger>
            <TabsTrigger value='windsurf'>Windsurf</TabsTrigger>
          </TabsList>

          <TabsContent value='claude' className='space-y-4'>
            <GlassCard className='p-6'>
              <h3 className='text-xl font-semibold mb-4'>Claude Desktop Configuration</h3>
              <Tabs defaultValue='macos' className='w-full'>
                <TabsList className='grid w-full grid-cols-2'>
                  <TabsTrigger value='macos'>macOS</TabsTrigger>
                  <TabsTrigger value='windows'>Windows</TabsTrigger>
                </TabsList>

                <TabsContent value='macos' className='space-y-4'>
                  <div>
                    <h4 className='font-medium mb-2'>1. Locate the configuration file</h4>
                    <CodeBlock code='~/Library/Application Support/Claude/claude_desktop_config.json' language='bash' />
                  </div>

                  <div>
                    <h4 className='font-medium mb-2'>2. Edit the configuration</h4>
                    <CodeBlock
                      code='{
  "mcpServers": {
    "promptliano": {
      "command": "/absolute/path/to/promptliano/packages/server/mcp-start.sh"
    }
  }
}'
                      language='json'
                    />
                    <p className='text-sm text-muted-foreground mt-2'>
                      Replace <code>/absolute/path/to/promptliano</code> with your actual installation path
                    </p>
                  </div>

                  <div>
                    <h4 className='font-medium mb-2'>3. Verify permissions</h4>
                    <CodeBlock code='chmod +x /path/to/promptliano/packages/server/mcp-start.sh' language='bash' />
                  </div>

                  <div>
                    <h4 className='font-medium mb-2'>4. Restart Claude Desktop</h4>
                    <p className='text-sm text-muted-foreground'>
                      Completely quit and reopen Claude Desktop for changes to take effect
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value='windows' className='space-y-4'>
                  <div>
                    <h4 className='font-medium mb-2'>1. Locate the configuration file</h4>
                    <CodeBlock code='%APPDATA%\Claude\claude_desktop_config.json' language='batch' />
                  </div>

                  <div>
                    <h4 className='font-medium mb-2'>2. Edit the configuration</h4>
                    <CodeBlock
                      code='{
  "mcpServers": {
    "promptliano": {
      "command": "C:\\absolute\\path\\to\\promptliano\\packages\\server\\mcp-start.bat"
    }
  }
}'
                      language='json'
                    />
                    <p className='text-sm text-muted-foreground mt-2'>Note: Use double backslashes in Windows paths</p>
                  </div>

                  <div>
                    <h4 className='font-medium mb-2'>3. Restart Claude Desktop</h4>
                    <p className='text-sm text-muted-foreground'>Completely quit and reopen Claude Desktop</p>
                  </div>
                </TabsContent>
              </Tabs>
            </GlassCard>
          </TabsContent>

          <TabsContent value='cursor' className='space-y-4'>
            <GlassCard className='p-6'>
              <h3 className='text-xl font-semibold mb-4'>Cursor Configuration</h3>

              <div className='space-y-4'>
                <div>
                  <h4 className='font-medium mb-2'>1. Open Cursor Settings</h4>
                  <p className='text-sm text-muted-foreground'>Go to Settings → Features → Model Context Protocol</p>
                </div>

                <div>
                  <h4 className='font-medium mb-2'>2. Add Promptliano server</h4>
                  <ul className='text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2'>
                    <li>
                      <strong>Name:</strong> promptliano
                    </li>
                    <li>
                      <strong>Command:</strong> /absolute/path/to/promptliano/packages/server/mcp-start.sh
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className='font-medium mb-2'>3. Save and restart Cursor</h4>
                  <p className='text-sm text-muted-foreground'>Restart Cursor for the changes to take effect</p>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value='windsurf' className='space-y-4'>
            <GlassCard className='p-6'>
              <h3 className='text-xl font-semibold mb-4'>Windsurf Configuration</h3>

              <div className='space-y-4'>
                <div>
                  <h4 className='font-medium mb-2'>1. Open Windsurf configuration</h4>
                  <p className='text-sm text-muted-foreground'>Follow Windsurf's documentation for MCP setup</p>
                </div>

                <div>
                  <h4 className='font-medium mb-2'>2. Add MCP server</h4>
                  <p className='text-sm text-muted-foreground'>Use the same command path as other editors</p>
                </div>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>

        {/* Verify MCP Connection */}
        <GlassCard className='p-6'>
          <h3 className='text-lg font-medium mb-4'>Verifying the Connection</h3>
          <div className='space-y-4'>
            <div>
              <h4 className='font-medium mb-2'>Test Commands</h4>
              <p className='text-sm text-muted-foreground mb-2'>
                Once configured, test the connection by asking your AI assistant:
              </p>
              <ul className='text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2'>
                <li>"What files are in this project?"</li>
                <li>"Give me a project summary"</li>
                <li>"Show me the available MCP tools"</li>
              </ul>
            </div>

            <div>
              <h4 className='font-medium mb-2'>Expected Response</h4>
              <p className='text-sm text-muted-foreground'>Your AI assistant should respond with:</p>
              <ul className='text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2'>
                <li>A list of Promptliano MCP tools</li>
                <li>Information about your project files</li>
                <li>Ability to use project management features</li>
              </ul>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Troubleshooting Section */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Troubleshooting</h2>

        <GlassCard className='p-6'>
          <h3 className='text-lg font-medium mb-4'>Installation Issues</h3>
          <div className='space-y-4'>
            <div>
              <h4 className='font-medium mb-2'>Port already in use</h4>
              <p className='text-sm text-muted-foreground mb-2'>
                If port 3579 is already in use, you can specify a different port:
              </p>
              <CodeBlock code='./promptliano --port 3580' language='bash' />
            </div>

            <div>
              <h4 className='font-medium mb-2'>Permission denied on macOS/Linux</h4>
              <p className='text-sm text-muted-foreground mb-2'>Make sure the binary has execute permissions:</p>
              <CodeBlock code='chmod +x ./promptliano' language='bash' />
            </div>

            <div>
              <h4 className='font-medium mb-2'>Windows Defender blocking execution</h4>
              <p className='text-sm text-muted-foreground'>
                Click "More info" then "Run anyway" when Windows Defender SmartScreen appears.
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className='p-6'>
          <h3 className='text-lg font-medium mb-4'>MCP Connection Issues</h3>
          <div className='space-y-4'>
            <div>
              <h4 className='font-medium mb-2'>"MCP server not found"</h4>
              <ul className='text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2'>
                <li>Ensure the path in config is absolute</li>
                <li>Verify the mcp-start script exists</li>
                <li>Check file permissions</li>
              </ul>
            </div>

            <div>
              <h4 className='font-medium mb-2'>"Cannot connect to Promptliano"</h4>
              <ul className='text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2'>
                <li>Ensure Promptliano server is running</li>
                <li>Check if port 3579 (or 3147 for dev) is accessible</li>
                <li>Verify no firewall blocking</li>
              </ul>
              <CodeBlock
                code='# Verify server is running\ncurl http://localhost:3579/health'
                language='bash'
                className='mt-2'
              />
            </div>

            <div>
              <h4 className='font-medium mb-2'>"No tools available"</h4>
              <ul className='text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2'>
                <li>Restart your editor completely</li>
                <li>Check the MCP configuration syntax</li>
                <li>Ensure only one Promptliano server is configured</li>
              </ul>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Additional Resources */}
      <section className='space-y-6'>
        <h2 className='text-3xl font-semibold'>Additional Resources</h2>

        <div className='grid gap-4 md:grid-cols-2'>
          <GlassCard className='p-6'>
            <div className='flex items-start gap-3'>
              <Shield className='h-5 w-5 text-primary mt-0.5' />
              <div>
                <h3 className='font-medium mb-2'>Security Considerations</h3>
                <ul className='text-sm text-muted-foreground space-y-1 list-disc list-inside'>
                  <li>MCP connection is local-only by default</li>
                  <li>No external network access required</li>
                  <li>API keys remain on your machine</li>
                  <li>Configure firewall rules if needed</li>
                </ul>
              </div>
            </div>
          </GlassCard>

          <GlassCard className='p-6'>
            <div className='flex items-start gap-3'>
              <HelpCircle className='h-5 w-5 text-primary mt-0.5' />
              <div>
                <h3 className='font-medium mb-2'>Server Ports</h3>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  <li>
                    <strong>Development:</strong> Port 3147
                  </li>
                  <li>
                    <strong>Production:</strong> Port 3579
                  </li>
                  <li className='pt-2'>The quick installer uses production port by default</li>
                </ul>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Next Steps */}
      <GlassCard className='p-8 bg-primary/5 border-primary/20'>
        <h3 className='text-xl font-semibold mb-3'>Installation Complete! 🎉</h3>
        <p className='mb-4 text-muted-foreground'>
          Now that you have Promptliano installed and configured, here's what to do next:
        </p>
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
            <a href='/docs/ui-overview' className='text-primary hover:underline'>
              Explore the UI
            </a>
            <span className='text-muted-foreground'>with our visual tour</span>
          </li>
          <li className='flex items-center gap-2'>
            <span>→</span>
            <a href='https://discord.gg/your-discord' className='text-primary hover:underline'>
              Join our Discord
            </a>
            <span className='text-muted-foreground'>for community support</span>
          </li>
        </ul>
      </GlassCard>
    </div>
  )
}
