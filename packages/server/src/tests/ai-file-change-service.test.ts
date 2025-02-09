// File: packages/server/src/tests/ai-file-change-service.test.ts
import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { db, eq } from "@db";
import { schema } from "shared";
import {
    generateFileChange,
    confirmFileChange,
    getFileChange,
    readLocalFileContent,
} from "@/services/file-services/ai-file-change-service";
import { randomString } from "./test-utils";
import { join } from "node:path";
import fs from "fs/promises";

const { fileChanges } = schema;

const mockFetchStructuredOutput = mock(async () => {
    return {
        updatedContent: "Updated file content",
        explanation: "We changed some code here",
    };
});

spyOn(
    await import("@/utils/structured-output-fetcher"),
    "fetchStructuredOutput"
).mockImplementation(mockFetchStructuredOutput);

describe("ai-file-change-service", () => {
    beforeEach(async () => {
        // no special DB re-init needed if your global test setup does that
    });

    test("generateFileChange inserts a pending record", async () => {
        const tempFileName = `${randomString()}.ts`;
        await Bun.write(tempFileName, "Original content");

        const { changeId, diff } = await generateFileChange({
            filePath: tempFileName,
            prompt: "Refactor the code",
            db,
        });
        expect(changeId).toBeDefined();
        expect(diff).toBe("Updated file content");

        const record = await db.select().from(fileChanges).where((fc) => eq(fc.id, changeId)).get();
        expect(record).not.toBeUndefined();
        if (record) {
            expect(record.filePath).toContain(tempFileName);
        }

        // Cleanup the file
        await fs.rm(tempFileName);
    });

    test("confirmFileChange writes the new content to disk and marks as confirmed", async () => {
        const tempFileName = `${randomString()}.ts`;
        await Bun.write(tempFileName, "Old content");

        const [row] = await db.insert(fileChanges).values({
            filePath: tempFileName,
            originalContent: "Old content",
            suggestedDiff: "Better content",
            status: "pending",
            timestamp: Date.now(),
        }).returning();

        const success = await confirmFileChange(db, row.id);
        expect(success).toBe(true);

        const newContent = await Bun.file(tempFileName).text();
        expect(newContent).toBe("Better content");

        const updated = await db.select().from(fileChanges).where((fc) => eq(fc.id, row.id)).get();
        if (updated) {
            expect(updated.status).toBe("confirmed");
        }

        // Cleanup
        await fs.rm(tempFileName);
    });

    test("confirmFileChange returns false if no record found", async () => {
        const result = await confirmFileChange(db, 999999);
        expect(result).toBe(false);
    });

    test("getFileChange retrieves correct record or null if missing", async () => {
        const [row] = await db.insert(fileChanges).values({
            filePath: "somefile.ts",
            originalContent: "content",
            suggestedDiff: "diff",
            status: "pending",
            timestamp: 123,
        }).returning();

        const found = await getFileChange(db, row.id);
        expect(found).not.toBeNull();
        expect(found?.filePath).toBe("somefile.ts");

        const missing = await getFileChange(db, 999999);
        expect(missing).toBeNull();
    });

    test("readLocalFileContent returns file content", async () => {
        const tempFileName = `${randomString()}.txt`;
        await Bun.write(tempFileName, "Hello world");
        const data = await readLocalFileContent(tempFileName);
        expect(data).toBe("Hello world");
        await fs.rm(tempFileName);
    });

    test("readLocalFileContent throws if file missing", async () => {
        const tempFileName = join("fakePath", `${randomString()}.ts`);
        await expect(readLocalFileContent(tempFileName)).rejects.toThrow("Could not read file content");
    });
});