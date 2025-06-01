import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ui'
import { Switch } from '@ui'
import * as themes from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui'
import { Label } from '@ui'
import { Input } from '@ui'
import { ScrollArea } from '@ui'
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
import { Theme } from '@octoprompt/schemas'
import { useAppSettings } from '@/hooks/use-kv-local-storage'

type ThemeOption = {
  label: string
  value: keyof typeof themes
  theme: typeof themes.atomOneLight
}

const themeOptions = Object.entries(themes).map(([key, theme]) => ({
  label: key
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^[a-z]/, (str) => str.toUpperCase()),
  value: key as keyof typeof themes,
  theme: theme
})) satisfies ThemeOption[]

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [settings, updateSettings] = useAppSettings()
  const {
    useSpacebarToSelectAutocomplete: spacebarToSelectAutocomplete = true,
    hideInformationalTooltips,
    autoScrollEnabled,
    ollamaGlobalUrl,
    lmStudioGlobalUrl,
    codeThemeDark,
    codeThemeLight,
    theme
  } = settings
  const isDarkMode = theme === 'dark'

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useLocalStorage('autoRefreshEnabled', true)

  const handleThemeToggle = () => {
    const newTheme: Theme = isDarkMode ? 'light' : 'dark'
    updateSettings({
      theme: newTheme as Theme
    })
  }

  const handleSetCodeTheme = (value: string, isDark: boolean) => {
    const theme = themeOptions.find((t) => t.value === value)
    if (!theme) return

    updateSettings({
      ...(isDark ? { codeThemeDark: value } : { codeThemeLight: value })
    })
  }

  const handleUrlChange = (key: 'ollamaGlobalUrl' | 'lmStudioGlobalUrl', value: string) => {
    updateSettings({
      [key]: value
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px] max-h-[85vh] p-0 flex flex-col'>
        <DialogHeader className='p-6 pb-0'>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <ScrollArea className='px-6 pb-6'>
          <div className='flex flex-col gap-6 py-4'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='auto-refresh' className='text-sm font-medium'>
                Auto-refresh on Window Focus
              </Label>
              <Switch id='auto-refresh' checked={autoRefreshEnabled} onCheckedChange={setAutoRefreshEnabled} />
            </div>

            <div className='flex items-center justify-between'>
              <Label htmlFor='dark-mode' className='text-sm font-medium'>
                Dark Mode
              </Label>
              <Switch id='dark-mode' checked={isDarkMode} onCheckedChange={handleThemeToggle} />
            </div>

            <div className='flex items-center justify-between'>
              <Label htmlFor='auto-scroll' className='text-sm font-medium'>
                Auto-scroll Chat Messages
              </Label>
              <Switch
                id='auto-scroll'
                checked={autoScrollEnabled}
                onCheckedChange={(checked) => {
                  updateSettings({
                    autoScrollEnabled: checked
                  })
                }}
              />
            </div>

            <div className='flex items-center justify-between'>
              <Label htmlFor='spacebar-select' className='text-sm font-medium'>
                Use Spacebar to Select Autocomplete
              </Label>
              <Switch
                id='spacebar-select'
                checked={spacebarToSelectAutocomplete}
                onCheckedChange={(checked) => {
                  updateSettings({
                    useSpacebarToSelectAutocomplete: checked
                  })
                }}
              />
            </div>

            <div className='flex items-center justify-between'>
              <Label htmlFor='hide-informational-tooltips' className='text-sm font-medium'>
                Hide Informational Tooltips
              </Label>
              <Switch
                id='hide-informational-tooltips'
                checked={hideInformationalTooltips}
                onCheckedChange={(checked) => {
                  updateSettings({
                    hideInformationalTooltips: checked
                  })
                }}
              />
            </div>

            <div className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='ollama-url'>Ollama URL</Label>
                <Input
                  id='ollama-url'
                  placeholder='http://localhost:11434'
                  value={ollamaGlobalUrl}
                  onChange={(e) => handleUrlChange('ollamaGlobalUrl', e.target.value)}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='lmstudio-url'>LM Studio URL</Label>
                <Input
                  id='lmstudio-url'
                  placeholder='http://localhost:1234'
                  value={lmStudioGlobalUrl}
                  onChange={(e) => handleUrlChange('lmStudioGlobalUrl', e.target.value)}
                />
              </div>
            </div>

            <div className='space-y-4'>
              <div className='flex flex-col gap-2'>
                <Label>Light Mode Code Theme</Label>
                <Select value={codeThemeLight} onValueChange={(value) => handleSetCodeTheme(value, false)}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select theme' />
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

              <div className='flex flex-col gap-2'>
                <Label>Dark Mode Code Theme</Label>
                <Select value={codeThemeDark} onValueChange={(value) => handleSetCodeTheme(value, true)}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select theme' />
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
