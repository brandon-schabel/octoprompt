import { router } from "server-router";
import { json } from '@bnk/router';
import { ApiError } from 'shared';
import { providerKeyApiValidation } from "shared";
import { providerKeyService } from "@/services/model-providers/providers/provider-key-service";


router.post("/api/keys", {
    validation: providerKeyApiValidation.create,
}, async (_, { body }) => {
    const newKey = await providerKeyService.createKey(body);
    return json({ success: true, key: newKey }, { status: 201 });
});

router.get("/api/keys", {}, async () => {
    const keys = await providerKeyService.listKeys();
    return json({ success: true, keys });
});

router.get("/api/keys/:keyId", {
    validation: providerKeyApiValidation.getOrDelete,
}, async (_, { params }) => {
    const k = await providerKeyService.getKeyById(params.keyId);
    if (!k) {
        throw new ApiError("Key not found", 404, "KEY_NOT_FOUND");
    }
    return json({ success: true, key: k });
});

router.patch("/api/keys/:keyId", {
    validation: providerKeyApiValidation.update,
}, async (_, { params, body }) => {
    const updated = await providerKeyService.updateKey(params.keyId, body);
    if (!updated) {
        throw new ApiError("Key not found", 404, "KEY_NOT_FOUND");
    }
    return json({ success: true, key: updated });
});

router.delete("/api/keys/:keyId", {
    validation: providerKeyApiValidation.getOrDelete,
}, async (_, { params }) => {
    const deleted = await providerKeyService.deleteKey(params.keyId);
    if (!deleted) {
        throw new ApiError("Key not found", 404, "KEY_NOT_FOUND");
    }
    return json({ success: true });
});