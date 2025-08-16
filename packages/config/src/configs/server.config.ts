import type { ServerConfig } from '../types'

// Check if we're in a browser environment
const isBrowser = typeof globalThis !== 'undefined' && 'window' in globalThis

// Safe environment variable access
const getEnvVar = (key: string, defaultValue?: string): string | undefined => {
  if (isBrowser) {
    return defaultValue
  }
  return process?.env?.[key] || defaultValue
}

const nodeEnv = getEnvVar('NODE_ENV', 'development')
const isDevEnv = nodeEnv === 'development' || nodeEnv === undefined
const isTestEnv = nodeEnv === 'test'
const isProdEnv = !isDevEnv && !isTestEnv

const DEV_PORT = 3147
const PROD_PORT = 3579
const CLIENT_PORT = 1420

// Determine if running in Docker/container environment
const isDocker = getEnvVar('DOCKER', 'false') === 'true' || getEnvVar('DATABASE_PATH')?.startsWith('/data')

// Determine the server port
const serverPort = Number(getEnvVar('SERVER_PORT') || getEnvVar('PORT') || (isDevEnv ? DEV_PORT : PROD_PORT))

// Determine the host (0.0.0.0 for Docker/production, localhost for development)
const serverHost = getEnvVar('SERVER_HOST') || getEnvVar('HOST') || (isDocker || isProdEnv ? '0.0.0.0' : 'localhost')

export const serverConfig: ServerConfig = {
  // Core server settings
  host: serverHost,
  port: serverPort,
  basePath: getEnvVar('API_BASE_PATH', '/api') || '/api',
  staticPath: getEnvVar('STATIC_PATH', isDevEnv ? './client-dist' : './client-dist') || './client-dist',
  idleTimeout: Number(getEnvVar('IDLE_TIMEOUT', '255')), // 255 seconds for long operations

  // CORS configuration
  corsOrigin: getEnvVar('CORS_ORIGIN', '*') || '*',
  corsConfig: {
    origin: getEnvVar('CORS_ORIGIN') || [
      `http://localhost:${CLIENT_PORT}`,
      `http://localhost:${serverPort}`,
      `https://${getEnvVar('DOMAIN', 'localhost')}`
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie']
  },

  // Environment-specific
  environment: (nodeEnv as 'development' | 'test' | 'production') || 'development',
  isDevEnv,
  isTestEnv,
  isProdEnv,

  // Legacy compatibility (will be removed in future)
  serverHost,
  serverPort,
  devPort: DEV_PORT,
  prodPort: PROD_PORT,
  clientPort: CLIENT_PORT,
  clientUrl: getEnvVar('CLIENT_URL', `http://localhost:${CLIENT_PORT}`) || `http://localhost:${CLIENT_PORT}`,
  apiUrl:
    getEnvVar('API_URL', `http://localhost:${serverPort}`) ||
    `http://localhost:${serverPort}`
}
