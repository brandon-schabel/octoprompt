import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { APIProviders } from "shared"
import { useGetModels } from "@/hooks/api/use-chat-ai-api"
import { PROVIDER_SELECT_OPTIONS } from "@/constants/providers-constants"

type ModelSelectorProps = {
    provider: APIProviders
    currentModel: string
    onProviderChange: (provider: APIProviders) => void
    onModelChange: (modelId: string) => void
    className?: string
}

export function ModelSelector({
    provider,
    currentModel,
    onProviderChange,
    onModelChange,
    className
}: ModelSelectorProps) {
    const [modelComboboxOpen, setModelComboboxOpen] = useState(false)
    const { data, isLoading: isLoadingModels } = useGetModels(provider)

    const modelOptions = data?.data.map((m) => ({
        id: m.id,
        displayName: m.name,
        description: m.description || '',
    })) ?? []

    // Auto-select first model when options become available and no model is selected
    // or when current model is not available in the selected provider
    useEffect(() => {
        // Check if the current model is valid for the selected provider
        const isCurrentModelValid = modelOptions.some(model => model.id === currentModel)
        
        if ((!currentModel || !isCurrentModelValid) && modelOptions.length > 0) {
            onModelChange(modelOptions[0].id)
        }
    }, [modelOptions, currentModel, onModelChange])

    // Helper function to truncate text
    const truncateText = (text: string, maxLength = 24) => {
        return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
    }

    return (
        <div className={`flex gap-4 ${className}`}>
            {/* Provider Selection */}
            <div className="flex flex-col gap-2">
                {/* <label className="text-xs text-muted-foreground">Provider</label> */}
                <Select
                    value={provider}
                    onValueChange={(val) => onProviderChange(val as APIProviders)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                        {PROVIDER_SELECT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                 
                    </SelectContent>
                </Select>
            </div>

            {/* Model Selection */}
            <div className="flex flex-col gap-2">
                {/* <label className="text-xs text-muted-foreground">Model</label> */}
                <Popover
                    open={modelComboboxOpen}
                    onOpenChange={setModelComboboxOpen}
                >
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className="w-full justify-between"
                            disabled={isLoadingModels || modelOptions.length === 0}
                        >
                            {isLoadingModels
                                ? 'Loading models...'
                                : modelOptions.length === 0
                                    ? 'No models available'
                                    : currentModel
                                        ? truncateText(
                                            modelOptions.find((m) => m.id === currentModel)?.displayName ?? ''
                                        )
                                        : 'Select a model'}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[300px]">
                        <Command>
                            <CommandInput placeholder="Search models..." />
                            <CommandList>
                                <CommandEmpty>
                                    {isLoadingModels ? 'Loading models...' : 'No models available.'}
                                </CommandEmpty>
                                {modelOptions.map((model) => (
                                    <CommandItem
                                        key={model.id}
                                        onSelect={() => {
                                            onModelChange(model.id)
                                            setModelComboboxOpen(false)
                                        }}
                                        className="flex flex-col items-start"
                                    >
                                        <div className="font-medium">{model.displayName}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {model.description}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    )
} 