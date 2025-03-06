import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

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

  // Check if it's an ApiError (you might need to adapt this based on your error types)
  if (err.name === 'ApiError') {
    return c.json({
      error: err.message,
      code: err?.code || 'UNKNOWN_ERROR',
    }, err?.status || 500);
  }

  // Default error response
  return c.json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  }, 500);
});

// Export the app for use in routes
export default app;
