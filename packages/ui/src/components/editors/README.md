# Editor Components

Monaco Editor components for code editing with syntax highlighting, diff viewing, and lazy loading support.

## Components

### MonacoEditorWrapper

A wrapper around Monaco Editor with keyboard shortcuts and theme support.

```tsx
import { MonacoEditorWrapper } from '@promptliano/ui'

// Basic usage
<MonacoEditorWrapper
  value={code}
  onChange={setCode}
  language="typescript"
  height="400px"
  theme="vs-dark"
/>

// With save handler
<MonacoEditorWrapper
  value={code}
  onChange={setCode}
  language="javascript"
  onSave={handleSave}
  theme={isDarkMode ? 'vs-dark' : 'light'}
/>
```

### MonacoDiffViewer

Side-by-side diff viewer for comparing code changes.

```tsx
import { MonacoDiffViewer } from '@promptliano/ui'

;<MonacoDiffViewer
  original={originalCode}
  modified={modifiedCode}
  language='typescript'
  height='400px'
  theme='vs-dark'
/>
```

### LazyMonacoEditor

Lazy-loaded version with fallback to textarea if Monaco fails to load.

```tsx
import { LazyMonacoEditor } from '@promptliano/ui'

;<LazyMonacoEditor value={code} onChange={setCode} language='python' theme={theme === 'dark' ? 'vs-dark' : 'light'} />
```

### LazyMonacoDiffViewer

Lazy-loaded diff viewer with simple fallback.

```tsx
import { LazyMonacoDiffViewer } from '@promptliano/ui'

;<LazyMonacoDiffViewer original={original} modified={modified} language='json' theme='vs-dark' />
```

## Theme Support

All components accept a `theme` prop with values:

- `'vs-dark'` - Dark theme
- `'light'` or `'vs'` - Light theme

For integration with your app's theme:

```tsx
import { useSelectSetting } from '@/hooks/use-kv-local-storage'
import { LazyMonacoEditor } from '@promptliano/ui'

function CodeEditor() {
  const theme = useSelectSetting('theme')

  return <LazyMonacoEditor value={code} onChange={setCode} theme={theme === 'dark' ? 'vs-dark' : 'light'} />
}
```

## Keyboard Shortcuts

The editor wrapper includes built-in shortcuts:

- `Ctrl/Cmd + S` - Trigger save (if onSave handler provided)
- `Ctrl/Cmd + Shift + F` - Format document

## Language Support

Monaco supports syntax highlighting for many languages including:

- typescript, javascript, json
- python, java, go, rust
- html, css, markdown
- yaml, xml, sql
- And many more...
