import { createFileRoute } from '@tanstack/react-router'
import { useGetKeys, useCreateKey, useDeleteKey } from '@/hooks/api/use-keys-api'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ExternalLinkIcon } from '@radix-ui/react-icons'

export const Route = createFileRoute('/keys')({
    component: KeysPage
})

type Provider = {
    id: string
    name: string
    apiKeyUrl: string
    description: string
}

const PROVIDERS = [
    {
        id: 'openai',
        name: 'OpenAI',
        apiKeyUrl: 'https://platform.openai.com/api-keys',
        description: 'API keys for GPT-4, GPT-3.5, and other OpenAI models'
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        apiKeyUrl: 'https://openrouter.ai/settings/keys',
        description: 'Access to multiple LLM providers through a single API'
    },
    {
        id: 'xai',
        name: "XAI",
        apiKeyUrl: "https://console.x.ai",
        description: "XAI API keys for Grok models"
    },
    {
        id: 'google_gemini',
        name: 'Google Gemini',
        apiKeyUrl: 'https://aistudio.google.com/app/apikey',
        description: 'API keys for Google Gemini models (including Gemini Pro and Ultra)'
    },
] satisfies Provider[]

function KeysPage() {
    const { data: keys, isLoading } = useGetKeys();
    const createKeyMutation = useCreateKey();
    const deleteKeyMutation = useDeleteKey();

    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [newKeyVal, setNewKeyVal] = useState('');

    const selectedProviderDetails = PROVIDERS.find(p => p.id === selectedProvider);

    const handleCreate = async () => {
        await createKeyMutation.mutateAsync({ provider: selectedProvider, key: newKeyVal });
        setSelectedProvider('');
        setNewKeyVal('');
    }

    return (
        <div className="p-4 space-y-4 bg-secondary h-full">
            <Card>
                <CardHeader>
                    <CardTitle>Provider Keys</CardTitle>
                    <CardDescription>Add API keys for different AI providers</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Select provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROVIDERS.map(provider => (
                                            <SelectItem key={provider.id} value={provider.id}>
                                                {provider.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Input
                                    placeholder="Enter API key"
                                    value={newKeyVal}
                                    onChange={e => setNewKeyVal(e.target.value)}
                                    type="password"
                                />
                                <Button onClick={handleCreate} disabled={!selectedProvider || !newKeyVal}>
                                    Add
                                </Button>
                            </div>

                            {selectedProviderDetails && (
                                <div className="text-sm text-muted-foreground">
                                    <p>{selectedProviderDetails.description}</p>
                                    <a
                                        href={selectedProviderDetails.apiKeyUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary inline-flex items-center hover:underline mt-1"
                                    >
                                        Get API key
                                        <ExternalLinkIcon className="ml-1 h-4 w-4" />
                                    </a>
                                </div>
                            )}
                        </div>

                        {isLoading ? (
                            <div>Loading keys...</div>
                        ) : keys && keys.length > 0 ? (
                            <ul className="space-y-2">
                                {keys.map(k => (
                                    <li key={k.id} className="flex items-center justify-between border p-2 rounded">
                                        <div>
                                            <div className="font-medium">
                                                {PROVIDERS.find(p => p.id === k.provider)?.name || k.provider}
                                            </div>
                                            <div className="text-sm text-muted-foreground font-mono">
                                                ••••••••{k.key.slice(-4)}
                                            </div>
                                        </div>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => deleteKeyMutation.mutate(k.id)}
                                        >
                                            Delete
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div>No keys added yet.</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}