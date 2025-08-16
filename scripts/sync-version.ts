#!/usr/bin/env bun

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { appConfig } from '../packages/config/src/configs/app.config'

const ROOT_DIR = join(import.meta.dir, '..')
const VERSION = appConfig.version

interface PackageJson {
  version?: string
  [key: string]: any
}

async function updateJsonFile(filePath: string, updateFn: (data: any) => any) {
  try {
    const content = await readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    const updatedData = updateFn(data)
    await writeFile(filePath, JSON.stringify(updatedData, null, 2) + '\n')
    console.log(`✅ Updated ${filePath}`)
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}:`, error)
  }
}


async function updateTypeScriptFile(filePath: string, patterns: Array<{ search: RegExp; replace: string }>) {
  try {
    let content = await readFile(filePath, 'utf-8')
    let hasChanges = false

    for (const pattern of patterns) {
      const newContent = content.replace(pattern.search, pattern.replace)
      if (newContent !== content) {
        hasChanges = true
        content = newContent
      }
    }

    if (hasChanges) {
      await writeFile(filePath, content)
      console.log(`✅ Updated ${filePath}`)
    }
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}:`, error)
  }
}

async function updateMarkdownFile(filePath: string) {
  try {
    let content = await readFile(filePath, 'utf-8')

    // Update version references
    content = content.replace(/v\d+\.\d+\.\d+/g, `v${VERSION}`)

    // Update download URLs
    content = content.replace(/promptliano-\d+\.\d+\.\d+-/g, `promptliano-${VERSION}-`)

    // Update folder references
    content = content.replace(/cd promptliano-\d+\.\d+\.\d+-/g, `cd promptliano-${VERSION}-`)

    await writeFile(filePath, content)
    console.log(`✅ Updated ${filePath}`)
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}:`, error)
  }
}

async function syncVersions() {
  console.log(`🔄 Syncing version ${VERSION} across all files...\n`)

  // Update root package.json
  await updateJsonFile(join(ROOT_DIR, 'package.json'), (data: PackageJson) => ({
    ...data,
    version: VERSION
  }))

  // Update all package.json files in packages directory
  const packages = [
    'client',
    'server',
    'website',
    'api-client',
    'brand-kit',
    'mcp-client',
    'promptliano',
    'schemas',
    'services',
    'shared',
    'storage',
    'config',
    'ui'
  ]

  for (const pkg of packages) {
    await updateJsonFile(join(ROOT_DIR, 'packages', pkg, 'package.json'), (data: PackageJson) => ({
      ...data,
      version: VERSION
    }))
  }

  // Update README.md
  await updateMarkdownFile(join(ROOT_DIR, 'README.md'))

  // Define version patterns for TypeScript files
  const versionPatterns = [{ search: /version:\s*['"`]\d+\.\d+\.\d+['"`]/g, replace: `version: '${VERSION}'` }]

  // Update MCP Client
  await updateTypeScriptFile(join(ROOT_DIR, 'packages/mcp-client/src/mcp-client.ts'), versionPatterns)

  // Update MCP HTTP Bridge
  await updateTypeScriptFile(join(ROOT_DIR, 'packages/server/mcp-http-bridge.ts'), versionPatterns)

  // Update MCP STDIO Server
  await updateTypeScriptFile(join(ROOT_DIR, 'packages/server/src/mcp-stdio-server.ts'), [
    ...versionPatterns,
    { search: /Promptliano MCP Server v\d+\.\d+\.\d+/g, replace: `Promptliano MCP Server v${VERSION}` }
  ])

  // Update MCP Routes
  await updateTypeScriptFile(join(ROOT_DIR, 'packages/server/src/routes/mcp-routes.ts'), versionPatterns)

  // Update MCP Installation Service
  await updateTypeScriptFile(join(ROOT_DIR, 'packages/services/src/mcp-installation-service.ts'), versionPatterns)

  // Update Config Test
  await updateTypeScriptFile(join(ROOT_DIR, 'packages/config/src/config.test.ts'), [
    {
      search: /expect\(app\.version\)\.toBe\(['"`]\d+\.\d+\.\d+['"`]\)/g,
      replace: `expect(app.version).toBe('${VERSION}')`
    }
  ])

  // Update website files
  const websiteFiles = [
    'packages/website/src/components/ui/download-button.tsx',
    'packages/website/src/routes/downloads.tsx',
    'packages/website/src/routes/docs.download-installation.tsx',
    'packages/website/src/routes/docs.getting-started.tsx'
  ]

  for (const file of websiteFiles) {
    await updateTypeScriptFile(join(ROOT_DIR, file), [
      // Update version strings
      { search: /version:\s*['"`]v?\d+\.\d+\.\d+['"`]/g, replace: `version: 'v${VERSION}'` },
      // Update download URLs
      { search: /\/download\/v\d+\.\d+\.\d+\//g, replace: `/download/v${VERSION}/` },
      { search: /promptliano-\d+\.\d+\.\d+-/g, replace: `promptliano-${VERSION}-` },
      // Update specific version references in text
      { search: /v\d+\.\d+\.\d+ •/g, replace: `v${VERSION} •` },
      // Update cd commands in install steps
      { search: /cd\s+~\/Downloads\/promptliano-v\d+\.\d+\.\d+/g, replace: `cd ~/Downloads/promptliano-v${VERSION}` },
      {
        search: /cd\s+%USERPROFILE%\\Downloads\\promptliano-v\d+\.\d+\.\d+-windows-x64/g,
        replace: `cd %USERPROFILE%\\Downloads\\promptliano-v${VERSION}-windows-x64`
      }
    ])
  }

  console.log('\n✨ Version sync complete!')
}

// Run the sync
syncVersions().catch(console.error)
