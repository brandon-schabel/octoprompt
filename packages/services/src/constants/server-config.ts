export const isDevEnv = import.meta.env.DEV === 'true'
export const isTestEnv = import.meta.env.NODE_ENV === 'test'
export const isProdEnv = !isDevEnv && !isTestEnv

const DEV_PORT = 3147
const PROD_PORT = 3579
const CLIENT_PORT = 5173

export const SERVER_PORT = isDevEnv ? DEV_PORT : PROD_PORT

export const corsConfig = {
  origin: [`http://localhost:${CLIENT_PORT}`, `https://${process.env.DOMAIN}`],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie']
}
