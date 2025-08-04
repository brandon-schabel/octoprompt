#!/usr/bin/env bun
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { $ } from 'bun'

const execAsync = promisify(exec)

interface Package {
  name: string
  path: string
  dependencies: string[]
  hasBuildScript: boolean
}

// Define package dependency graph
const packages: Package[] = [
  {
    name: '@promptliano/ui',
    path: 'packages/ui',
    dependencies: [],
    hasBuildScript: true
  },
  {
    name: '@promptliano/shared',
    path: 'packages/shared',
    dependencies: [],
    hasBuildScript: false
  },
  {
    name: '@promptliano/schemas',
    path: 'packages/schemas',
    dependencies: ['@promptliano/shared'],
    hasBuildScript: false
  },
  {
    name: '@promptliano/storage',
    path: 'packages/storage',
    dependencies: ['@promptliano/schemas', '@promptliano/shared'],
    hasBuildScript: false
  },
  {
    name: '@promptliano/services',
    path: 'packages/services',
    dependencies: ['@promptliano/storage', '@promptliano/schemas', '@promptliano/shared'],
    hasBuildScript: false
  },
  {
    name: '@promptliano/api-client',
    path: 'packages/api-client',
    dependencies: ['@promptliano/schemas'],
    hasBuildScript: false
  },
  {
    name: '@promptliano/client',
    path: 'packages/client',
    dependencies: ['@promptliano/ui', '@promptliano/api-client', '@promptliano/schemas'],
    hasBuildScript: true
  },
  {
    name: '@promptliano/server',
    path: 'packages/server',
    dependencies: ['@promptliano/services', '@promptliano/storage', '@promptliano/schemas'],
    hasBuildScript: true
  }
]

// Topological sort to determine build order
function topologicalSort(packages: Package[]): Package[] {
  const sorted: Package[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  function visit(pkg: Package) {
    if (visited.has(pkg.name)) return
    if (visiting.has(pkg.name)) {
      throw new Error(`Circular dependency detected: ${pkg.name}`)
    }

    visiting.add(pkg.name)

    // Visit dependencies first
    for (const depName of pkg.dependencies) {
      const dep = packages.find((p) => p.name === depName)
      if (dep) {
        visit(dep)
      }
    }

    visiting.delete(pkg.name)
    visited.add(pkg.name)
    sorted.push(pkg)
  }

  for (const pkg of packages) {
    visit(pkg)
  }

  return sorted
}

async function buildPackage(pkg: Package, useBun: boolean = false) {
  console.log(`\n🏗️  Building ${pkg.name}...`)
  const startTime = performance.now()

  try {
    if (pkg.hasBuildScript) {
      const buildCommand = useBun && pkg.name === '@promptliano/ui' ? 'bun run build:bun' : 'bun run build'

      const result = await $`cd ${pkg.path} && ${buildCommand}`.quiet()

      if (result.exitCode !== 0) {
        throw new Error(`Build failed: ${result.stderr}`)
      }

      const duration = ((performance.now() - startTime) / 1000).toFixed(2)
      console.log(`✅ ${pkg.name} built successfully in ${duration}s`)
    } else {
      console.log(`⏭️  ${pkg.name} has no build step`)
    }
  } catch (error) {
    console.error(`❌ Failed to build ${pkg.name}:`, error.message)
    throw error
  }
}

async function buildAllPackages(parallel: boolean = false, useBun: boolean = false) {
  console.log('🚀 Starting monorepo build...')
  console.log(`Build mode: ${parallel ? 'parallel' : 'sequential'}`)
  console.log(`UI build: ${useBun ? 'Bun' : 'tsup'}`)

  const startTime = performance.now()

  try {
    const sortedPackages = topologicalSort(packages)

    console.log('\n📋 Build order:')
    sortedPackages.forEach((pkg, i) => {
      console.log(`  ${i + 1}. ${pkg.name}${pkg.hasBuildScript ? '' : ' (no build)'}`)
    })

    if (parallel) {
      // Group packages by dependency level for parallel builds
      const levels: Package[][] = []
      const levelMap = new Map<string, number>()

      for (const pkg of sortedPackages) {
        let level = 0
        for (const dep of pkg.dependencies) {
          const depLevel = levelMap.get(dep) || 0
          level = Math.max(level, depLevel + 1)
        }
        levelMap.set(pkg.name, level)

        if (!levels[level]) levels[level] = []
        levels[level].push(pkg)
      }

      // Build each level in parallel
      for (const levelPackages of levels) {
        if (levelPackages && levelPackages.length > 0) {
          await Promise.all(levelPackages.map((pkg) => buildPackage(pkg, useBun)))
        }
      }
    } else {
      // Sequential build
      for (const pkg of sortedPackages) {
        await buildPackage(pkg, useBun)
      }
    }

    const totalTime = ((performance.now() - startTime) / 1000).toFixed(2)
    console.log(`\n✨ Monorepo build completed in ${totalTime}s`)
  } catch (error) {
    console.error('\n💥 Monorepo build failed')
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const parallel = args.includes('--parallel')
const useBun = args.includes('--bun')
const help = args.includes('--help')

if (help) {
  console.log(`
Promptliano Monorepo Build Orchestrator

Usage: bun run scripts/build-all.ts [options]

Options:
  --parallel    Build independent packages in parallel
  --bun         Use Bun build for UI package instead of tsup
  --help        Show this help message

Examples:
  bun run scripts/build-all.ts                    # Sequential build with tsup
  bun run scripts/build-all.ts --parallel         # Parallel build with tsup
  bun run scripts/build-all.ts --parallel --bun   # Parallel build with Bun for UI
`)
  process.exit(0)
}

// Run the build
await buildAllPackages(parallel, useBun)
