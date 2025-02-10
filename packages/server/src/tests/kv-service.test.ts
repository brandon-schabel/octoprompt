import { describe, test, expect, beforeAll, beforeEach, mock, spyOn } from "bun:test";
import { kvStore, initKvStore, getKvValue, setKvValue, deleteKvKey, backupKvStore } from "@/services/kv-service";
import { KVValue, KVKey } from "shared";

describe("KV Service", () => {
    let syncMock: ReturnType<typeof mock>;
    let backupMock: ReturnType<typeof mock>;

    beforeAll(() => {
        syncMock = mock(kvStore.sync);
        backupMock = mock(kvStore.createBackup);

        spyOn(kvStore, "sync").mockImplementation(syncMock);
        spyOn(kvStore, "createBackup").mockImplementation(backupMock);
    });

    beforeEach(async () => {
        await initKvStore();
        syncMock.mockClear();
        backupMock.mockClear();
    });

    test("setKvValue and getKvValue store and retrieve typed data", async () => {
        const key: KVKey = "userProfile";
        const expectedValue: KVValue<typeof key> = { name: "HelloWorld", age: 24 };

        await setKvValue(key, expectedValue);
        const val = await getKvValue(key);
        expect(val).toEqual(expectedValue);
        expect(syncMock.mock.calls.length).toBe(1);
    });

    test("getKvValue returns undefined if key not set", async () => {
        const missing = await getKvValue("someMissingKey" as KVKey);
        expect(missing).toBeUndefined();
    });

    test("setKvValue fails if data does not match the Zod schema", async () => {
        const key: KVKey = "userProfile";
        await expect(
            setKvValue(key, { name: 123, age: "23" } as any)
        ).rejects.toThrow();
        expect(syncMock.mock.calls.length).toBe(0);
    });

    test("deleteKvKey removes the entry and calls sync", async () => {
        const key: KVKey = "userProfile";
        const expectedValue: KVValue<typeof key> = { name: "SomeValue", age: 42 };
        await setKvValue(key, expectedValue);
        await deleteKvKey(key);
        expect(await getKvValue(key)).toBeUndefined();
        expect(syncMock.mock.calls.length).toBe(2);
    });

    test("backupKvStore calls createBackup on the kvStore", async () => {
        await backupKvStore();
        expect(backupMock.mock.calls.length).toBe(1);
    });
});