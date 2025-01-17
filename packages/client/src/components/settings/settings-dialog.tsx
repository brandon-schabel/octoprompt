import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Theme } from "shared/src/global-state/global-state-schema"
import * as themes from 'react-syntax-highlighter/dist/esm/styles/hljs'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select"
import { useGlobalStateHelpers } from "../global-state/use-global-state-helpers"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

type ThemeOption = {
    label: string;
    value: keyof typeof themes;
    theme: typeof themes.atomOneLight;
};

const themeOptions = Object.entries(themes).map(([key, theme]) => ({
    label: key
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .replace(/^[a-z]/, (str) => str.toUpperCase()),
    value: key as keyof typeof themes,
    theme: theme,
})) satisfies ThemeOption[];

type SettingsDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const { state, updateGlobalStateKey } = useGlobalStateHelpers()
    const isDarkMode = state?.settings.theme === 'dark'
    const settings = state?.settings
    const codeLightTheme = settings?.codeThemeLight ?? 'atomOneLight'
    const codeDarkTheme = settings?.codeThemeDark ?? 'atomOneDark'
    const ollamaUrl = settings?.ollamaGlobalUrl;
    const lmStudioUrl = settings?.lmStudioGlobalUrl;

    const handleThemeToggle = () => {
        const newTheme: Theme = isDarkMode ? 'light' : 'dark'
        updateGlobalStateKey('settings', (prev) => ({
            ...prev,
            theme: newTheme as Theme,
        }))
    }

    const handleSetCodeTheme = (value: string, isDark: boolean) => {
        const theme = themeOptions.find(t => t.value === value);
        if (!theme) return;

        updateGlobalStateKey('settings', (prev) => ({
            ...prev,
            ...(isDark ? { codeThemeDark: value } : { codeThemeLight: value }),
        }))
    }

    const handleUrlChange = (
        key: 'ollamaGlobalUrl' | 'lmStudioGlobalUrl',
        value: string
    ) => {
        updateGlobalStateKey('settings', (prev) => ({
            ...prev,
            [key]: value,
        }))
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-6 py-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="dark-mode" className="text-sm font-medium">
                            Dark Mode
                        </Label>
                        <Switch
                            id="dark-mode"
                            checked={isDarkMode}
                            onCheckedChange={handleThemeToggle}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="spacebar-select" className="text-sm font-medium">
                            Use Spacebar to Select Autocomplete
                        </Label>
                        <Switch
                            id="spacebar-select"
                            checked={settings?.useSpacebarToSelectAutocomplete ?? true}
                            onCheckedChange={(checked) => {
                                updateGlobalStateKey('settings', (prev) => ({
                                    ...prev,
                                    useSpacebarToSelectAutocomplete: checked,
                                }))
                            }}
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="ollama-url">Ollama URL</Label>
                            <Input
                                id="ollama-url"
                                placeholder="http://localhost:11434"
                                value={ollamaUrl}
                                onChange={(e) => handleUrlChange('ollamaGlobalUrl', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="lmstudio-url">LM Studio URL</Label>
                            <Input
                                id="lmstudio-url"
                                placeholder="http://localhost:1234"
                                value={lmStudioUrl}
                                onChange={(e) => handleUrlChange('lmStudioGlobalUrl', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <Label>Light Mode Code Theme</Label>
                            <Select
                                value={codeLightTheme}
                                onValueChange={(value) => handleSetCodeTheme(value, false)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select theme" />
                                </SelectTrigger>
                                <SelectContent>
                                    {themeOptions.map((theme) => (
                                        <SelectItem key={theme.value} value={theme.value}>
                                            {theme.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label>Dark Mode Code Theme</Label>
                            <Select
                                value={codeDarkTheme}
                                onValueChange={(value) => handleSetCodeTheme(value, true)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select theme" />
                                </SelectTrigger>
                                <SelectContent>
                                    {themeOptions.map((theme) => (
                                        <SelectItem key={theme.value} value={theme.value}>
                                            {theme.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
} 