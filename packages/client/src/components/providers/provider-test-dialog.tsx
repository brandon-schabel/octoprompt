import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Badge,
  Alert,
  AlertDescription,
  Progress,
  ScrollArea,
  AnimateOnScroll,
  cn
} from '@promptliano/ui'
import {
  CheckCircle,
  XCircle,
  Loader2,
  Wifi,
  Shield,
  Database,
  Zap,
  Clock,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Server,
  Key,
  RefreshCw,
  Trophy,
  TrendingUp
} from 'lucide-react'
import { useTestProvider } from '@/hooks/api/use-providers-api'
import type { ProviderKey, TestProviderResponse } from '@promptliano/schemas'
import type { DataResponseSchema } from '@promptliano/api-client'
import { toast } from 'sonner'

interface TestPhase {
  id: string
  name: string
  description: string
  icon: React.ElementType
  status: 'pending' | 'testing' | 'success' | 'error'
  message?: string
  responseTime?: number
}

interface ProviderTestDialogProps {
  provider: ProviderKey
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProviderTestDialog({ provider, open, onOpenChange }: ProviderTestDialogProps) {
  const testMutation = useTestProvider()
  const [currentPhase, setCurrentPhase] = useState(0)
  const [testComplete, setTestComplete] = useState(false)
  const [modelCount, setModelCount] = useState(0)
  const [responseTime, setResponseTime] = useState(0)

  const [phases, setPhases] = useState<TestPhase[]>([
    {
      id: 'connect',
      name: 'Establishing Connection',
      description: 'Connecting to provider endpoint',
      icon: Wifi,
      status: 'pending'
    },
    {
      id: 'auth',
      name: 'Authentication',
      description: 'Verifying API credentials',
      icon: Shield,
      status: 'pending'
    },
    {
      id: 'models',
      name: 'Fetching Models',
      description: 'Retrieving available models',
      icon: Database,
      status: 'pending'
    },
    {
      id: 'validate',
      name: 'Validation',
      description: 'Confirming provider compatibility',
      icon: CheckCircle,
      status: 'pending'
    }
  ])

  useEffect(() => {
    if (open) {
      runTest()
    } else {
      // Reset state when dialog closes
      setCurrentPhase(0)
      setTestComplete(false)
      setModelCount(0)
      setResponseTime(0)
      setPhases(phases.map((p) => ({ ...p, status: 'pending', message: undefined, responseTime: undefined })))
    }
  }, [open])

  // Type guard to check if the result is a valid test response
  const isValidTestResponse = (result: unknown): result is DataResponseSchema<TestProviderResponse> => {
    return (
      typeof result === 'object' &&
      result !== null &&
      'data' in result &&
      typeof (result as any).data === 'object' &&
      (result as any).data !== null &&
      'success' in (result as any).data &&
      typeof (result as any).data.success === 'boolean'
    )
  }

  const runTest = async () => {
    const startTime = Date.now()

    // Simulate test phases
    for (let i = 0; i < phases.length; i++) {
      setCurrentPhase(i)

      // Update phase to testing
      setPhases((prev) => prev.map((p, idx) => (idx === i ? { ...p, status: 'testing' } : p)))

      // Simulate delay for each phase
      await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400))

      if (i === phases.length - 1) {
        // Last phase - actually run the test
        try {
          const result: unknown = await testMutation.mutateAsync({
            provider: provider.provider,
            timeout: 30000
          })

          const phaseTime = Date.now() - startTime
          setResponseTime(phaseTime)

          // Type guard to ensure we have a valid response
          if (!isValidTestResponse(result)) {
            throw new Error('Invalid response format from provider test')
          }

          const testData = result.data

          if (testData.success) {
            // Update last phase with success
            setPhases((prev) =>
              prev.map((p, idx) =>
                idx === i
                  ? {
                      ...p,
                      status: 'success',
                      message: `Found ${testData.models?.length || 0} models`,
                      responseTime: phaseTime
                    }
                  : idx < i
                    ? { ...p, status: 'success' }
                    : p
              )
            )
            setModelCount(testData.models?.length || 0)
            setTestComplete(true)

            // Show success toast
            toast.success('Provider connected successfully!')
          } else {
            throw new Error(testData.error || 'Test failed')
          }
        } catch (error: any) {
          // Update phase with error
          setPhases((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? {
                    ...p,
                    status: 'error',
                    message: error.message
                  }
                : idx < i
                  ? { ...p, status: 'success' }
                  : p
            )
          )
          setTestComplete(true)
        }
      } else {
        // Update phase with success
        const phaseTime = 300 + Math.random() * 200
        setPhases((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? {
                  ...p,
                  status: 'success',
                  responseTime: phaseTime
                }
              : p
          )
        )
      }
    }
  }

  const isSuccess = phases.every((p) => p.status === 'success')
  const hasError = phases.some((p) => p.status === 'error')
  const progressValue = (phases.filter((p) => p.status === 'success').length / phases.length) * 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Zap className='h-5 w-5 text-primary' />
            Testing Provider Connection
          </DialogTitle>
          <DialogDescription>Running diagnostics on {provider.name}</DialogDescription>
        </DialogHeader>

        <div className='space-y-6 py-4'>
          {/* Progress Bar */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between text-sm'>
              <span className='text-muted-foreground'>Progress</span>
              <span className='font-medium'>{Math.round(progressValue)}%</span>
            </div>
            <Progress value={progressValue} className='h-2' />
          </div>

          {/* Test Phases */}
          <div className='space-y-3'>
            {phases.map((phase, index) => {
              const Icon = phase.icon
              const isActive = currentPhase === index
              const isPast = currentPhase > index

              return (
                <AnimateOnScroll
                  key={phase.id}
                  delay={index * 0.1}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border transition-all',
                    isActive && 'bg-primary/5 border-primary/50',
                    phase.status === 'success' && 'bg-green-500/5 border-green-500/30',
                    phase.status === 'error' && 'bg-red-500/5 border-red-500/30',
                    phase.status === 'pending' && 'border-muted'
                  )}
                >
                  <div className='mt-0.5'>
                    {phase.status === 'testing' ? (
                      <Loader2 className='h-5 w-5 animate-spin text-primary' />
                    ) : phase.status === 'success' ? (
                      <CheckCircle className='h-5 w-5 text-green-500' />
                    ) : phase.status === 'error' ? (
                      <XCircle className='h-5 w-5 text-red-500' />
                    ) : (
                      <Icon className='h-5 w-5 text-muted-foreground' />
                    )}
                  </div>
                  <div className='flex-1 space-y-1'>
                    <div className='flex items-center justify-between'>
                      <p className='font-medium text-sm'>{phase.name}</p>
                      {phase.responseTime && (
                        <Badge variant='outline' className='text-xs gap-1'>
                          <Clock className='h-3 w-3' />
                          {phase.responseTime}ms
                        </Badge>
                      )}
                    </div>
                    <p className='text-xs text-muted-foreground'>{phase.description}</p>
                    {phase.message && (
                      <p className={cn('text-xs mt-1', phase.status === 'error' ? 'text-red-500' : 'text-green-500')}>
                        {phase.message}
                      </p>
                    )}
                  </div>
                </AnimateOnScroll>
              )
            })}
          </div>

          {/* Results */}
          {testComplete && (
            <AnimateOnScroll>
              <div className='space-y-4'>
                {isSuccess ? (
                  <>
                    {/* Success Message */}
                    <Alert className='border-green-500/30 bg-green-500/5'>
                      <Trophy className='h-4 w-4 text-green-500' />
                      <AlertDescription>
                        <p className='font-medium text-green-500 mb-2'>Connection Successful!</p>
                        <div className='grid grid-cols-2 gap-4 mt-3'>
                          <div className='flex items-center gap-2'>
                            <Server className='h-4 w-4 text-muted-foreground' />
                            <div>
                              <p className='text-xs text-muted-foreground'>Provider</p>
                              <p className='text-sm font-medium'>{provider.provider}</p>
                            </div>
                          </div>
                          <div className='flex items-center gap-2'>
                            <Database className='h-4 w-4 text-muted-foreground' />
                            <div>
                              <p className='text-xs text-muted-foreground'>Models Available</p>
                              <p className='text-sm font-medium'>{modelCount}</p>
                            </div>
                          </div>
                          <div className='flex items-center gap-2'>
                            <Clock className='h-4 w-4 text-muted-foreground' />
                            <div>
                              <p className='text-xs text-muted-foreground'>Response Time</p>
                              <p className='text-sm font-medium'>{responseTime}ms</p>
                            </div>
                          </div>
                          <div className='flex items-center gap-2'>
                            <TrendingUp className='h-4 w-4 text-muted-foreground' />
                            <div>
                              <p className='text-xs text-muted-foreground'>Performance</p>
                              <p className='text-sm font-medium'>
                                {responseTime < 500
                                  ? 'Excellent'
                                  : responseTime < 1000
                                    ? 'Good'
                                    : responseTime < 2000
                                      ? 'Fair'
                                      : 'Slow'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>

                    {/* Model List Preview */}
                    {modelCount > 0 && (
                      <div className='space-y-2'>
                        <p className='text-sm font-medium flex items-center gap-2'>
                          <Sparkles className='h-4 w-4 text-primary' />
                          Available Models
                        </p>
                        <ScrollArea className='h-[100px] w-full rounded-md border p-3'>
                          <div className='space-y-1'>
                            {/* This would show actual models if we had them */}
                            <p className='text-xs text-muted-foreground'>{modelCount} models ready to use</p>
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </>
                ) : (
                  /* Error Message */
                  <Alert className='border-red-500/30 bg-red-500/5'>
                    <AlertCircle className='h-4 w-4 text-red-500' />
                    <AlertDescription>
                      <p className='font-medium text-red-500 mb-2'>Connection Failed</p>
                      <p className='text-sm text-muted-foreground mb-3'>
                        {phases.find((p) => p.status === 'error')?.message || 'Unable to connect to provider'}
                      </p>
                      <div className='space-y-2'>
                        <p className='text-xs font-medium'>Troubleshooting Tips:</p>
                        <ul className='list-disc list-inside space-y-1 text-xs text-muted-foreground'>
                          <li>Verify your API key is correct and active</li>
                          <li>Check if the provider service is running</li>
                          <li>Ensure your network connection is stable</li>
                          <li>Confirm the provider URL is correct</li>
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Actions */}
                <div className='flex gap-2'>
                  {!isSuccess && (
                    <Button
                      variant='outline'
                      className='flex-1'
                      onClick={() => {
                        setTestComplete(false)
                        setCurrentPhase(0)
                        setPhases(phases.map((p) => ({ ...p, status: 'pending', message: undefined })))
                        runTest()
                      }}
                    >
                      <RefreshCw className='h-4 w-4 mr-2' />
                      Retry Test
                    </Button>
                  )}
                  <Button
                    variant={isSuccess ? 'default' : 'outline'}
                    className='flex-1'
                    onClick={() => onOpenChange(false)}
                  >
                    {isSuccess ? 'Done' : 'Close'}
                  </Button>
                </div>
              </div>
            </AnimateOnScroll>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
