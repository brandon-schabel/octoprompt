import { CorsPlugin, ErrorHandlingPlugin, Router } from "@bnk/router";

// Create router instance
export const router = new Router();

await router.registerPlugin(new CorsPlugin({
    origin: ['http://localhost:5174'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    headers: ['Content-Type', 'Authorization', 'Cookie']
}));

await router.registerPlugin(
    new ErrorHandlingPlugin({
        // Print errors to console (or to your own logging system).
        logErrors: true,

        // If true, plugin automatically includes stack trace in JSON responses.
        // Usually only enable in development, or for debugging.
        exposeStackTrace: false,

        // Example custom logger
        logger: (error) => {
            console.error("[ErrorHandlingPlugin] ", error);
        },

        // Provide a custom shape for your JSON error response if desired
        // shapeError: (error) => {
        //   return {
        //     message: error.message,
        //     code: error.code,
        //     status: error.status,
        //     // add whatever else you like
        //   };
        // },
    })
);



// // Add global error handler
// router.use(async (req) => {
//     try {
//         return null; // Continue to next middleware/route
//     } catch (error) {
//         console.error('Router Error:', error);
//         return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
//             status: 500,
//             headers: { 'Content-Type': 'application/json' }
//         });
//     }
// });
