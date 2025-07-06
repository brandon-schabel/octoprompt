#!/usr/bin/env bun

import { copyFileSync, chmodSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { $ } from 'bun'

// Get the current platform's Rust target triple
function getCurrentTargetTriple(): string {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'darwin') {
    return arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin'
  } else if (platform === 'linux') {
    return arch === 'arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-gnu'
  } else if (platform === 'win32') {
    return 'x86_64-pc-windows-msvc'
  }

  throw new Error(`Unsupported platform: ${platform} ${arch}`)
}

async function prepareDevSidecar() {
  const rootDir = join(import.meta.dir, '..')
  const serverDir = join(rootDir, 'packages', 'server')
  const tauriBindir = join(rootDir, 'packages', 'client', 'src-tauri', 'binaries')

  // Ensure the binaries directory exists
  if (!existsSync(tauriBindir)) {
    mkdirSync(tauriBindir, { recursive: true })
  }

  const currentTriple = getCurrentTargetTriple()
  const currentExt = process.platform === 'win32' ? '.exe' : ''
  const targetPath = join(tauriBindir, `promptliano-server-${currentTriple}${currentExt}`)

  console.log(`Building development sidecar for ${currentTriple}...`)

  // Build the server binary for the current platform
  await $`cd ${serverDir} && bun build --compile ./server.ts --outfile ${targetPath}`

  // Make executable on Unix systems
  if (process.platform !== 'win32') {
    chmodSync(targetPath, 0o755)
  }

  console.log(`Development sidecar prepared at: ${targetPath}`)
}

// Run the preparation
prepareDevSidecar().catch(console.error)
