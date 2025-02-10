import { CorsPlugin, ErrorHandlingPlugin, Router } from "@bnk/router";

// Create router instance
export const router = new Router();

await router.registerPlugin(new CorsPlugin({
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    headers: ['Content-Type', 'Authorization', 'Cookie']
}));

await router.registerPlugin(
    new ErrorHandlingPlugin({
        logErrors: true,
        exposeStackTrace: false,
        logger: (error) => {
            console.error("[ErrorHandlingPlugin] ", error);
        },
    })
);
