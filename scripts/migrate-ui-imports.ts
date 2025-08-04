#!/usr/bin/env bun

import { readdir, readFile, writeFile } from 'fs/promises'
import { join, relative } from 'path'
import { glob } from 'glob'

const CLIENT_PATH = join(process.cwd(), 'packages/client')

// Component name mappings for components that have different names
const COMPONENT_MAPPINGS: Record<string, string> = {
  DraggableThreeColumnPanel: 'DndDraggableThreeColumnPanel',
  VerticalResizablePanel: 'DndVerticalResizablePanel',
  ThreeColumnResizablePanel: 'DndThreeColumnResizablePanel',
  ResizablePanel: 'DndResizablePanel'
}

// Components that need special handling for props/imports
const MARKDOWN_COMPONENTS = ['MarkdownPreview', 'MarkdownInlinePreview', 'MarkdownRenderer']

async function migrateFile(filePath: string): Promise<void> {
  let content = await readFile(filePath, 'utf-8')
  const originalContent = content
  let hasChanges = false

  // Pattern to match UI imports from various paths
  const importPatterns = [
    // Match: import { X } from '@/components/ui/Y'
    /import\s*{([^}]+)}\s*from\s*['"]@\/components\/ui\/([^'"]+)['"]/g,
    // Match: import { X } from './ui/Y' or '../ui/Y' etc
    /import\s*{([^}]+)}\s*from\s*['"](\.|\.\.)*\/ui\/([^'"]+)['"]/g,
    // Match: import X from '@/components/ui/Y'
    /import\s+(\w+)\s+from\s*['"]@\/components\/ui\/([^'"]+)['"]/g,
    // Match: import X from './ui/Y' or '../ui/Y' etc
    /import\s+(\w+)\s+from\s*['"](\.|\.\.)*\/ui\/([^'"]+)['"]/g
  ]

  // Handle named imports
  content = content.replace(
    /import\s*{([^}]+)}\s*from\s*['"](@\/components\/ui\/[^'"]+|(?:\.\.?\/)+ui\/[^'"]+)['"]/g,
    (match, imports, path) => {
      hasChanges = true

      // Parse and clean up imports
      const importList = imports
        .split(',')
        .map((imp: string) => imp.trim())
        .filter(Boolean)

      // Map component names if needed
      const mappedImports = importList.map((imp: string) => {
        const [importName, alias] = imp.split(/\s+as\s+/)
        const mappedName = COMPONENT_MAPPINGS[importName] || importName

        if (alias) {
          return `${mappedName} as ${alias}`
        } else if (importName !== mappedName) {
          return `${mappedName} as ${importName}`
        }
        return mappedName
      })

      return `import { ${mappedImports.join(', ')} } from '@promptliano/ui'`
    }
  )

  // Handle default imports
  content = content.replace(
    /import\s+(\w+)\s+from\s*['"](@\/components\/ui\/[^'"]+|(?:\.\.?\/)+ui\/[^'"]+)['"]/g,
    (match, importName) => {
      hasChanges = true
      const mappedName = COMPONENT_MAPPINGS[importName] || importName

      if (importName !== mappedName) {
        return `import { ${mappedName} as ${importName} } from '@promptliano/ui'`
      }
      return `import { ${importName} } from '@promptliano/ui'`
    }
  )

  // Handle type imports
  content = content.replace(
    /import\s*(?:type\s*)?{([^}]+)}\s*from\s*['"](@\/components\/ui\/[^'"]+|(?:\.\.?\/)+ui\/[^'"]+)['"]/g,
    (match, imports) => {
      if (match.includes('type')) {
        hasChanges = true

        const importList = imports
          .split(',')
          .map((imp: string) => imp.trim())
          .filter(Boolean)

        const mappedImports = importList.map((imp: string) => {
          const cleanImp = imp.replace(/^type\s+/, '')
          const [importName, alias] = cleanImp.split(/\s+as\s+/)
          const mappedName = COMPONENT_MAPPINGS[importName] || importName

          if (alias) {
            return `type ${mappedName} as ${alias}`
          } else if (importName !== mappedName) {
            return `type ${mappedName} as ${importName}`
          }
          return `type ${mappedName}`
        })

        return `import { ${mappedImports.join(', ')} } from '@promptliano/ui'`
      }
      return match
    }
  )

  // Update component usage for renamed components
  for (const [oldName, newName] of Object.entries(COMPONENT_MAPPINGS)) {
    // Only update JSX usage if we've aliased the import
    const hasAlias = content.includes(`${newName} as ${oldName}`)
    if (!hasAlias && content.includes(oldName)) {
      // Update JSX tags
      const jsxPattern = new RegExp(`<(/?)${oldName}([\\s>])`, 'g')
      content = content.replace(jsxPattern, `<$1${newName}$2`)
    }
  }

  // Special handling for Markdown components - add type prop if missing
  if (MARKDOWN_COMPONENTS.some((comp) => content.includes(comp))) {
    // Add type="preview" to MarkdownPreview if no type prop exists
    content = content.replace(
      /<MarkdownPreview\s+([^>]*?)(?<!type=["'][^"']*["'])\s*>/g,
      '<MarkdownPreview type="preview" $1>'
    )

    // Add type="inline" to MarkdownInlinePreview if no type prop exists
    content = content.replace(
      /<MarkdownInlinePreview\s+([^>]*?)(?<!type=["'][^"']*["'])\s*>/g,
      '<MarkdownInlinePreview type="inline" $1>'
    )
  }

  // Write file only if there were changes
  if (hasChanges && content !== originalContent) {
    await writeFile(filePath, content, 'utf-8')
    console.log(`✅ Updated: ${relative(CLIENT_PATH, filePath)}`)
  }
}

async function main() {
  console.log('🔍 Finding files with UI imports...')

  const files = await glob('**/*.{ts,tsx}', {
    cwd: join(CLIENT_PATH, 'src'),
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  })

  console.log(`📁 Found ${files.length} TypeScript files to check`)

  let updatedCount = 0

  for (const file of files) {
    const content = await readFile(file, 'utf-8')

    // Check if file has UI imports
    if (content.includes('@/components/ui/') || content.match(/from\s*['"](?:\.\.?\/)+ui\//)) {
      await migrateFile(file)
      updatedCount++
    }
  }

  console.log(`\n✨ Migration complete! Updated ${updatedCount} files.`)
}

main().catch(console.error)
