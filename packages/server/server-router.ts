import { CorsPlugin, Router } from "@bnk/router";

// Create router instance
export const router = new Router();

await router.registerPlugin(new CorsPlugin({
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    headers: ['Content-Type', 'Authorization', 'Cookie']
}));


// Add global error handler
router.use(async (req) => {
    try {
        return null; // Continue to next middleware/route
    } catch (error) {
        console.error('Router Error:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
