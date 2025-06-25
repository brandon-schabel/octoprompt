import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, XCircle, Loader2, Play, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import {
  useTestMCPConnection,
  useTestMCPInitialize,
  useTestMCPMethod,
  useGetMCPTestData
} from '@/hooks/api/use-mcp-api'

interface MCPTestScenariosProps {
  projectId: number
  sessionId?: string
  onSessionCreated?: (sessionId: string) => void
}

interface TestStep {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'success' | 'error'
  result?: any
  error?: string
}

interface TestScenario {
  id: string
  name: string
  description: string
  steps: TestStep[]
}

export function MCPTestScenarios({ projectId, sessionId, onSessionCreated }: MCPTestScenariosProps) {
  const [runningScenario, setRunningScenario] = useState<string | null>(null)
  const [scenarios, setScenarios] = useState<TestScenario[]>([])

  const { data: testData } = useGetMCPTestData(projectId)
  const testConnection = useTestMCPConnection(projectId)
  const testInitialize = useTestMCPInitialize(projectId)
  const testMethod = useTestMCPMethod(projectId)

  const createTestScenarios = (): TestScenario[] => {
    const baseUrl = testData?.data?.mcpEndpoints?.projectSpecific || 'http://localhost:3147/api/mcp'

    return [
      {
        id: 'full-workflow',
        name: 'Complete MCP Workflow',
        description: 'Test the full MCP protocol workflow from connection to tool execution',
        steps: [
          {
            id: 'connection',
            name: 'Test Connection',
            description: 'Verify server is reachable',
            status: 'pending'
          },
          {
            id: 'initialize',
            name: 'Initialize Session',
            description: 'Perform MCP handshake',
            status: 'pending'
          },
          {
            id: 'list-tools',
            name: 'List Tools',
            description: 'Get available tools',
            status: 'pending'
          },
          {
            id: 'list-resources',
            name: 'List Resources',
            description: 'Get available resources',
            status: 'pending'
          },
          {
            id: 'ping',
            name: 'Ping Server',
            description: 'Test health endpoint',
            status: 'pending'
          }
        ]
      },
      {
        id: 'error-handling',
        name: 'Error Handling Tests',
        description: 'Test various error scenarios and edge cases',
        steps: [
          {
            id: 'invalid-method',
            name: 'Invalid Method',
            description: 'Call non-existent method',
            status: 'pending'
          },
          {
            id: 'malformed-params',
            name: 'Malformed Parameters',
            description: 'Send invalid parameters',
            status: 'pending'
          },
          {
            id: 'no-session',
            name: 'No Session Context',
            description: 'Call method requiring session without session ID',
            status: 'pending'
          }
        ]
      },
      {
        id: 'performance',
        name: 'Performance Tests',
        description: 'Test response times and concurrent requests',
        steps: [
          {
            id: 'response-time',
            name: 'Response Time',
            description: 'Measure typical response times',
            status: 'pending'
          },
          {
            id: 'concurrent',
            name: 'Concurrent Requests',
            description: 'Test multiple simultaneous requests',
            status: 'pending'
          }
        ]
      }
    ]
  }

  const runScenario = async (scenarioId: string) => {
    const scenario = createTestScenarios().find((s) => s.id === scenarioId)
    if (!scenario) return

    setRunningScenario(scenarioId)
    const updatedScenario = { ...scenario }

    try {
      const baseUrl = testData?.data?.mcpEndpoints?.projectSpecific || 'http://localhost:3147/api/mcp'
      let currentSessionId = sessionId

      for (const step of updatedScenario.steps) {
        // Update step status to running
        step.status = 'running'
        setScenarios((prev) => prev.map((s) => (s.id === scenarioId ? updatedScenario : s)))

        try {
          let result: any = null

          switch (step.id) {
            case 'connection':
              result = await testConnection.mutateAsync(baseUrl)
              if (!result.data.connected) {
                throw new Error(result.data.error)
              }
              break

            case 'initialize':
              result = await testInitialize.mutateAsync(baseUrl)
              if (!result.data.initialized) {
                throw new Error(result.data.error)
              }
              if (result.data.sessionId) {
                currentSessionId = result.data.sessionId
                if (currentSessionId) {
                  onSessionCreated?.(currentSessionId)
                }
              }
              break

            case 'list-tools':
              result = await testMethod.mutateAsync({
                url: baseUrl,
                method: 'tools/list',
                params: {},
                sessionId: currentSessionId
              })
              break

            case 'list-resources':
              result = await testMethod.mutateAsync({
                url: baseUrl,
                method: 'resources/list',
                params: {},
                sessionId: currentSessionId
              })
              break

            case 'ping':
              result = await testMethod.mutateAsync({
                url: baseUrl,
                method: 'ping',
                params: {},
                sessionId: currentSessionId
              })
              break

            case 'invalid-method':
              try {
                result = await testMethod.mutateAsync({
                  url: baseUrl,
                  method: 'invalid/method',
                  params: {},
                  sessionId: currentSessionId
                })
                // Should have failed
                if (!result.data.response?.error) {
                  throw new Error('Expected error for invalid method')
                }
              } catch (error) {
                // This is expected for this test
                result = { expected_error: true }
              }
              break

            case 'malformed-params':
              result = await testMethod.mutateAsync({
                url: baseUrl,
                method: 'tools/call',
                params: { invalid: 'params' },
                sessionId: currentSessionId
              })
              break

            case 'no-session':
              result = await testMethod.mutateAsync({
                url: baseUrl,
                method: 'tools/list',
                params: {},
                sessionId: undefined
              })
              break

            case 'response-time':
              const start = Date.now()
              result = await testMethod.mutateAsync({
                url: baseUrl,
                method: 'ping',
                params: {},
                sessionId: currentSessionId
              })
              const responseTime = Date.now() - start
              result.responseTime = responseTime
              break

            case 'concurrent':
              const promises = Array(5)
                .fill(0)
                .map(() =>
                  testMethod.mutateAsync({
                    url: baseUrl,
                    method: 'ping',
                    params: {},
                    sessionId: currentSessionId
                  })
                )
              const results = await Promise.all(promises)
              result = { concurrent_results: results.length }
              break

            default:
              throw new Error(`Unknown step: ${step.id}`)
          }

          step.status = 'success'
          step.result = result
        } catch (error) {
          step.status = 'error'
          step.error = error instanceof Error ? error.message : 'Unknown error'
        }

        // Update the scenario state
        setScenarios((prev) => prev.map((s) => (s.id === scenarioId ? updatedScenario : s)))

        // Small delay between steps
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      toast.success(`Scenario "${scenario.name}" completed`)
    } catch (error) {
      toast.error(`Scenario failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setRunningScenario(null)
    }
  }

  const resetScenario = (scenarioId: string) => {
    setScenarios((prev) =>
      prev.map((scenario) => {
        if (scenario.id === scenarioId) {
          return {
            ...scenario,
            steps: scenario.steps.map((step) => ({
              ...step,
              status: 'pending' as const,
              result: undefined,
              error: undefined
            }))
          }
        }
        return scenario
      })
    )
  }

  const getStepIcon = (status: TestStep['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className='h-4 w-4 animate-spin text-blue-500' />
      case 'success':
        return <CheckCircle className='h-4 w-4 text-green-500' />
      case 'error':
        return <XCircle className='h-4 w-4 text-red-500' />
      default:
        return <div className='h-4 w-4 rounded-full border-2 border-gray-300' />
    }
  }

  const getScenarioProgress = (scenario: TestScenario) => {
    const completed = scenario.steps.filter((s) => s.status === 'success' || s.status === 'error').length
    return (completed / scenario.steps.length) * 100
  }

  // Initialize scenarios on first render
  if (scenarios.length === 0) {
    setScenarios(createTestScenarios())
  }

  return (
    <div className='space-y-4'>
      <div className='mb-4'>
        <p className='text-sm text-gray-600'>
          Run predefined test scenarios to validate MCP protocol compliance and performance. These tests simulate
          real-world usage patterns.
        </p>
      </div>

      {scenarios.map((scenario) => (
        <Card key={scenario.id}>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='text-base'>{scenario.name}</CardTitle>
                <p className='text-sm text-gray-600 mt-1'>{scenario.description}</p>
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => resetScenario(scenario.id)}
                  disabled={runningScenario === scenario.id}
                >
                  <RotateCcw className='h-3 w-3' />
                </Button>
                <Button
                  size='sm'
                  onClick={() => runScenario(scenario.id)}
                  disabled={runningScenario !== null}
                  className='flex items-center gap-2'
                >
                  {runningScenario === scenario.id ? (
                    <Loader2 className='h-3 w-3 animate-spin' />
                  ) : (
                    <Play className='h-3 w-3' />
                  )}
                  Run
                </Button>
              </div>
            </div>

            {runningScenario === scenario.id && <Progress value={getScenarioProgress(scenario)} className='h-2' />}
          </CardHeader>

          <CardContent className='space-y-3'>
            {scenario.steps.map((step) => (
              <div key={step.id} className='flex items-start gap-3'>
                <div className='mt-0.5'>{getStepIcon(step.status)}</div>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2'>
                    <span className='font-medium text-sm'>{step.name}</span>
                    <Badge
                      variant={
                        step.status === 'success'
                          ? 'default'
                          : step.status === 'error'
                            ? 'destructive'
                            : step.status === 'running'
                              ? 'secondary'
                              : 'outline'
                      }
                      className='text-xs'
                    >
                      {step.status}
                    </Badge>
                  </div>
                  <p className='text-xs text-gray-600'>{step.description}</p>

                  {step.error && <div className='mt-1 text-xs text-red-600 bg-red-50 p-2 rounded'>{step.error}</div>}

                  {step.result && step.status === 'success' && (
                    <details className='mt-1'>
                      <summary className='text-xs cursor-pointer text-blue-600'>View result</summary>
                      <pre className='mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto'>
                        {JSON.stringify(step.result, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
