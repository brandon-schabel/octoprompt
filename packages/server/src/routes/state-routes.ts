import { globalStateSchema } from "shared";
import { websocketStateAdapter } from "@/utils/websocket/websocket-state-adapter";
import { OpenAPIHono } from '@hono/zod-openapi';
    

export const stateRoutes = new OpenAPIHono().get("/api/state", async (c) => {
    try {
        const currentState = websocketStateAdapter.getState();
        return c.json(currentState);
    } catch (error) {
        console.error("Error fetching state:", error);
        return c.json({ error: "Failed to fetch state" }, 500);
    }
}).post("/api/state", async (c) => {
    try {
        const body = await c.req.json();
        const { key, value } = body as { key: string; value: unknown };
        const currentState = websocketStateAdapter.getState();

        // Shallow update
        const newState = { ...currentState, [key]: value };
        const validated = globalStateSchema.parse(newState);

        // Set & broadcast
        await websocketStateAdapter.setState(validated, true);

        return c.json(validated);
    } catch (error) {
        console.error("Error updating state:", error);
        return c.json({ error: String(error) }, 400);
    }
});
