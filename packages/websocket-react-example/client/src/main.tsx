import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app.tsx'
import { ChatWebSocketProvider } from './chat-web-socket-provider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChatWebSocketProvider>
      <App />
    </ChatWebSocketProvider>
  </StrictMode>,
)
