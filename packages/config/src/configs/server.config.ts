import type { ServerConfig } from '../types'

export const serverConfig: ServerConfig = {
  corsOrigin: process.env.CORS_ORIGIN || '*',
  serverHost: process.env.SERVER_HOST || 'localhost',
  serverPort: process.env.SERVER_PORT || 3147,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:1420',
  apiUrl: process.env.API_URL || 'http://localhost:3147'
}