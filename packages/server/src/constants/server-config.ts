export const isDevEnv = process.env.DEV === 'true'

const DEV_PORT = 3147
const PROD_PORT = 3579
const CLIENT_PORT = 5173

export const SERVER_PORT = isDevEnv ? DEV_PORT : PROD_PORT

export const corsConfig = {
  origin: [`http://localhost:${CLIENT_PORT}`, `https://${process.env.DOMAIN}`],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie']
}
