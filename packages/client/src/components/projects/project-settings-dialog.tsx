import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Settings } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { EDITOR_OPTIONS, type EditorType } from 'shared/src/global-state/global-state-schema'

type ProjectSettingsDialogProps = {
    resolveImports: boolean
    setResolveImports: (value: boolean) => void
    preferredEditor: EditorType
    setPreferredEditor: (value: EditorType) => void
    contextLimit: number
    setContextLimit: (value: number) => void
}

export function ProjectSettingsDialog({
    resolveImports,
    setResolveImports,
    preferredEditor,
    setPreferredEditor,
    contextLimit,
    setContextLimit,
}: ProjectSettingsDialogProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
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
                                    value={[contextLimit]}
                                    onValueChange={(val) => setContextLimit(val[0])}
                                    min={4000}
                                    max={1000000}
                                    step={1000}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
} 