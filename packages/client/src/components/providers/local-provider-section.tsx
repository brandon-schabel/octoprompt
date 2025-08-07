import React, { useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Badge,
  Alert,
  AlertDescription,
  Skeleton,
  GlassCard,
  AnimateOnScroll,
  cn
} from '@promptliano/ui'
import {
  Monitor,
  Database,
  RefreshCw,
  Settings,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  Zap,
  Loader2,
  Server,
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  ChevronRight,
  Info
} from 'lucide-react'
import { LocalModelStatusIndicator } from '@/components/settings/local-model-status-indicator'
import { useLocalModelStatus } from '@/hooks/use-local-model-status'
import { useTestProvider } from '@/hooks/api/use-providers-api'
import { useAppSettings } from '@/hooks/use-kv-local-storage'
import { ProviderTestDialog } from './provider-test-dialog'
import type { ProviderKey } from '@promptliano/schemas'
import { toast } from 'sonner'

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
const DEFAULT_LMSTUDIO_URL = 'http://localhost:1234'

interface LocalProviderSectionProps {
  providers: ProviderKey[]
  onEdit?: (provider: ProviderKey) => void
  isLoading?: boolean
}

export function LocalProviderSection({ providers, onEdit, isLoading }: LocalProviderSectionProps) {
  const [appSettings, updateAppSettings] = useAppSettings()
  const ollamaUrl = appSettings.ollamaGlobalUrl || DEFAULT_OLLAMA_URL
  const lmstudioUrl = appSettings.lmStudioGlobalUrl || DEFAULT_LMSTUDIO_URL
  const [testingProvider, setTestingProvider] = useState<ProviderKey | null>(null)

  const ollamaStatus = useLocalModelStatus('ollama', { url: ollamaUrl })
  const lmstudioStatus = useLocalModelStatus('lmstudio', { url: lmstudioUrl })
  const testMutation = useTestProvider()

  const ollamaProvider = providers.find((p) => p.provider === 'ollama')
  const lmstudioProvider = providers.find((p) => p.provider === 'lmstudio')

  const handleTestConnection = async (provider: ProviderKey, providerType: 'ollama' | 'lmstudio') => {
    setTestingProvider(provider)
    // The dialog will handle the actual testing
  }

  const handleResetUrl = (provider: 'ollama' | 'lmstudio') => {
    if (provider === 'ollama') {
      updateAppSettings({ ollamaGlobalUrl: DEFAULT_OLLAMA_URL })
      toast.success('Ollama URL reset to default')
    } else {
      updateAppSettings({ lmStudioGlobalUrl: DEFAULT_LMSTUDIO_URL })
      toast.success('LMStudio URL reset to default')
    }
  }

  const renderProviderCard = (
    provider: 'ollama' | 'lmstudio',
    status: ReturnType<typeof useLocalModelStatus>,
    url: string,
    setUrl: (url: string) => void,
    providerKey?: ProviderKey
  ) => {
    const isOllama = provider === 'ollama'
    const providerName = isOllama ? 'Ollama' : 'LMStudio'
    const Icon = isOllama ? Database : Monitor
    const description = isOllama
      ? 'Lightweight terminal-based tool for running LLMs locally'
      : 'User-friendly UI for managing and running local models'
    const downloadUrl = isOllama ? 'https://ollama.com/download' : 'https://lmstudio.ai/'
    const setupSteps = isOllama
      ? [
          'Download and install Ollama',
          'Run "ollama serve" in terminal',
          'Pull models with "ollama pull model-name"',
          'Configure the URL below if not using default'
        ]
      : [
          'Download and install LMStudio',
          'Launch the application',
          'Download models from the UI',
          'Start the local server',
          'Configure the URL below if not using default'
        ]

    return (
      <AnimateOnScroll animation='fade-up' delay={isOllama ? 0 : 0.1}>
        <GlassCard
          className={cn(
            'relative overflow-hidden transition-all duration-500',
            'hover:shadow-2xl hover:border-primary/30',
            status.isConnected && 'border-green-500/30'
          )}
        >
          {/* Gradient Background */}
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-br opacity-5',
              isOllama ? 'from-blue-500 via-cyan-500 to-teal-500' : 'from-purple-500 via-pink-500 to-rose-500'
            )}
          />

          {/* Connection Status Badge */}
          <div className='absolute top-4 right-4 z-10'>
            <Badge
              variant={status.isConnected ? 'default' : 'secondary'}
              className={cn(
                'gap-1 transition-all',
                status.isConnected
                  ? 'bg-green-500/10 text-green-500 border-green-500/30'
                  : 'bg-gray-500/10 text-gray-500 border-gray-500/30'
              )}
            >
              {status.isConnected ? (
                <>
                  <Wifi className='h-3 w-3' />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff className='h-3 w-3' />
                  Disconnected
                </>
              )}
            </Badge>
          </div>

          <CardHeader className='relative'>
            <div className='flex items-start gap-4'>
              <div
                className={cn(
                  'p-3 rounded-xl transition-all duration-300',
                  'bg-gradient-to-br shadow-lg',
                  isOllama
                    ? 'from-blue-500/20 to-cyan-500/10 group-hover:from-blue-500/30 group-hover:to-cyan-500/20'
                    : 'from-purple-500/20 to-pink-500/10 group-hover:from-purple-500/30 group-hover:to-pink-500/20'
                )}
              >
                <Icon className={cn('h-6 w-6', isOllama ? 'text-blue-500' : 'text-purple-500')} />
              </div>
              <div className='flex-1'>
                <CardTitle className='text-xl flex items-center gap-2'>
                  {providerName}
                  {status.isConnected && (
                    <div className='flex items-center gap-1'>
                      <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
                      <span className='text-xs text-green-500 font-normal'>Live</span>
                    </div>
                  )}
                </CardTitle>
                <CardDescription className='mt-1'>{description}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className='space-y-6'>
            {/* Quick Stats */}
            {status.isConnected && (
              <div className='grid grid-cols-3 gap-3'>
                <div className='flex items-center gap-2 p-2 rounded-lg bg-muted/50'>
                  <Server className='h-4 w-4 text-muted-foreground' />
                  <div>
                    <p className='text-xs text-muted-foreground'>Status</p>
                    <p className='text-sm font-medium'>Active</p>
                  </div>
                </div>
                <div className='flex items-center gap-2 p-2 rounded-lg bg-muted/50'>
                  <Cpu className='h-4 w-4 text-muted-foreground' />
                  <div>
                    <p className='text-xs text-muted-foreground'>Models</p>
                    <p className='text-sm font-medium'>--</p>
                  </div>
                </div>
                <div className='flex items-center gap-2 p-2 rounded-lg bg-muted/50'>
                  <HardDrive className='h-4 w-4 text-muted-foreground' />
                  <div>
                    <p className='text-xs text-muted-foreground'>Memory</p>
                    <p className='text-sm font-medium'>--</p>
                  </div>
                </div>
              </div>
            )}

            {/* Setup Instructions */}
            {!status.isConnected && (
              <Alert className='border-dashed'>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>
                  <p className='font-medium mb-2'>Setup Instructions:</p>
                  <ol className='list-decimal list-inside space-y-1 text-sm'>
                    {setupSteps.map((step, i) => (
                      <li key={i} className='text-muted-foreground'>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <a
                    href={downloadUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 text-primary hover:underline mt-3 text-sm font-medium'
                  >
                    Download {providerName}
                    <ExternalLink className='h-3 w-3' />
                  </a>
                </AlertDescription>
              </Alert>
            )}

            {/* URL Configuration */}
            <div className='space-y-3'>
              <Label htmlFor={`${provider}-url`} className='text-sm font-medium'>
                Server URL
              </Label>
              <div className='flex gap-2'>
                <div className='relative flex-1'>
                  <Input
                    id={`${provider}-url`}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={isOllama ? DEFAULT_OLLAMA_URL : DEFAULT_LMSTUDIO_URL}
                    className='pr-10'
                  />
                  <div className='absolute right-2 top-1/2 -translate-y-1/2'>
                    <LocalModelStatusIndicator provider={provider} url={url} className='hidden' />
                  </div>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='outline'
                        size='icon'
                        onClick={() => handleResetUrl(provider)}
                        disabled={url === (isOllama ? DEFAULT_OLLAMA_URL : DEFAULT_LMSTUDIO_URL)}
                      >
                        <RotateCcw className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset to default URL</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {url !== (isOllama ? DEFAULT_OLLAMA_URL : DEFAULT_LMSTUDIO_URL) && (
                <p className='text-xs text-muted-foreground'>
                  Using custom URL (default: {isOllama ? DEFAULT_OLLAMA_URL : DEFAULT_LMSTUDIO_URL})
                </p>
              )}
            </div>

            {/* Actions */}
            <div className='flex gap-2'>
              <Button
                className='flex-1 gap-2'
                variant={status.isConnected ? 'outline' : 'default'}
                onClick={() => {
                  if (providerKey) {
                    handleTestConnection(providerKey, provider)
                  } else {
                    toast.error(`Please add ${providerName} as a provider first`)
                  }
                }}
                disabled={status.isChecking || !providerKey}
              >
                {status.isChecking ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Testing...
                  </>
                ) : status.isConnected ? (
                  <>
                    <RefreshCw className='h-4 w-4' />
                    Re-test Connection
                  </>
                ) : (
                  <>
                    <Zap className='h-4 w-4' />
                    Test Connection
                  </>
                )}
              </Button>
              {providerKey && onEdit && (
                <Button variant='outline' size='icon' onClick={() => onEdit(providerKey)}>
                  <Settings className='h-4 w-4' />
                </Button>
              )}
            </div>

            {/* Provider Info */}
            {providerKey && (
              <div className='pt-3 border-t space-y-2'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>Provider Key</span>
                  <code className='text-xs bg-muted px-2 py-1 rounded'>{providerKey.key.substring(0, 8)}••••</code>
                </div>
                {providerKey.isDefault && (
                  <Badge variant='secondary' className='text-xs'>
                    Default Provider
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </GlassCard>
      </AnimateOnScroll>
    )
  }

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center gap-2 mb-4'>
          <Monitor className='h-5 w-5 text-muted-foreground' />
          <h2 className='text-lg font-semibold'>Local Providers</h2>
        </div>
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          <Skeleton className='h-[400px]' />
          <Skeleton className='h-[400px]' />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className='space-y-6'>
        {/* Section Header */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10'>
              <Monitor className='h-5 w-5 text-orange-500' />
            </div>
            <div>
              <h2 className='text-lg font-semibold'>Local Providers</h2>
              <p className='text-sm text-muted-foreground'>Connect to LLMs running on your machine</p>
            </div>
          </div>
          <Badge variant='outline' className='gap-1'>
            <Info className='h-3 w-3' />
            {(ollamaStatus.isConnected ? 1 : 0) + (lmstudioStatus.isConnected ? 1 : 0)} / 2 Connected
          </Badge>
        </div>

        {/* Provider Cards */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          {renderProviderCard(
            'ollama',
            ollamaStatus,
            ollamaUrl,
            (url: string) => updateAppSettings({ ollamaGlobalUrl: url }),
            ollamaProvider
          )}
          {renderProviderCard(
            'lmstudio',
            lmstudioStatus,
            lmstudioUrl,
            (url: string) => updateAppSettings({ lmStudioGlobalUrl: url }),
            lmstudioProvider
          )}
        </div>

        {/* Help Section */}
        <Alert>
          <Info className='h-4 w-4' />
          <AlertDescription>
            <p className='font-medium mb-1'>Local Provider Tips:</p>
            <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
              <li>Ensure the local server is running before testing connections</li>
              <li>Default URLs work for most installations</li>
              <li>Custom URLs are useful for Docker or remote setups</li>
              <li>Models need to be downloaded separately through each tool</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>

      {/* Test Dialog */}
      {testingProvider && (
        <ProviderTestDialog
          provider={testingProvider}
          open={!!testingProvider}
          onOpenChange={(open) => !open && setTestingProvider(null)}
        />
      )}
    </>
  )
}
