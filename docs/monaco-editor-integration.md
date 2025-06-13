# Monaco Editor Integration

This document describes the Monaco Editor integration in OctoPrompt, providing a modern code editing experience with syntax highlighting, IntelliSense, and advanced features.

## Overview

Monaco Editor is the code editor that powers VS Code. Our integration provides:

- **Syntax Highlighting** for 30+ programming languages
- **Keyboard Shortcuts** (Ctrl+S for save, Ctrl+Shift+F for format)
- **Theme Integration** with OctoPrompt's dark/light mode
- **Diff Viewer** for AI-generated file changes
- **Graceful Fallbacks** when Monaco fails to load

## Components

### MonacoEditorWrapper

The main Monaco Editor component with OctoPrompt-specific features:

- Theme switching based on app settings
- Keyboard shortcuts for save and format
- Language detection from file extensions
- Configurable options for different use cases

```tsx
<MonacoEditorWrapper
  value={content}
  onChange={(value) => setContent(value || '')}
  language='typescript'
  height='400px'
  onSave={handleSave}
/>
```

### MonacoDiffViewer

Side-by-side diff viewer for comparing code changes:

- Perfect for reviewing AI-generated modifications
- Supports all Monaco languages
- Respects theme settings

```tsx
<MonacoDiffViewer original={originalCode} modified={modifiedCode} language='javascript' height='300px' />
```

### LazyMonacoEditor

Lazy-loaded wrapper with fallback to textarea:

- Loads Monaco asynchronously to improve page load times
- Falls back to basic textarea if Monaco fails to load
- Provides loading skeleton while Monaco initializes

### LazyMonacoDiffViewer

Lazy-loaded diff viewer with fallback:

- Falls back to simple unified diff view if Monaco unavailable
- Maintains functionality in all scenarios

## Language Support

Automatic language detection for file extensions:

- TypeScript/JavaScript: `.ts`, `.tsx`, `.js`, `.jsx`
- Web: `.html`, `.css`, `.scss`, `.less`
- Data: `.json`, `.yaml`, `.yml`, `.xml`
- Documentation: `.md`
- Systems: `.py`, `.java`, `.cpp`, `.c`, `.cs`, `.php`, `.rb`, `.go`, `.rs`
- Shell: `.sh`, `.bash`, `.zsh`
- Config: `.dockerfile`

## Integration Points

### File Viewer Dialog

- Uses LazyMonacoEditor for file editing mode
- Maintains syntax highlighting in view mode with react-syntax-highlighter
- Keyboard shortcuts work in edit mode

### AI File Changes Dialog

- Uses LazyMonacoDiffViewer to show proposed changes
- Provides clear visual diff of modifications
- Language detection from file path

## Keyboard Shortcuts

| Shortcut       | Action               |
| -------------- | -------------------- |
| Ctrl+S (Cmd+S) | Save file            |
| Ctrl+Shift+F   | Format document      |
| Ctrl+/         | Toggle line comment  |
| Ctrl+]         | Indent line          |
| Ctrl+[         | Outdent line         |
| F1             | Open command palette |

## Configuration

Monaco Editor options are configured for optimal OctoPrompt experience:

```tsx
options={{
  readOnly: false,
  minimap: { enabled: false }, // Disabled for better UX in dialogs
  scrollBeyondLastLine: false,
  fontSize: 14,
  lineNumbers: 'on',
  glyphMargin: false,
  folding: true,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 3,
  renderValidationDecorations: 'on',
  wordWrap: 'on',
  automaticLayout: true,
  tabSize: 2,
  insertSpaces: true
}}
```

## Fallback Strategy

The integration is designed to gracefully handle failures:

1. **Monaco Available**: Full featured code editor with IntelliSense
2. **Monaco Loading**: Skeleton loader while initializing
3. **Monaco Failed**: Fallback to textarea (LazyMonacoEditor) or simple diff (LazyMonacoDiffViewer)

## Performance

- **Lazy Loading**: Components load asynchronously to avoid blocking initial page load
- **Code Splitting**: Monaco bundle is separate from main application bundle
- **CDN Loading**: Monaco assets can be served from CDN for faster loading

## Theme Integration

Monaco Editor automatically switches themes based on OctoPrompt's theme setting:

- **Dark Mode**: `vs-dark` theme
- **Light Mode**: `light` theme

Theme switching is reactive and immediate when user changes theme preference.

## Testing

Use the `MonacoTestComponent` to verify integration:

- Tests language switching and syntax highlighting
- Verifies keyboard shortcuts
- Demonstrates diff viewer functionality
- Confirms theme switching behavior

## Troubleshooting

### Monaco Fails to Load

- Check browser console for errors
- Verify Monaco CDN is accessible
- Fallback components should handle gracefully

### Syntax Highlighting Not Working

- Verify file extension is in language map
- Check if language is supported by Monaco
- Add new extensions to `getLanguageByExtension` function

### Theme Not Switching

- Verify `useSelectSetting('theme')` returns correct value
- Check if theme setting is properly synchronized
- Ensure Monaco component re-renders on theme change

## Future Enhancements

Potential improvements for the Monaco integration:

- **TypeScript IntelliSense** with project context
- **Custom Themes** matching OctoPrompt brand
- **Collaborative Editing** for team features
- **Vim/Emacs Keybindings** for power users
- **Custom Language Support** for domain-specific files
