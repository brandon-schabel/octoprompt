import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Play, Copy, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useTestMCPMethod, useGetMCPTestData } from '@/hooks/api/use-mcp-api'

interface MCPMethodTesterProps {
  projectId: number
  sessionId?: string
}

export function MCPMethodTester({ projectId, sessionId }: MCPMethodTesterProps) {
  const [url, setUrl] = useState('')
  const [selectedMethod, setSelectedMethod] = useState('')
  const [params, setParams] = useState('')
  const [result, setResult] = useState<any>(null)

  const { data: testData } = useGetMCPTestData(projectId)
  const testMethod = useTestMCPMethod(projectId)

  // Pre-fill URL and load sample methods
  useEffect(() => {
    if (testData?.data?.mcpEndpoints?.projectSpecific) {
      setUrl(testData.data.mcpEndpoints.projectSpecific)
    }
  }, [testData])

  // Update params when method changes
  useEffect(() => {
    if (selectedMethod && testData?.data?.sampleMethods) {
      const method = testData.data.sampleMethods.find((m) => m.method === selectedMethod)
      if (method) {
        setParams(JSON.stringify(method.params, null, 2))
      }
    }
  }, [selectedMethod, testData])

  const handleExecute = async () => {
    if (!url || !selectedMethod) {
      toast.error('Please enter URL and select a method')
      return
    }

    let parsedParams
    try {
      parsedParams = params ? JSON.parse(params) : {}
    } catch (error) {
      toast.error('Invalid JSON in parameters')
      return
    }

    try {
      const result = await testMethod.mutateAsync({
        url,
        method: selectedMethod,
        params: parsedParams,
        sessionId
      })

      setResult(result.data)
      toast.success(`Method executed in ${result.data.responseTime}ms`)
    } catch (error) {
      toast.error('Method execution failed')
      setResult({ error: 'Request failed' })
    }
  }

  const loadExample = (method: string) => {
    const sampleMethod = testData?.data?.sampleMethods?.find((m) => m.method === method)
    if (sampleMethod) {
      setSelectedMethod(method)
      setParams(JSON.stringify(sampleMethod.params, null, 2))
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  return (
    <div className='space-y-4'>
      {/* URL Input */}
      <div className='space-y-2'>
        <Label htmlFor='method-url'>MCP Server URL</Label>
        <Input
          id='method-url'
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder='http://localhost:3147/api/projects/1/mcp'
        />
      </div>

      {/* Session ID Display */}
      {sessionId && (
        <div className='flex items-center gap-2 text-sm'>
          <Badge variant='outline'>Session: {sessionId}</Badge>
        </div>
      )}

      {/* Method Selection */}
      <div className='space-y-2'>
        <Label>JSON-RPC Method</Label>
        <div className='flex gap-2'>
          <Select value={selectedMethod} onValueChange={setSelectedMethod}>
            <SelectTrigger className='flex-1'>
              <SelectValue placeholder='Select a method' />
            </SelectTrigger>
            <SelectContent>
              {testData?.data?.sampleMethods?.map((method) => (
                <SelectItem key={method.method} value={method.method}>
                  <div className='flex flex-col'>
                    <span className='font-medium'>{method.method}</span>
                    <span className='text-xs text-gray-500'>{method.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Examples */}
      {testData?.data?.sampleMethods && (
        <div className='space-y-2'>
          <Label>Quick Examples</Label>
          <div className='flex flex-wrap gap-2'>
            {testData.data.sampleMethods.map((method) => (
              <Button key={method.method} size='sm' variant='outline' onClick={() => loadExample(method.method)}>
                {method.method}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Parameters */}
      <div className='space-y-2'>
        <Label htmlFor='method-params'>Parameters (JSON)</Label>
        <Textarea
          id='method-params'
          value={params}
          onChange={(e) => setParams(e.target.value)}
          placeholder='{"key": "value"}'
          className='font-mono text-sm'
          rows={8}
        />
      </div>

      {/* Execute Button */}
      <Button
        onClick={handleExecute}
        disabled={testMethod.isPending || !url || !selectedMethod}
        className='w-full flex items-center gap-2'
      >
        {testMethod.isPending ? <Loader2 className='h-4 w-4 animate-spin' /> : <Play className='h-4 w-4' />}
        Execute Method
      </Button>

      {/* Result */}
      {result && (
        <Card>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-base'>Response</CardTitle>
              <div className='flex items-center gap-2'>
                {result.responseTime && (
                  <div className='flex items-center gap-1 text-sm text-gray-600'>
                    <Clock className='h-3 w-3' />
                    {result.responseTime}ms
                  </div>
                )}
                <Button size='sm' variant='outline' onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}>
                  <Copy className='h-3 w-3' />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Request */}
            {result.request && (
              <div>
                <h5 className='font-medium mb-2'>Request</h5>
                <pre className='p-3 bg-gray-100 rounded text-xs overflow-auto'>
                  {JSON.stringify(result.request, null, 2)}
                </pre>
              </div>
            )}

            {/* Response */}
            {result.response && (
              <div>
                <div className='flex items-center justify-between mb-2'>
                  <h5 className='font-medium'>Response</h5>
                  <Badge variant={result.response.error ? 'destructive' : 'default'}>
                    {result.response.error ? 'Error' : 'Success'}
                  </Badge>
                </div>
                <pre className='p-3 bg-gray-100 rounded text-xs overflow-auto'>
                  {JSON.stringify(result.response, null, 2)}
                </pre>
              </div>
            )}

            {/* Error */}
            {result.error && (
              <div>
                <h5 className='font-medium mb-2 text-red-600'>Error</h5>
                <div className='p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700'>{result.error}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
