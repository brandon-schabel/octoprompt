import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Alert,
  AlertDescription,
  Badge,
  Separator,
  ScrollArea
} from '@promptliano/ui'
import { Loader2, CheckCircle, XCircle, Info, TestTube, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useApiClient } from '@/hooks/api/use-api-client'
import type { CustomProviderFeatures, ProviderModel } from '@promptliano/schemas'

const customProviderFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  baseUrl: z.string().url('Must be a valid URL'),
  apiKey: z.string().min(1, 'API key is required'),
  customHeaders: z.record(z.string()).optional()
})

type CustomProviderFormValues = z.infer<typeof customProviderFormSchema>

interface CustomProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CustomProviderDialog({ open, onOpenChange, onSuccess }: CustomProviderDialogProps) {
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    compatible: boolean
    models: ProviderModel[]
    features: CustomProviderFeatures
  } | null>(null)
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([])
  const client = useApiClient()

  const form = useForm<CustomProviderFormValues>({
    resolver: zodResolver(customProviderFormSchema),
    defaultValues: {
      name: '',
      baseUrl: '',
      apiKey: '',
      customHeaders: {}
    }
  })

  const handleValidate = async () => {
    if (!client) {
      toast.error('API client not available')
      return
    }

    const values = form.getValues()
    
    // Convert headers array to object
    const headersObject = customHeaders.reduce((acc, header) => {
      if (header.key && header.value) {
        acc[header.key] = header.value
      }
      return acc
    }, {} as Record<string, string>)
    
    setIsValidating(true)
    setValidationResult(null)

    try {
      const response = await client.keys.validateCustomProvider({
        baseUrl: values.baseUrl,
        apiKey: values.apiKey,
        customHeaders: Object.keys(headersObject).length > 0 ? headersObject : undefined
      })

      if (response.data) {
        setValidationResult(response.data)
        if (response.data.compatible) {
          toast.success('Provider is OpenAI-compatible!')
        } else {
          toast.error('Provider is not OpenAI-compatible')
        }
      }
    } catch (error) {
      toast.error('Failed to validate provider')
      console.error('Validation error:', error)
    } finally {
      setIsValidating(false)
    }
  }

  const handleSubmit = async (values: CustomProviderFormValues) => {
    if (!client) {
      toast.error('API client not available')
      return
    }

    // Convert headers array to object
    const headersObject = customHeaders.reduce((acc, header) => {
      if (header.key && header.value) {
        acc[header.key] = header.value
      }
      return acc
    }, {} as Record<string, string>)

    try {
      await client.keys.createKey({
        name: values.name,
        provider: 'custom',
        key: values.apiKey,
        baseUrl: values.baseUrl,
        customHeaders: Object.keys(headersObject).length > 0 ? headersObject : undefined,
        isDefault: false
      })

      toast.success('Custom provider added successfully')
      onSuccess()
      handleClose()
    } catch (error) {
      toast.error('Failed to add custom provider')
      console.error('Error adding provider:', error)
    }
  }

  const handleClose = () => {
    form.reset()
    setValidationResult(null)
    setCustomHeaders([])
    onOpenChange(false)
  }

  const addHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }])
  }

  const removeHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index))
  }

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders]
    updated[index][field] = value
    setCustomHeaders(updated)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Custom OpenAI-Compatible Provider</DialogTitle>
          <DialogDescription>
            Configure any service that implements the OpenAI API specification (e.g., LocalAI, FastChat, vLLM)
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="My Custom Provider" />
                    </FormControl>
                    <FormDescription>A friendly name to identify this provider</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="baseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://api.example.com/v1" />
                    </FormControl>
                    <FormDescription>
                      The base URL of your OpenAI-compatible API (should end with /v1)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="sk-..." />
                    </FormControl>
                    <FormDescription>Your API key for authentication</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Custom Headers (Optional)</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={addHeader}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Header
                  </Button>
                </div>
                {customHeaders.length > 0 && (
                  <div className="space-y-2">
                    {customHeaders.map((header, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Header name"
                          value={header.key}
                          onChange={(e) => updateHeader(index, 'key', e.target.value)}
                        />
                        <Input
                          placeholder="Header value"
                          value={header.value}
                          onChange={(e) => updateHeader(index, 'value', e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeHeader(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleValidate}
                  disabled={!form.watch('baseUrl') || !form.watch('apiKey') || isValidating}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>
              </div>

              {validationResult && (
                <div className="space-y-4">
                  <Separator />
                  
                  <Alert variant={validationResult.compatible ? 'default' : 'destructive'}>
                    {validationResult.compatible ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {validationResult.compatible
                        ? 'Provider is OpenAI-compatible and ready to use!'
                        : 'Provider does not appear to be OpenAI-compatible. The /v1/models endpoint is not accessible.'}
                    </AlertDescription>
                  </Alert>

                  {validationResult.compatible && (
                    <>
                      <div>
                        <h4 className="text-sm font-medium mb-2">Available Models ({validationResult.models.length})</h4>
                        <ScrollArea className="h-32 border rounded-md p-2">
                          <div className="space-y-1">
                            {validationResult.models.map((model) => (
                              <div key={model.id} className="text-sm">
                                <span className="font-mono">{model.id}</span>
                                {model.description && (
                                  <span className="text-muted-foreground ml-2">- {model.description}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium mb-2">Detected Features</h4>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={validationResult.features.streaming ? 'default' : 'outline'}>
                            Streaming: {validationResult.features.streaming ? '✓' : '✗'}
                          </Badge>
                          <Badge variant={validationResult.features.functionCalling ? 'default' : 'outline'}>
                            Functions: {validationResult.features.functionCalling ? '✓' : '✗'}
                          </Badge>
                          <Badge variant={validationResult.features.structuredOutput ? 'default' : 'outline'}>
                            JSON Mode: {validationResult.features.structuredOutput ? '✓' : '✗'}
                          </Badge>
                          <Badge variant={validationResult.features.vision ? 'default' : 'outline'}>
                            Vision: {validationResult.features.vision ? '✓' : '✗'}
                          </Badge>
                          <Badge variant={validationResult.features.embeddings ? 'default' : 'outline'}>
                            Embeddings: {validationResult.features.embeddings ? '✓' : '✗'}
                          </Badge>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={form.handleSubmit(handleSubmit)}
            disabled={!validationResult?.compatible || form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Provider'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}