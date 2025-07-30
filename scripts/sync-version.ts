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

interface TauriConfig {
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

async function updateCargoToml(filePath: string) {
  try {
    const content = await readFile(filePath, 'utf-8')
    const updatedContent = content.replace(
      /version\s*=\s*"[^"]+"/,
      `version = "${VERSION}"`
    )
    await writeFile(filePath, updatedContent)
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
    'storage'
  ]

  for (const pkg of packages) {
    await updateJsonFile(
      join(ROOT_DIR, 'packages', pkg, 'package.json'),
      (data: PackageJson) => ({
        ...data,
        version: VERSION
      })
    )
  }

  // Update Tauri config
  await updateJsonFile(
    join(ROOT_DIR, 'packages/client/src-tauri/tauri.conf.json'),
    (data: TauriConfig) => ({
      ...data,
      version: VERSION
    })
  )

  // Update Cargo.toml
  await updateCargoToml(join(ROOT_DIR, 'packages/client/src-tauri/Cargo.toml'))

  console.log('\n✨ Version sync complete!')
}

// Run the sync
syncVersions().catch(console.error)