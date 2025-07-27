import { useEffect, useRef, useCallback, useState } from 'react'
import { toast } from 'sonner'

interface WebSocketHook {
  isConnected: boolean
  send: (data: any) => void
  subscribe: (event: string, handler: (event: MessageEvent) => void) => void
  unsubscribe: (event: string, handler: (event: MessageEvent) => void) => void
}

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (() => {
    const host = window.location.hostname
    const port = import.meta.env.VITE_PORT || 8787
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${host}:${port}/ws`
  })()

export function useWebSocket(): WebSocketHook {
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const listenersRef = useRef<Map<string, Set<(event: MessageEvent) => void>>>(new Map())
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reconnectAttemptsRef = useRef(0)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        console.log('[WebSocket] Connected')
        setIsConnected(true)
        reconnectAttemptsRef.current = 0

        // Send initial ping
        ws.send(JSON.stringify({ type: 'ping' }))
      }

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected')
        setIsConnected(false)
        wsRef.current = null

        // Attempt reconnection with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
        reconnectAttemptsRef.current++

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WebSocket] Attempting reconnection...')
          connect()
        }, delay)
      }

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
      }

      ws.onmessage = (event) => {
        // Handle pong messages
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'pong') return
        } catch {
          // Not JSON, continue with normal handling
        }

        // Notify all message listeners
        const messageHandlers = listenersRef.current.get('message')
        if (messageHandlers) {
          messageHandlers.forEach((handler) => handler(event))
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error)
      toast.error('Failed to connect to server')
    }
  }, [])

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    } else {
      console.warn('[WebSocket] Cannot send - not connected')
    }
  }, [])

  const subscribe = useCallback((event: string, handler: (event: MessageEvent) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set())
    }
    listenersRef.current.get(event)!.add(handler)
  }, [])

  const unsubscribe = useCallback((event: string, handler: (event: MessageEvent) => void) => {
    listenersRef.current.get(event)?.delete(handler)
  }, [])

  // Connect on mount
  useEffect(() => {
    connect()

    // Set up ping interval
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // Ping every 30 seconds

    return () => {
      clearInterval(pingInterval)
      clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  return {
    isConnected,
    send,
    subscribe,
    unsubscribe
  }
}
