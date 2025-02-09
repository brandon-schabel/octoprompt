import { describe, test, expect, beforeAll, beforeEach, mock, spyOn } from "bun:test";
import { kvStore, initKvStore, getKvValue, setKvValue, deleteKvKey, backupKvStore } from "@/services/kv-service";
import { KVValue, KVKey } from "shared";

describe("KV Service", () => {
    let syncMock: ReturnType<typeof mock>;
    let backupMock: ReturnType<typeof mock>;

    beforeAll(() => {
        // Mock the kvStore methods directly.  This is cleaner and avoids
        // issues with spying on a library class prototype.
        syncMock = mock(kvStore.sync);
        backupMock = mock(kvStore.createBackup);

        spyOn(kvStore, "sync").mockImplementation(syncMock);
        spyOn(kvStore, "createBackup").mockImplementation(backupMock);
    });

    beforeEach(async () => {
        // Re-init the store (clears data in memory)
        await initKvStore();
        // Reset mocks
        syncMock.mockClear(); // Use mockClear() for Bun
        backupMock.mockClear();
    });

    test("setKvValue and getKvValue store and retrieve typed data", async () => {
        // *** IMPORTANT: Use a REAL key from your KvSchemas ***
        // Example (assuming 'myKey' exists and is a string type):
        const key: KVKey = "userProfile"; // No cast needed! Use a valid key from KvSchemas
        const expectedValue: KVValue<typeof key> = { name: "HelloWorld", age: 24 }; // Type-safe value

        await setKvValue(key, expectedValue);
        const val = await getKvValue(key);
        expect(val).toEqual(expectedValue); // Now types match. Use toEqual for objects.
        expect(syncMock.mock.calls.length).toBe(1); // Access calls correctly
    });

    test("getKvValue returns undefined if key not set", async () => {
        // *** Use a REAL key, but one you know is NOT set ***
        const missing = await getKvValue("someMissingKey" as KVKey); // Cast is still needed here, as it's an invalid key by design
        expect(missing).toBeUndefined();
    });

    test("setKvValue fails if data does not match the Zod schema", async () => {
        // Example (assuming 'myKey' expects a string)
        const key: KVKey = "userProfile";
        //  We need to cast to any to bypass TS checking *here*, as we're
        //  deliberately testing invalid input.
        await expect(setKvValue(key, { name: 123, age: "23" } as any)) //Incorrect values to check validation
            .rejects.toThrow();
        expect(syncMock.mock.calls.length).toBe(0); // Access calls correctly
    });

    test("deleteKvKey removes the entry and calls sync", async () => {
        const key: KVKey = "userProfile";
        const expectedValue: KVValue<typeof key> = { name: "SomeValue", age: 42 }; // Correct type
        await setKvValue(key, expectedValue);
        await deleteKvKey(key); // Corrected function name
        expect(await getKvValue(key)).toBeUndefined();
        expect(syncMock.mock.calls.length).toBe(2); // Access calls correctly
    });

    test("backupKvStore calls createBackup on the kvStore", async () => {
        await backupKvStore();
        expect(backupMock.mock.calls.length).toBe(1); // Access calls correctly
    });
});