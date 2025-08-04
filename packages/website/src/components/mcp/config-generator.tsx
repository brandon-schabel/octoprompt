import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GlassCard, CodeBlock } from '@/components/ui'
import { HeroButton } from '@/components/ui/hero-button'
import { Download, Copy, Check, Plus, Trash2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input, Label, Switch, Button } from '@promptliano/ui'

const ConfigSchema = z.object({
  serverName: z.string().min(1, 'Server name is required'),
  command: z.string().min(1, 'Command is required'),
  args: z.array(z.string()).default(['start', '--mcp']),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  autoStart: z.boolean().default(true),
  restartOnFailure: z.boolean().default(true),
  maxRestarts: z.number().min(0).default(3),
  timeout: z.number().min(1000).default(30000),
  capabilities: z.object({
    tools: z.boolean().default(true),
    resources: z.boolean().default(true),
    prompts: z.boolean().default(true)
  })
})

type ConfigFormData = z.infer<typeof ConfigSchema>

interface GeneratedConfig {
  mcpServers: Record<string, any>
}

export function ConfigGenerator() {
  const [generatedConfig, setGeneratedConfig] = useState<GeneratedConfig | null>(null)
  const [copied, setCopied] = useState(false)
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>([])

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<ConfigFormData>({
    resolver: zodResolver(ConfigSchema),
    defaultValues: {
      serverName: 'promptliano',
      command: 'promptliano',
      args: ['start', '--mcp'],
      cwd: '~',
      autoStart: true,
      restartOnFailure: true,
      maxRestarts: 3,
      timeout: 30000,
      capabilities: {
        tools: true,
        resources: true,
        prompts: true
      }
    }
  })

  const onSubmit = (data: ConfigFormData) => {
    const env = envPairs.reduce(
      (acc, pair) => {
        if (pair.key) acc[pair.key] = pair.value
        return acc
      },
      {} as Record<string, string>
    )

    const config: GeneratedConfig = {
      mcpServers: {
        [data.serverName]: {
          command: data.command,
          args: data.args.filter((arg) => arg.trim()),
          ...(data.cwd && { cwd: data.cwd }),
          ...(Object.keys(env).length > 0 && { env }),
          settings: {
            autoStart: data.autoStart,
            restartOnFailure: data.restartOnFailure,
            maxRestarts: data.maxRestarts,
            timeout: data.timeout
          },
          capabilities: data.capabilities
        }
      }
    }

    setGeneratedConfig(config)
  }

  const handleCopy = async () => {
    if (generatedConfig) {
      await navigator.clipboard.writeText(JSON.stringify(generatedConfig, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    if (generatedConfig) {
      const blob = new Blob([JSON.stringify(generatedConfig, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mcp.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const addEnvPair = () => {
    setEnvPairs([...envPairs, { key: '', value: '' }])
  }

  const removeEnvPair = (index: number) => {
    setEnvPairs(envPairs.filter((_, i) => i !== index))
  }

  const updateEnvPair = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envPairs]
    updated[index][field] = value
    setEnvPairs(updated)
  }

  return (
    <div className='space-y-8'>
      <div className='text-center'>
        <h2 className='text-3xl font-bold mb-4'>MCP Configuration Generator</h2>
        <p className='text-muted-foreground max-w-2xl mx-auto'>
          Generate a custom MCP configuration file for your editor with all the settings you need
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className='grid md:grid-cols-2 gap-8'>
        {/* Configuration Form */}
        <div className='space-y-6'>
          <GlassCard className='p-6'>
            <h3 className='text-xl font-semibold mb-4 flex items-center gap-2'>
              <Settings className='w-5 h-5' />
              Basic Settings
            </h3>

            <div className='space-y-4'>
              <div>
                <Label htmlFor='serverName'>Server Name</Label>
                <Controller
                  name='serverName'
                  control={control}
                  render={({ field }) => <Input {...field} id='serverName' type='text' placeholder='promptliano' />}
                />
                {errors.serverName && <p className='text-sm text-red-500 mt-1'>{errors.serverName.message}</p>}
              </div>

              <div>
                <Label htmlFor='command'>Command</Label>
                <Controller
                  name='command'
                  control={control}
                  render={({ field }) => <Input {...field} id='command' type='text' placeholder='promptliano' />}
                />
                {errors.command && <p className='text-sm text-red-500 mt-1'>{errors.command.message}</p>}
              </div>

              <div>
                <Label htmlFor='args'>Arguments</Label>
                <Controller
                  name='args'
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id='args'
                      value={field.value.join(' ')}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(e.target.value.split(' '))}
                      type='text'
                      placeholder='start --mcp'
                    />
                  )}
                />
              </div>

              <div>
                <Label htmlFor='cwd'>Working Directory</Label>
                <Controller
                  name='cwd'
                  control={control}
                  render={({ field }) => <Input {...field} id='cwd' type='text' placeholder='~' />}
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-xl font-semibold mb-4'>Advanced Settings</h3>

            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='autoStart'>Auto Start</Label>
                <Controller
                  name='autoStart'
                  control={control}
                  render={({ field }) => (
                    <Switch id='autoStart' checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>

              <div className='flex items-center justify-between'>
                <Label htmlFor='restartOnFailure'>Restart on Failure</Label>
                <Controller
                  name='restartOnFailure'
                  control={control}
                  render={({ field }) => (
                    <Switch id='restartOnFailure' checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>

              <div>
                <Label htmlFor='maxRestarts'>Max Restarts</Label>
                <Controller
                  name='maxRestarts'
                  control={control}
                  render={({ field }) => <Input {...field} id='maxRestarts' type='number' min='0' />}
                />
              </div>

              <div>
                <Label htmlFor='timeout'>Timeout (ms)</Label>
                <Controller
                  name='timeout'
                  control={control}
                  render={({ field }) => <Input {...field} id='timeout' type='number' min='1000' step='1000' />}
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-xl font-semibold mb-4'>Environment Variables</h3>

            <div className='space-y-2'>
              {envPairs.map((pair, index) => (
                <div key={index} className='flex gap-2'>
                  <Input
                    type='text'
                    value={pair.key}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEnvPair(index, 'key', e.target.value)}
                    placeholder='KEY'
                    className='flex-1'
                  />
                  <Input
                    type='text'
                    value={pair.value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEnvPair(index, 'value', e.target.value)}
                    placeholder='VALUE'
                    className='flex-1'
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => removeEnvPair(index)}
                    className='text-red-500 hover:bg-red-500/10 hover:text-red-500'
                  >
                    <Trash2 className='w-4 h-4' />
                  </Button>
                </div>
              ))}

              <Button
                type='button'
                variant='outline'
                onClick={addEnvPair}
                className='w-full border-dashed hover:border-primary hover:bg-primary/5'
              >
                <Plus className='w-4 h-4 mr-2' />
                Add Environment Variable
              </Button>
            </div>
          </GlassCard>

          <GlassCard className='p-6'>
            <h3 className='text-xl font-semibold mb-4'>Capabilities</h3>

            <div className='space-y-4'>
              {(['tools', 'resources', 'prompts'] as const).map((capability) => (
                <div key={capability} className='flex items-center justify-between'>
                  <Label htmlFor={`capability-${capability}`} className='capitalize'>
                    {capability}
                  </Label>
                  <Controller
                    name={`capabilities.${capability}`}
                    control={control}
                    render={({ field }) => (
                      <Switch id={`capability-${capability}`} checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                </div>
              ))}
            </div>
          </GlassCard>

          <HeroButton type='submit' className='w-full'>
            Generate Configuration
          </HeroButton>
        </div>

        {/* Generated Config Preview */}
        <div className='space-y-6'>
          <GlassCard className='p-6 sticky top-6'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-xl font-semibold'>Generated Configuration</h3>
              {generatedConfig && (
                <div className='flex gap-2'>
                  <button
                    type='button'
                    onClick={handleCopy}
                    className='p-2 rounded-lg hover:bg-primary/10 transition-colors'
                  >
                    {copied ? <Check className='w-4 h-4 text-green-500' /> : <Copy className='w-4 h-4' />}
                  </button>
                  <button
                    type='button'
                    onClick={handleDownload}
                    className='p-2 rounded-lg hover:bg-primary/10 transition-colors'
                  >
                    <Download className='w-4 h-4' />
                  </button>
                </div>
              )}
            </div>

            {generatedConfig ? (
              <CodeBlock code={JSON.stringify(generatedConfig, null, 2)} language='json' filename='mcp.json' />
            ) : (
              <div className='text-center py-12 text-muted-foreground'>
                <Settings className='w-12 h-12 mx-auto mb-4 opacity-50' />
                <p>Fill out the form and click "Generate Configuration" to see your custom MCP config</p>
              </div>
            )}
          </GlassCard>
        </div>
      </form>
    </div>
  )
}
