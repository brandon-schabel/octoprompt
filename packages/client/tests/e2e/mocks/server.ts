import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock handlers for API endpoints
export const handlers = [
  // Health check endpoint
  http.get('/api/health', () => {
    return HttpResponse.json({ 
      status: 'ok', 
      timestamp: Date.now(),
      services: {
        database: 'healthy',
        api: 'healthy'
      }
    })
  }),

  // Projects endpoints
  http.get('/api/projects', () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 1234567890123,
          name: 'Test Project',
          description: 'A test project for E2E testing',
          path: '/test/project',
          created: Date.now() - 86400000,
          updated: Date.now()
        }
      ]
    })
  }),

  http.post('/api/projects', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      success: true,
      data: {
        id: Date.now(),
        name: body.name,
        description: body.description,
        path: body.path,
        created: Date.now(),
        updated: Date.now()
      }
    })
  }),

  // Chat endpoints
  http.get('/api/chats', () => {
    return HttpResponse.json({
      success: true,
      data: []
    })
  }),

  // Prompts endpoints
  http.get('/api/prompts', () => {
    return HttpResponse.json({
      success: true,
      data: []
    })
  }),

  // Provider keys endpoints
  http.get('/api/provider-keys', () => {
    return HttpResponse.json({
      success: true,
      data: []
    })
  })
]

// Setup MSW server
export const server = setupServer(...handlers)