#!/usr/bin/env bun

import { copyFileSync, chmodSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// Mapping from Bun platform names to Rust target triples
const PLATFORM_MAP: Record<string, string> = {
  'bun-linux-arm64': 'aarch64-unknown-linux-gnu',
  'bun-linux-x64': 'x86_64-unknown-linux-gnu',
  'bun-darwin-x64': 'x86_64-apple-darwin',
  'bun-darwin-arm64': 'aarch64-apple-darwin',
  'bun-windows-x64': 'x86_64-pc-windows-msvc'
}

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

async function prepareTauriSidecars() {
  const distDir = join(import.meta.dir, '..', 'dist')
  const tauriBindir = join(import.meta.dir, '..', 'packages', 'client', 'src-tauri', 'binaries')

  // Ensure the binaries directory exists
  if (!existsSync(tauriBindir)) {
    mkdirSync(tauriBindir, { recursive: true })
  }

  // Copy all platform binaries if they exist
  for (const [bunPlatform, rustTriple] of Object.entries(PLATFORM_MAP)) {
    const ext = bunPlatform.includes('windows') ? '.exe' : ''
    const sourcePath = join(distDir, `promptliano-${bunPlatform.replace('bun-', '')}${ext}`)
    const targetPath = join(tauriBindir, `promptliano-server-${rustTriple}${ext}`)

    if (existsSync(sourcePath)) {
      console.log(`Copying ${bunPlatform} -> ${rustTriple}`)
      copyFileSync(sourcePath, targetPath)

      // Make executable on Unix systems
      if (!bunPlatform.includes('windows')) {
        chmodSync(targetPath, 0o755)
      }
    }
  }

  // Also prepare the current platform's binary from the simple bundle if available
  const currentTriple = getCurrentTargetTriple()
  const currentExt = process.platform === 'win32' ? '.exe' : ''
  const bundlePath = join(distDir, `promptliano-bundle${currentExt}`)
  const currentTargetPath = join(tauriBindir, `promptliano-server-${currentTriple}${currentExt}`)

  if (existsSync(bundlePath) && !existsSync(currentTargetPath)) {
    console.log(`Copying current platform bundle -> ${currentTriple}`)
    copyFileSync(bundlePath, currentTargetPath)

    if (process.platform !== 'win32') {
      chmodSync(currentTargetPath, 0o755)
    }
  }

  console.log('Tauri sidecars prepared successfully')
}

// Run the preparation
prepareTauriSidecars().catch(console.error)
