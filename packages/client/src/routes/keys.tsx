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
import { PROVIDERS } from '@/constants/providers-constants'
import { InfoTooltip } from '@/components/info-tooltip'

export const Route = createFileRoute('/keys')({
    component: KeysPage
})

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
                    <div className="flex items-center gap-2">
                        <CardTitle>Provider Keys</CardTitle>
                        <InfoTooltip  >
                            {`Provider keys are API keys required to use different AI services. \n Each provider (like OpenAI, Anthropic) needs its own key which you can get from their website. Links will be shown for each selected provider. Once added, you can use their AI models in the app.`}
                        </InfoTooltip>
                    </div>
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
                                        href={selectedProviderDetails.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary inline-flex items-center hover:underline mt-1"
                                    >
                                        {selectedProviderDetails.linkTitle}
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