import { $ } from 'bun'
import { join } from 'path'

async function startServerDev() {
  try {
    const rootDir = process.cwd()

    // Start server (runs on 3147)
    console.log('🚀 Starting server...')
    const serverProcess = Bun.spawn(['bun', 'run', 'dev'], {
      cwd: join(rootDir, 'packages', 'server'),
      stdio: ['inherit', 'inherit', 'inherit']
    })

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down server...')
      serverProcess.kill()
      process.exit(0)
    })

    // Keep the script running
    await new Promise(() => {})
  } catch (error) {
    console.error('❌ Error starting server:', error)
    process.exit(1)
  }
}

await startServerDev()
