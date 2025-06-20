import { mkdirSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { createWriteStream } from 'node:fs'
import archiver from 'archiver'
import { $ } from 'bun'

async function buildProject() {
  const startTime = performance.now()
  const rootDir = process.cwd()
  const serverDir = join(rootDir, 'packages', 'server')
  const clientDir = join(rootDir, 'packages', 'client')
  // this is set in vite.config.ts
  const clientBuildOutputDir = join(rootDir, 'packages', 'server', 'client-dist')
  const sharedDir = join(rootDir, 'packages', 'shared')
  const distDir = join(rootDir, 'dist')

  // clear dist
  await $`rm -rf ${distDir}`

  // Build client first
  console.log('Building client...')
  await $`cd ${clientDir} && bun run build:prod`

  // Build server as normal JS bundle first
  console.log('Building server...')
  await Bun.build({
    entrypoints: [join(serverDir, 'server.ts')],
    outdir: distDir,
    target: 'bun',
    minify: true,
    sourcemap: 'external',
    plugins: []
  })

  // Prepare dist folder
  console.log('Copying required files to dist...')
  mkdirSync(join(distDir, 'client-dist'), { recursive: true })
  // Copy the built client assets from packages/server/client-dist to dist/client-dist
  console.log('Copying built client files to main dist for Bun bundle...')
  await $`cp -r ${clientBuildOutputDir}/* ${join(distDir, 'client-dist')}/`

  // Write modified package.json to dist
  const pkg = require(join(serverDir, 'package.json'))
  pkg.scripts = {
    start: 'bun ./server.js'
  }
  await Bun.write(join(distDir, 'package.json'), JSON.stringify(pkg, null, 2))

  // this is already done becuase its set in vite.config.ts
  // // Copy built client files
  // console.log('Copying built client files to server dist...')
  // await $`cp -r ${join(clientDir, 'dist')}/* ${join(distDir, 'client-dist')}/`

  // Build a simple binary for the current platform (for development)
  console.log('Building binary for current platform...')
  const currentPlatformExt = process.platform === 'win32' ? '.exe' : ''
  await $`cd ${serverDir} && bun build --compile ./server.ts --outfile ${join(distDir, `${pkg.name}-bundle${currentPlatformExt}`)}`
  
  // Define targets with proper executable extensions
  const bundleNamePrefix = `${pkg.name}-${pkg.version}`

  // Create a zip archive for the Bun-runnable bundle
  console.log('Creating Bun-runnable bundle zip archive...')
  const bunBundleName = `${bundleNamePrefix}-bun-bundle.zip`
  await createBunBundleZip(distDir, join(distDir, bunBundleName))

  type PlatformTarget = {
    name: string
    target: string
    executableExt: string
    outputDirName: string
  }

  const targets: PlatformTarget[] = [
    {
      name: `${bundleNamePrefix}-linux-arm64`,
      target: 'bun-linux-arm64',
      executableExt: '',
      outputDirName: `${pkg.name}-${pkg.version}-linux-arm64`
    },
    {
      name: `${bundleNamePrefix}-linux-x64`,
      target: 'bun-linux-x64',
      executableExt: '',
      outputDirName: `${pkg.name}-${pkg.version}-linux-x64`
    },
    {
      name: `${bundleNamePrefix}-macos-x64`,
      target: 'bun-darwin-x64',
      executableExt: '',
      outputDirName: `${pkg.name}-${pkg.version}-macos-x64`
    },
    {
      name: `${bundleNamePrefix}-macos-arm64`,
      target: 'bun-darwin-arm64',
      executableExt: '',
      outputDirName: `${pkg.name}-${pkg.version}-macos-arm64`
    },
    {
      name: `${bundleNamePrefix}-windows-x64`,
      target: 'bun-windows-x64',
      executableExt: '.exe',
      outputDirName: `${pkg.name}-${pkg.version}-windows-x64`
    }
  ]

  for (const { name, target, executableExt, outputDirName } of targets) {
    console.log(`Creating ${outputDirName} standalone executable...`)
    const platformDir = join(distDir, outputDirName)
    mkdirSync(platformDir, { recursive: true })

    // Copy client-dist folder to platform directory
    await $`cp -r ${clientBuildOutputDir} ${join(platformDir, 'client-dist')}`

    // Build the standalone binary with version in the name
    const executableName = `${pkg.name}${executableExt}`
    await $`cd ${serverDir} && bun build --compile --target=${target} ./server.ts --outfile ${join(platformDir, executableName)}`

    // For non-Windows platforms, ensure the executable has proper permissions
    if (!executableExt) {
      chmodSync(join(platformDir, executableName), 0o755)
    }

    // Also copy the standalone binary to the dist root for Tauri sidecar preparation
    const simplePlatformName = target.replace('bun-', '')
    const standaloneExecName = `${pkg.name}-${simplePlatformName}${executableExt}`
    await $`cp ${join(platformDir, executableName)} ${join(distDir, standaloneExecName)}`

    // Create a zip archive with the versioned name
    console.log(`Creating zip archive for ${outputDirName}...`)
    try {
      await createZipArchive(platformDir, `${join(distDir, outputDirName)}.zip`)
    } catch (error) {
      console.error(`Failed to create zip archive for ${outputDirName}:`, error)
      process.exit(1)
    }
  }

  console.log('Platform-specific bundles created successfully!')

  // Prepare Tauri sidecars
  console.log('\nPreparing Tauri sidecars...')
  try {
    await $`bun run ${join(rootDir, 'scripts', 'prepare-tauri-sidecars.ts')}`
    console.log('Tauri sidecars prepared successfully!')
  } catch (error) {
    console.warn('Failed to prepare Tauri sidecars:', error)
    console.warn('You can run "bun run prepare-tauri-sidecars" manually if needed.')
  }

  const endTime = performance.now()
  const totalSeconds = ((endTime - startTime) / 1000).toFixed(2)
  console.log(`\nBuild completed in ${totalSeconds} seconds`)
}

async function createBunBundleZip(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = archiver('zip', {
      zlib: { level: 9 }
    })

    output.on('close', () => {
      console.log(`Bun bundle zip archive created successfully: ${archive.pointer()} total bytes`)
      resolve()
    })

    archive.on('error', (err) => {
      reject(err)
    })

    archive.pipe(output)
    // Add specific files and folders for the Bun bundle
    archive.file(join(sourceDir, 'server.js'), { name: 'server.js' })
    archive.file(join(sourceDir, 'package.json'), { name: 'package.json' })
    archive.directory(join(sourceDir, 'client-dist'), 'client-dist')
    archive.finalize()
  })
}

function createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = archiver('zip', {
      zlib: { level: 9 }
    })

    output.on('close', () => {
      console.log(`Zip archive created successfully: ${archive.pointer()} total bytes`)
      resolve()
    })

    archive.on('error', (err) => {
      reject(err)
    })

    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

await buildProject()
