import { createFileRoute } from '@tanstack/react-router'
import { useGetKeys, useCreateKey, useDeleteKey } from '@/hooks/api/use-keys-api'
import { useState } from 'react'
import { Button } from '@ui'
import { Input } from '@ui'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui'
import { ExternalLinkIcon, Copy } from 'lucide-react'
import { PROVIDERS } from '@/constants/providers-constants'
import { OctoTooltip } from '@/components/octo/octo-tooltip'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'

export const Route = createFileRoute('/keys')({
  component: KeysPage
})

function KeysPage() {
  const { data: keys, isLoading } = useGetKeys()
  const createKeyMutation = useCreateKey()
  const deleteKeyMutation = useDeleteKey()
  const { copyToClipboard } = useCopyClipboard()

  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [newKeyVal, setNewKeyVal] = useState('')

  const selectedProviderDetails = PROVIDERS.find((p) => p.id === selectedProvider)

  const handleCreate = async () => {
    await createKeyMutation.mutateAsync({ provider: selectedProvider, key: newKeyVal })
    setSelectedProvider('')
    setNewKeyVal('')
  }

  const providerData = PROVIDERS.find((p) => p.id === selectedProvider)

  return (
    <div className='p-4 space-y-4 bg-secondary h-full'>
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <CardTitle>Provider Keys</CardTitle>
            <OctoTooltip>
              {`Provider keys let you tap into external AI services (e.g. OpenAI, OpenRouter). Adding these keys unlocks extra features like file suggestions, summarizations, generating ticket tasks. If no key is added, you can still use local LLMs in the chat.`}
            </OctoTooltip>
          </div>
          <CardDescription>Add API keys for different AI providers here.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div className='flex flex-col gap-4'>
              <div className='flex items-center gap-2'>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className='w-[200px]'>
                    <SelectValue placeholder='Select provider' />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder={
                    providerData?.isLocal ? 'No API Key needed, but might need local config' : 'Enter API key'
                  }
                  value={newKeyVal}
                  onChange={(e) => setNewKeyVal(e.target.value)}
                  type='password'
                  disabled={providerData?.isLocal ?? false}
                />
                <Button
                  onClick={handleCreate}
                  disabled={!selectedProvider || (!newKeyVal && !(providerData?.isLocal ?? false))}
                >
                  Add
                </Button>
              </div>

              {selectedProviderDetails && (
                <div className='text-sm text-muted-foreground'>
                  <p>{selectedProviderDetails.description}</p>
                  <a
                    href={selectedProviderDetails.link}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-primary inline-flex items-center hover:underline mt-1'
                  >
                    {selectedProviderDetails.linkTitle}
                    <ExternalLinkIcon className='ml-1 h-4 w-4' />
                  </a>
                </div>
              )}
            </div>

            {isLoading ? (
              <div>Loading keys...</div>
            ) : keys && keys.length > 0 ? (
              <ul className='space-y-2'>
                {keys.map((k) => (
                  <li key={k.id} className='flex items-center justify-between border p-2 rounded group'>
                    <div className='flex items-center gap-2'>
                      <div>
                        <div className='font-medium'>
                          {PROVIDERS.find((p) => p.id === k.provider)?.name || k.provider}
                        </div>
                        <div className='text-sm text-muted-foreground font-mono'>••••••••{k.key.slice(-4)}</div>
                      </div>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8'
                        onClick={() =>
                          copyToClipboard(k.key, {
                            successMessage: 'API key copied to clipboard',
                            errorMessage: 'Failed to copy API key'
                          })
                        }
                      >
                        <Copy className='h-4 w-4' />
                      </Button>
                    </div>
                    <Button variant='destructive' size='sm' onClick={() => deleteKeyMutation.mutate(k.id)}>
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className='text-sm text-muted-foreground'>
                <p className='mb-2'>
                  <strong>No keys added yet.</strong>
                </p>
                <p>
                  You can still chat with local LLMs without any keys. However, by adding
                  <strong> OpenAI </strong> or <strong> OpenRouter </strong> keys, you'll unlock advanced features like
                  file summarizations, file suggestions, and the ability to create tasks on tickets from chat.
                  <br />
                  <br />
                  Simply select a provider above, enter your key, and click <em>Add</em>.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
