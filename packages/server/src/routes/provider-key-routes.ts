import app from "@/server-router";
import { zValidator } from '@hono/zod-validator';
import { ApiError } from 'shared';
import { providerKeyApiValidation } from "shared";
import { providerKeyService } from "@/services/model-providers/providers/provider-key-service";

// Create a new key
app.post("/api/keys",
    zValidator('json', providerKeyApiValidation.create.body),
    async (c) => {
        const body = await c.req.valid('json');
        const newKey = await providerKeyService.createKey(body);
        return c.json({ success: true, key: newKey }, 201);
    }
);

// List all keys
app.get("/api/keys", async (c) => {
    const keys = await providerKeyService.listKeys();
    return c.json({ success: true, keys });
});

// Get a key by ID
app.get("/api/keys/:keyId",
    zValidator('param', providerKeyApiValidation.getOrDelete.params),
    async (c) => {
        const { keyId } = c.req.valid('param');
        const k = await providerKeyService.getKeyById(keyId);
        if (!k) {
            throw new ApiError("Key not found", 404, "KEY_NOT_FOUND");
        }
        return c.json({ success: true, key: k });
    }
);

// Update a key
app.patch("/api/keys/:keyId",
    zValidator('param', providerKeyApiValidation.update.params),
    zValidator('json', providerKeyApiValidation.update.body),
    async (c) => {
        const { keyId } = c.req.valid('param');
        const body = await c.req.valid('json');
        const updated = await providerKeyService.updateKey(keyId, body);
        if (!updated) {
            throw new ApiError("Key not found", 404, "KEY_NOT_FOUND");
        }
        return c.json({ success: true, key: updated });
    }
);

// Delete a key
app.delete("/api/keys/:keyId",
    zValidator('param', providerKeyApiValidation.getOrDelete.params),
    async (c) => {
        const { keyId } = c.req.valid('param');
        const deleted = await providerKeyService.deleteKey(keyId);
        if (!deleted) {
            throw new ApiError("Key not found", 404, "KEY_NOT_FOUND");
        }
        return c.json({ success: true });
    }
);