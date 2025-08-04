import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { settingsSearchSchema, type SettingsSearch } from '@/lib/search-schemas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Switch } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import * as themes from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage'
import { Theme } from '@promptliano/schemas'
import { useAppSettings } from '@/hooks/use-kv-local-storage'
import { MCPGlobalConfigEditor } from '@/components/settings/mcp-global-config-editor'

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

export function SettingsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [settings, updateSettings] = useAppSettings()
  const {
    useSpacebarToSelectAutocomplete: spacebarToSelectAutocomplete = true,
    hideInformationalTooltips,
    autoScrollEnabled,
    ollamaGlobalUrl,
    lmStudioGlobalUrl,
    codeThemeDark,
    codeThemeLight,
    theme,
    enableChatAutoNaming = true
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
    <div className='container mx-auto p-6 space-y-6'>
      <div>
        <h1 className='text-3xl font-bold'>Settings</h1>
        <p className='text-muted-foreground'>Manage your application preferences and configuration</p>
      </div>

      <Tabs
        value={search.tab || 'general'}
        onValueChange={(value) => {
          navigate({
            to: '/settings',
            search: { tab: value as SettingsSearch['tab'] },
            replace: true
          })
        }}
        className='w-full'
      >
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='general'>General</TabsTrigger>
          <TabsTrigger value='local-providers'>Local Model Providers</TabsTrigger>
          <TabsTrigger value='global-mcp'>Global MCP</TabsTrigger>
        </TabsList>

        <TabsContent value='general' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure general application preferences</CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chat Settings</CardTitle>
              <CardDescription>Configure chat behavior and automatic features</CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='auto-name-chats' className='text-sm font-medium'>
                  Auto-name Chats
                </Label>
                <Switch
                  id='auto-name-chats'
                  checked={enableChatAutoNaming}
                  onCheckedChange={(checked) => {
                    updateSettings({
                      enableChatAutoNaming: checked
                    })
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Code Editor Themes</CardTitle>
              <CardDescription>Customize syntax highlighting themes for code blocks</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='local-providers' className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>Local Model Providers</CardTitle>
              <CardDescription>Configure API endpoints for local model providers</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='global-mcp' className='space-y-6'>
          <MCPGlobalConfigEditor />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export const Route = createFileRoute('/settings')({
  validateSearch: zodValidator(settingsSearchSchema),
  component: SettingsPage
})
