import { Button } from '@ui'
import { Switch } from '@ui'
import { Loader2, RefreshCw, Settings } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from '@ui'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@ui'
import { Input } from '@ui'
import { Slider } from '@ui'
import { useSyncProject, } from '@/hooks/api/use-projects-api'
import { useProjectTabField, useUpdateActiveProjectTab, useAppSettings } from '@/hooks/api/use-kv-api'
import { EDITOR_OPTIONS } from 'shared/src/schemas/global-state-schema'
import { EditorType } from 'shared/src/schemas/global-state-schema'
import { useEffect } from 'react'

export function ProjectSettingsDialog() {
    const updateActiveProjectTab = useUpdateActiveProjectTab()
    const { data: contextLimit } = useProjectTabField('contextLimit')
    const [{ summarizationEnabledProjectIds = [] }, updateSettings] = useAppSettings()
    const { data: resolveImports } = useProjectTabField('resolveImports')
    const { data: preferredEditor } = useProjectTabField('preferredEditor')
    const { data: projectId } = useProjectTabField('selectedProjectId')

    const isProjectSummarizationEnabled = projectId ? summarizationEnabledProjectIds?.includes(projectId) : false
    const { isPending: isSyncing, mutate: syncProject } = useSyncProject(projectId ?? '')


    // call sync project on interval
    useEffect(() => {
        if (projectId) {
            // start interval
            const interval = setInterval(() => {
                syncProject()
            }, 5000)
            return () => clearInterval(interval)
        }
    }, [projectId])


    const setContextLimit = (value: number) => {
        updateActiveProjectTab(prev => ({
            ...prev,
            contextLimit: value
        }))
    }

    const setPreferredEditor = (value: EditorType) => {
        // @ts-ignore
        updateActiveProjectTab(prev => ({
            ...prev,
            preferredEditor: value as EditorType
        }))
    }


    const setResolveImports = (value: boolean) => {
        updateActiveProjectTab(prev => ({
            ...prev,
            resolveImports: value
        }))
    }

    const setEnableProjectSummarization = (value: boolean) => {
        if (!projectId) return

        updateSettings(prev => ({
            ...prev,
            summarizationEnabledProjectIds: value
                ? [...(prev.summarizationEnabledProjectIds ?? []), projectId]
                : (prev.summarizationEnabledProjectIds ?? []).filter(id => id !== projectId)
        }))
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Settings className="h-4 w-4" />
                    Project
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Project Settings</DialogTitle>
                    <DialogDescription>
                        Configure your project preferences and behavior.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium">Enable Summarization</span>
                                <p className="text-sm text-muted-foreground">
                                    When enabled, files will be automatically summarized when added to the context.
                                </p>
                            </div>
                            <Switch
                                checked={isProjectSummarizationEnabled}
                                onCheckedChange={(check) => {
                                    setEnableProjectSummarization(check)
                                }}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium">Include Imports</span>
                                <p className="text-sm text-muted-foreground">
                                    For TypeScript files, automatically select all imported files when a file is selected.
                                    This recursively follows the import tree.
                                </p>
                            </div>
                            <Switch
                                checked={resolveImports}
                                onCheckedChange={(check) => {
                                    setResolveImports(check)
                                }}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium">Preferred Editor</span>
                                <p className="text-sm text-muted-foreground">
                                    Choose which editor to open files in when using the "Open in Editor" button (second icon on file hover).
                                </p>
                            </div>
                            <Select
                                value={preferredEditor}
                                onValueChange={(value) => setPreferredEditor(value as EditorType)}
                            >
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="Open files with" />
                                </SelectTrigger>
                                <SelectContent>
                                    {EDITOR_OPTIONS.map(option => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div>
                            <span className="text-sm font-medium">Context Size Limit</span>
                            <p className="text-sm text-muted-foreground">
                                Maximum number of tokens to include in the context when generating prompts.
                            </p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Input
                                type="number"
                                value={contextLimit}
                                onChange={(e) => setContextLimit(parseInt(e.target.value, 10) || 0)}
                                className="w-24"
                            />
                            <div className="flex-1">
                                <Slider
                                    value={[contextLimit ?? 128000]}
                                    onValueChange={(val) => setContextLimit(val[0])}
                                    min={4000}
                                    max={1000000}
                                    step={1000}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <div>
                        <span className="text-sm font-medium">Sync Project</span>
                        <p className="text-sm text-muted-foreground">
                            Manually refresh the project files to ensure your local view matches the current state of your codebase.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        disabled={isSyncing}
                        onClick={() => syncProject()}
                    >
                        {isSyncing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Sync
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
} 