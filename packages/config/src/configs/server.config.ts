import type { ServerConfig } from '../types'

const isDevEnv = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined
const isTestEnv = process.env.NODE_ENV === 'test'
const isProdEnv = !isDevEnv && !isTestEnv

const DEV_PORT = 3147
const PROD_PORT = 3579
const CLIENT_PORT = 1420

export const serverConfig: ServerConfig = {
  corsOrigin: process.env.CORS_ORIGIN || '*',
  corsConfig: {
    origin: process.env.CORS_ORIGIN || [
      `http://localhost:${CLIENT_PORT}`,
      `https://${process.env.DOMAIN || 'localhost'}`,
      'tauri://localhost',
      'https://tauri.localhost'
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie']
  },
  serverHost: process.env.SERVER_HOST || 'localhost',
  serverPort: process.env.SERVER_PORT || (isDevEnv ? DEV_PORT : PROD_PORT),
  devPort: DEV_PORT,
  prodPort: PROD_PORT,
  clientPort: CLIENT_PORT,
  clientUrl: process.env.CLIENT_URL || `http://localhost:${CLIENT_PORT}`,
  apiUrl: process.env.API_URL || `http://localhost:${isDevEnv ? DEV_PORT : PROD_PORT}`,
  isDevEnv,
  isTestEnv,
  isProdEnv
}