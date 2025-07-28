/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

const CACHE_NAME = 'promptliano-v1'
const STATIC_CACHE_NAME = 'promptliano-static-v1'
const DYNAMIC_CACHE_NAME = 'promptliano-dynamic-v1'

// Assets to cache immediately
const STATIC_ASSETS = ['/', '/index.html', '/offline.html', '/favicon.svg', '/manifest.json']

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: [/\.(?:css|js|woff2?|ttf|otf|eot)$/, /^https:\/\/fonts\.(?:googleapis|gstatic)\.com/],
  NETWORK_FIRST: [/\/api\//, /\.json$/],
  STALE_WHILE_REVALIDATE: [/\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/]
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              cacheName.startsWith('promptliano-') &&
              cacheName !== STATIC_CACHE_NAME &&
              cacheName !== DYNAMIC_CACHE_NAME
            )
          })
          .map((cacheName) => caches.delete(cacheName))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return

  // Determine caching strategy
  let strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate' = 'network-first'

  for (const [strategyName, patterns] of Object.entries(CACHE_STRATEGIES)) {
    if (patterns.some((pattern) => pattern.test(url.href))) {
      strategy = strategyName.toLowerCase().replace(/_/g, '-') as typeof strategy
      break
    }
  }

  event.respondWith(handleRequest(request, strategy))
})

async function handleRequest(
  request: Request,
  strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate'
): Promise<Response> {
  switch (strategy) {
    case 'cache-first':
      return cacheFirst(request)
    case 'network-first':
      return networkFirst(request)
    case 'stale-while-revalidate':
      return staleWhileRevalidate(request)
    default:
      return fetch(request)
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(STATIC_CACHE_NAME)
  const cached = await cache.match(request)

  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    return offlineResponse()
  }
}

async function networkFirst(request: Request): Promise<Response> {
  const cache = await caches.open(DYNAMIC_CACHE_NAME)

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await cache.match(request)
    return cached || offlineResponse()
  }
}

async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(DYNAMIC_CACHE_NAME)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  })

  return cached || fetchPromise
}

async function offlineResponse(): Promise<Response> {
  const cached = await caches.match('/offline.html')
  return (
    cached ||
    new Response('Offline - Please check your internet connection', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    })
  )
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data?.type === 'CACHE_URLS') {
    const urls = event.data.urls as string[]
    caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
      cache.addAll(urls)
    })
  }
})
