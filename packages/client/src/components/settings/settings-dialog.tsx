import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { useGlobalStateContext } from "../global-state-context"
import { Theme } from "shared/src/global-state/global-state-schema"
import * as themes from 'react-syntax-highlighter/dist/esm/styles/hljs'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select"

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
    const { state, updateGlobalStateKey } = useGlobalStateContext()
    const isDarkMode = state?.settings.theme === 'dark'
    const settings = state?.settings
    const codeLightTheme = settings?.codeThemeLight ?? 'atomOneLight'
    const codeDarkTheme = settings?.codeThemeDark ?? 'atomOneDark'

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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    <div className="flex items-center justify-between">
                        <label htmlFor="dark-mode" className="text-sm font-medium">
                            Dark Mode
                        </label>
                        <Switch
                            id="dark-mode"
                            checked={isDarkMode}
                            onCheckedChange={handleThemeToggle}
                        />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">
                            Light Mode Code Theme
                        </label>
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
                        <label className="text-sm font-medium">
                            Dark Mode Code Theme
                        </label>
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
            </DialogContent>
        </Dialog>
    )
} 