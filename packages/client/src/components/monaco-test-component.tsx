/**
 * Monaco Editor Configuration and Integration Test
 * 
 * This file demonstrates and tests the Monaco Editor integration with OctoPrompt.
 * It includes:
 * 1. Language detection for various file types
 * 2. Theme integration with the app's dark/light mode
 * 3. Keyboard shortcuts (Ctrl+S for save, Ctrl+Shift+F for format)
 * 4. Fallback handling when Monaco fails to load
 * 5. Diff viewer integration for AI file changes
 */

import { useState } from 'react'
import { LazyMonacoEditor } from './lazy-monaco-editor'
import { LazyMonacoDiffViewer } from './lazy-monaco-diff-viewer'
import { Button } from '@ui'
import { Card, CardHeader, CardTitle, CardContent } from '@ui'

// Sample code for different languages to test Monaco syntax highlighting
const sampleCode = {
  typescript: `interface User {
  id: number
  name: string
  email: string
}

export function greetUser(user: User): string {
  return \`Hello, \${user.name}!\`
}`,
  
  javascript: `function fibonacci(n) {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}

console.log(fibonacci(10))`,
  
  python: `def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)`,
  
  json: `{
  "name": "octoprompt",
  "version": "0.5.3",
  "features": [
    "monaco-editor",
    "ai-integration",
    "project-management"
  ]
}`
}

const diffSample = {
  original: `function calculateTotal(items) {
  let total = 0
  for (let i = 0; i < items.length; i++) {
    total += items[i].price
  }
  return total
}`,
  
  modified: `function calculateTotal(items) {
  return items.reduce((total, item) => total + item.price, 0)
}`
}

export function MonacoTestComponent() {
  const [selectedLanguage, setSelectedLanguage] = useState<keyof typeof sampleCode>('typescript')
  const [code, setCode] = useState(sampleCode[selectedLanguage])
  const [showDiff, setShowDiff] = useState(false)

  const handleLanguageChange = (language: keyof typeof sampleCode) => {
    setSelectedLanguage(language)
    setCode(sampleCode[language])
  }

  const handleSave = () => {
    console.log('Save triggered via Ctrl+S')
    alert('File saved! (This would normally save to the project)')
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Monaco Editor Integration Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Language Selector */}
          <div className="flex gap-2">
            {Object.keys(sampleCode).map((lang) => (
              <Button
                key={lang}
                variant={selectedLanguage === lang ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleLanguageChange(lang as keyof typeof sampleCode)}
              >
                {lang}
              </Button>
            ))}
          </div>

          {/* Monaco Editor */}
          <div className="border rounded-md">
            <LazyMonacoEditor
              value={code}
              onChange={(value) => setCode(value || '')}
              language={selectedLanguage}
              height="300px"
              onSave={handleSave}
            />
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Test Instructions:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Try switching between different languages to test syntax highlighting</li>
              <li>Press <kbd>Ctrl+S</kbd> (or <kbd>Cmd+S</kbd> on Mac) to test save functionality</li>
              <li>Press <kbd>Ctrl+Shift+F</kbd> to test code formatting</li>
              <li>Edit the code to test real-time syntax highlighting</li>
              <li>The editor should respect your app's dark/light theme setting</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Diff Viewer Test */}
      <Card>
        <CardHeader>
          <CardTitle>Monaco Diff Viewer Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => setShowDiff(!showDiff)}
            variant="outline"
          >
            {showDiff ? 'Hide' : 'Show'} Diff Viewer
          </Button>

          {showDiff && (
            <div className="border rounded-md">
              <LazyMonacoDiffViewer
                original={diffSample.original}
                modified={diffSample.modified}
                language="javascript"
                height="300px"
              />
            </div>
          )}

          {showDiff && (
            <div className="text-sm text-muted-foreground">
              <p><strong>Diff Test:</strong> This shows a side-by-side comparison of code changes, useful for AI-generated file modifications.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}