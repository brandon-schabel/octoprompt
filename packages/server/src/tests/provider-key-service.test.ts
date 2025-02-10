// File: packages/server/src/tests/provider-key-service.test.ts
import { describe, test, expect, beforeEach } from "bun:test";
import { db, resetDatabase } from "@db";
import { createProviderKeyService } from "@/services/model-providers/providers/provider-key-service";

let svc: ReturnType<typeof createProviderKeyService>;

describe("provider-key-service", () => {
    beforeEach(async () => {
        await resetDatabase();
        svc = createProviderKeyService();
    });

    test("createKey inserts new provider key", async () => {
        const pk = await svc.createKey({ provider: "openai", key: "test-api-key" });
        expect(pk.id).toBeDefined();

        const row = db
            .query("SELECT * FROM provider_keys WHERE id = ?")
            .get(pk.id);
        expect(row?.provider).toBe("openai");
    });

    test("listKeys returns all provider keys", async () => {
        await svc.createKey({ provider: "a", key: "k1" });
        await svc.createKey({ provider: "b", key: "k2" });
        const list = await svc.listKeys();
        expect(list.length).toBe(2);
    });

    test("getKeyById returns key or null if not found", async () => {
        const created = await svc.createKey({ provider: "xxx", key: "abc" });
        const found = await svc.getKeyById(created.id);
        expect(found?.key).toBe("abc");

        const missing = await svc.getKeyById("nonexistent");
        expect(missing).toBeNull();
    });

    test("updateKey modifies existing row", async () => {
        const created = await svc.createKey({ provider: "zzz", key: "zzz" });
        const updated = await svc.updateKey(created.id, { key: "newKey" });
        expect(updated?.key).toBe("newKey");
    });

    test("deleteKey removes row, returns boolean", async () => {
        const created = await svc.createKey({ provider: "test", key: "delete-me" });
        const result = await svc.deleteKey(created.id);
        expect(result).toBe(true);

        const again = await svc.deleteKey(created.id);
        expect(again).toBe(false);
    });
});