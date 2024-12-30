import { router } from "server-router";
import { json } from '@bnk/router';
import { ApiError } from 'shared';
import { providerKeyApiValidation } from "shared";
import { ProviderKeyService } from "@/services/model-providers/providers/provider-key-service";

const keyService = new ProviderKeyService();

router.post("/api/keys", {
    validation: providerKeyApiValidation.create,
}, async (_, { body }) => {
    const newKey = await keyService.createKey(body);
    return json({ success: true, key: newKey }, { status: 201 });
});

router.get("/api/keys", {}, async () => {
    const keys = await keyService.listKeys();
    return json({ success: true, keys });
});

router.get("/api/keys/:keyId", {
    validation: providerKeyApiValidation.getOrDelete,
}, async (_, { params }) => {
    const k = await keyService.getKeyById(params.keyId);
    if (!k) {
        throw new ApiError("Key not found", 404, "KEY_NOT_FOUND");
    }
    return json({ success: true, key: k });
});

router.patch("/api/keys/:keyId", {
    validation: providerKeyApiValidation.update,
}, async (_, { params, body }) => {
    const updated = await keyService.updateKey(params.keyId, body);
    if (!updated) {
        throw new ApiError("Key not found", 404, "KEY_NOT_FOUND");
    }
    return json({ success: true, key: updated });
});

router.delete("/api/keys/:keyId", {
    validation: providerKeyApiValidation.getOrDelete,
}, async (_, { params }) => {
    const deleted = await keyService.deleteKey(params.keyId);
    if (!deleted) {
        throw new ApiError("Key not found", 404, "KEY_NOT_FOUND");
    }
    return json({ success: true });
});