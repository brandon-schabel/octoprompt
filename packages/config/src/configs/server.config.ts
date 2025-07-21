import type { ServerConfig } from '../types'

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined'

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

export const serverConfig: ServerConfig = {
  corsOrigin: getEnvVar('CORS_ORIGIN', '*') || '*',
  corsConfig: {
    origin: getEnvVar('CORS_ORIGIN') || [
      `http://localhost:${CLIENT_PORT}`,
      `https://${getEnvVar('DOMAIN', 'localhost')}`,
      'tauri://localhost',
      'https://tauri.localhost'
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie']
  },
  serverHost: getEnvVar('SERVER_HOST', 'localhost') || 'localhost',
  serverPort: getEnvVar('SERVER_PORT') || (isDevEnv ? DEV_PORT : PROD_PORT),
  devPort: DEV_PORT,
  prodPort: PROD_PORT,
  clientPort: CLIENT_PORT,
  clientUrl: getEnvVar('CLIENT_URL', `http://localhost:${CLIENT_PORT}`) || `http://localhost:${CLIENT_PORT}`,
  apiUrl: getEnvVar('API_URL', `http://localhost:${isDevEnv ? DEV_PORT : PROD_PORT}`) || `http://localhost:${isDevEnv ? DEV_PORT : PROD_PORT}`,
  isDevEnv,
  isTestEnv,
  isProdEnv
}