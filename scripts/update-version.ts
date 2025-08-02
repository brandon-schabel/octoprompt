#!/usr/bin/env bun

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const configPath = join(import.meta.dir, '../packages/config/src/configs/app.config.ts')

async function updateVersion(newVersion: string) {
  try {
    // Validate version format
    if (!/^\d+\.\d+\.\d+(-\w+(\.\d+)?)?$/.test(newVersion)) {
      console.error('❌ Invalid version format. Please use semantic versioning (e.g., 1.2.3 or 1.2.3-beta.1)')
      process.exit(1)
    }

    // Read the config file
    const content = await readFile(configPath, 'utf-8')

    // Update the version
    const updatedContent = content.replace(/version:\s*['"`]([^'"`]+)['"`]/, `version: '${newVersion}'`)

    // Write back the file
    await writeFile(configPath, updatedContent)

    console.log(`✅ Updated version to ${newVersion} in app.config.ts`)
    console.log(`\n📝 Now run 'bun run sync-version' to update all other files`)
  } catch (error) {
    console.error('❌ Failed to update version:', error)
    process.exit(1)
  }
}

// Get version from command line
const newVersion = process.argv[2]

if (!newVersion) {
  console.error('❌ Please provide a version number')
  console.log('Usage: bun run update-version.ts <version>')
  console.log('Example: bun run update-version.ts 0.8.2')
  process.exit(1)
}

updateVersion(newVersion)
