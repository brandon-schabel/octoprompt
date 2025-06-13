export const SERVER_HOSTNAME = 'localhost'
// export const SERVER_PORT_DEV = 8000
export const SERVER_PORT_DEV = 3147
export const SERVER_PORT_PROD = 3579

export const isProd = import.meta.env.MODE === 'production'

// in dev the client runs on port 5173 and the server runs on port 3147, in production the server servers the client (3579)
export const SERVER_HTTP_ENDPOINT = isProd ? '' : `http://${SERVER_HOSTNAME}:${SERVER_PORT_DEV}`
