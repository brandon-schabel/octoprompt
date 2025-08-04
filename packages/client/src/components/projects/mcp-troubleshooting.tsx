import { AlertCircle, CheckCircle2, XCircle, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@promptliano/ui'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@promptliano/ui'

interface TroubleshootingStep {
  title: string
  description: string
  command?: string
}

const platformTroubleshooting: Record<string, TroubleshootingStep[]> = {
  'claude-desktop': [
    {
      title: 'Claude Desktop not detecting MCP',
      description:
        'Ensure Claude Desktop is completely closed before installation. The app must be restarted after MCP installation.'
    },
    {
      title: 'Permission denied errors',
      description: 'The MCP start script needs execute permissions.',
      command: 'chmod +x packages/server/mcp-start.sh'
    },
    {
      title: 'Configuration not found',
      description: 'Claude Desktop config file may not exist yet. Launch Claude Desktop once to create it.'
    }
  ],
  vscode: [
    {
      title: 'MCP extension not installed',
      description: 'Install the official MCP extension from the VS Code marketplace first.'
    },
    {
      title: 'Settings not taking effect',
      description: 'Reload the VS Code window after installation using Cmd/Ctrl+R.'
    },
    {
      title: 'Conflicting configurations',
      description: 'Check workspace settings (.vscode/settings.json) for conflicting MCP configurations.'
    }
  ],
  cursor: [
    {
      title: 'Cursor not detecting changes',
      description: 'Cursor requires a full restart after MCP installation. Close all Cursor windows.'
    },
    {
      title: 'Settings file not found',
      description: 'Open Cursor preferences at least once to create the settings file.'
    }
  ],
  continue: [
    {
      title: 'Continue not connecting',
      description: 'Ensure the MCP server is added to all model configurations in Continue.'
    },
    {
      title: 'IDE extension issues',
      description: 'Verify Continue extension is installed and enabled in your IDE.'
    }
  ],
  'claude-code': [
    {
      title: 'Claude Code CLI not found',
      description: 'Install Claude Code CLI globally first.',
      command: 'npm install -g claude-code'
    },
    {
      title: 'Project binding issues',
      description: 'Ensure the project path in bindings matches your actual project location.'
    }
  ],
  windsurf: [
    {
      title: 'Windsurf MCP support',
      description: 'Verify Windsurf has MCP support enabled in its settings.'
    },
    {
      title: 'Configuration location',
      description: 'Windsurf may use different config paths based on installation method.'
    }
  ]
}

interface MCPTroubleshootingProps {
  platform?: string
  showGeneral?: boolean
}

export function MCPTroubleshooting({ platform, showGeneral = true }: MCPTroubleshootingProps) {
  const platformSteps = platform ? platformTroubleshooting[platform] : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Troubleshooting Guide</CardTitle>
        <CardDescription>Common issues and solutions for MCP installation</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type='single' collapsible className='w-full'>
          {showGeneral && (
            <AccordionItem value='general'>
              <AccordionTrigger>General Issues</AccordionTrigger>
              <AccordionContent className='space-y-4'>
                <Alert>
                  <AlertCircle className='h-4 w-4' />
                  <AlertTitle>Promptliano Server Not Running</AlertTitle>
                  <AlertDescription>
                    Ensure the Promptliano server is running on port 3147. Start it with `npm run dev` in the project
                    root.
                  </AlertDescription>
                </Alert>

                <Alert>
                  <Info className='h-4 w-4' />
                  <AlertTitle>Firewall Blocking Connection</AlertTitle>
                  <AlertDescription>
                    Check your firewall settings to ensure local connections on port 3147 are allowed.
                  </AlertDescription>
                </Alert>

                <Alert>
                  <CheckCircle2 className='h-4 w-4' />
                  <AlertTitle>Verify Installation</AlertTitle>
                  <AlertDescription>
                    After installation, look for the green connection indicator in Promptliano's project settings.
                  </AlertDescription>
                </Alert>
              </AccordionContent>
            </AccordionItem>
          )}

          {platform && platformSteps.length > 0 && (
            <AccordionItem value={platform}>
              <AccordionTrigger>
                {platform
                  .split('-')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ')}{' '}
                Issues
              </AccordionTrigger>
              <AccordionContent className='space-y-4'>
                {platformSteps.map((step, index) => (
                  <Alert key={index}>
                    <AlertCircle className='h-4 w-4' />
                    <AlertTitle>{step.title}</AlertTitle>
                    <AlertDescription>
                      {step.description}
                      {step.command && (
                        <pre className='mt-2 p-2 bg-muted rounded text-xs'>
                          <code>{step.command}</code>
                        </pre>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value='verification'>
            <AccordionTrigger>Verification Steps</AccordionTrigger>
            <AccordionContent className='space-y-4'>
              <div className='space-y-2'>
                <div className='flex items-start space-x-2'>
                  <CheckCircle2 className='h-4 w-4 mt-0.5 text-green-500' />
                  <div>
                    <p className='font-medium'>Check MCP Status</p>
                    <p className='text-sm text-muted-foreground'>
                      The status indicator should show green when properly connected
                    </p>
                  </div>
                </div>

                <div className='flex items-start space-x-2'>
                  <CheckCircle2 className='h-4 w-4 mt-0.5 text-green-500' />
                  <div>
                    <p className='font-medium'>Test MCP Commands</p>
                    <p className='text-sm text-muted-foreground'>
                      Try using an Promptliano command in your AI tool to verify the connection
                    </p>
                  </div>
                </div>

                <div className='flex items-start space-x-2'>
                  <CheckCircle2 className='h-4 w-4 mt-0.5 text-green-500' />
                  <div>
                    <p className='font-medium'>Check Configuration File</p>
                    <p className='text-sm text-muted-foreground'>
                      Verify the configuration file contains the Promptliano server entry
                    </p>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}
