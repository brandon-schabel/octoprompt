#!/usr/bin/env bun

import { readFile, writeFile } from 'fs/promises'
import { glob } from 'glob'
import { join, relative } from 'path'

const CLIENT_PATH = join(process.cwd(), 'packages/client')

async function fixUIImports(filePath: string): Promise<boolean> {
  let content = await readFile(filePath, 'utf-8')
  const originalContent = content

  // Replace all @ui imports with @promptliano/ui
  content = content.replace(/from ['"]@ui['"](\s*$|(?=\s*\/\/))/gm, "from '@promptliano/ui'$1")

  // Replace @ui/component imports with @promptliano/ui
  content = content.replace(/from ['"]@ui\/[^'"]+['"](\s*$|(?=\s*\/\/))/gm, "from '@promptliano/ui'$1")

  if (content !== originalContent) {
    await writeFile(filePath, content, 'utf-8')
    console.log(`✅ Fixed: ${relative(CLIENT_PATH, filePath)}`)
    return true
  }

  return false
}

async function main() {
  console.log('🔍 Finding files with @ui imports...')

  const files = await glob('**/*.{ts,tsx}', {
    cwd: join(CLIENT_PATH, 'src'),
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  })

  let fixedCount = 0

  for (const file of files) {
    const content = await readFile(file, 'utf-8')

    // Check if file has @ui imports
    if (
      content.includes("from '@ui'") ||
      content.includes('from "@ui"') ||
      content.includes("from '@ui/") ||
      content.includes('from "@ui/')
    ) {
      const fixed = await fixUIImports(file)
      if (fixed) fixedCount++
    }
  }

  console.log(`\n✨ Fixed ${fixedCount} files with @ui imports.`)
}

main().catch(console.error)
