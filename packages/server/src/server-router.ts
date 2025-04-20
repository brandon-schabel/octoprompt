import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { ApiError } from 'shared';

// Create Hono app instance
export const app = new Hono();

// Add CORS middleware
app.use('*', cors({
  origin: ['http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Add logger middleware
app.use('*', logger());

// Add custom error handler
app.onError((err, c) => {
  console.error("[ErrorHandler]", err);

  // Check if it's an ApiError
  if (err instanceof ApiError) {
    return c.json({
      error: err.message,
      code: err.code || 'UNKNOWN_ERROR',
    }, err.status as any || 500);
  }

  // Handle "not found" errors
  if (err instanceof Error && 
      (err.message.includes('not found') || 
       err.message.toLowerCase().includes('cannot find') ||
       err.message.toLowerCase().includes('does not exist'))) {
    return c.json({ 
      error: err.message,
      code: 'NOT_FOUND'
    }, 404 as any);
  }

  // Default error response
  return c.json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  }, 500 as any);
});

// Export the app for use in routes
export default app;
