



export const SERVER_HOSTNAME = 'localhost'
// in dev the client runs on port 5173 and the server runs on port 3000, in production the server servers the client (3579)
export const SERVER_HTTP_ENDPOINT = process.env.NODE_ENV === "development" ? `http://${SERVER_HOSTNAME}:3000` : "";
export const SERVER_WS_ENDPOINT = process.env.NODE_ENV === "development" ? `ws://${SERVER_HOSTNAME}:3000` : "";