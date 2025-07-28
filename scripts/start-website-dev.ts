import { $ } from 'bun'
import { join } from 'path'

async function startWebsiteDev() {
  try {
    const rootDir = process.cwd()

    // Start website (Vite runs on 5173 by default)
    console.log('🚀 Starting website...')
    const websiteProcess = Bun.spawn(['bun', 'run', 'dev'], {
      cwd: join(rootDir, 'packages', 'website'),
      stdio: ['inherit', 'inherit', 'inherit']
    })

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down website...')
      websiteProcess.kill()
      process.exit(0)
    })

    // Keep the script running
    await new Promise(() => {})
  } catch (error) {
    console.error('❌ Error starting website:', error)
    process.exit(1)
  }
}

await startWebsiteDev()
