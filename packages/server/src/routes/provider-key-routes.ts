import { router } from "server-router";
import { json } from '@bnk/router';
import { providerKeyApiValidation } from "shared";
import { ProviderKeyService } from "@/services/model-providers/providers/provider-key-service";

const keyService = new ProviderKeyService();

router.post("/api/keys", {
    validation: providerKeyApiValidation.create,
}, async (req, { body }) => {
    try {
        const newKey = await keyService.createKey(body);
        return json({ success: true, key: newKey }, { status: 201 });
    } catch (error) {
        console.error("Error creating provider key:", error);
        return json.error("Internal server error", 500);
    }
});

router.get("/api/keys", {}, async () => {
    try {
        const keys = await keyService.listKeys();
        return json({ success: true, keys });
    } catch (error) {
        console.error("Error listing provider keys:", error);
        return json.error("Internal server error", 500);
    }
});

router.get("/api/keys/:keyId", {
    validation: providerKeyApiValidation.getOrDelete,
}, async (req, { params }) => {
    try {
        const k = await keyService.getKeyById(params.keyId);
        if (!k) return json.error("Key not found", 404);
        return json({ success: true, key: k });
    } catch (error) {
        console.error("Error fetching provider key:", error);
        return json.error("Internal server error", 500);
    }
});

router.patch("/api/keys/:keyId", {
    validation: providerKeyApiValidation.update,
}, async (req, { params, body }) => {
    try {
        const updated = await keyService.updateKey(params.keyId, body);
        if (!updated) return json.error("Key not found", 404);
        return json({ success: true, key: updated });
    } catch (error) {
        console.error("Error updating provider key:", error);
        return json.error("Internal server error", 500);
    }
});

router.delete("/api/keys/:keyId", {
    validation: providerKeyApiValidation.getOrDelete,
}, async (req, { params }) => {
    try {
        const deleted = await keyService.deleteKey(params.keyId);
        if (!deleted) return json.error("Key not found", 404);
        return json({ success: true });
    } catch (error) {
        console.error("Error deleting provider key:", error);
        return json.error("Internal server error", 500);
    }
});