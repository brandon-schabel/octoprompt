import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { db, eq } from "@db";
import { schema, GlobalState } from "shared";
import {
    summarizeSingleFile,
    summarizeFiles,
    forceSummarizeFiles,
    forceResummarizeSelectedFiles,
    shouldSummarizeFile
} from "@/services/file-services/file-summary-service";
import { randomString } from "./test-utils";
import { unifiedProvider } from "@/services/model-providers/providers/unified-provider-service";

const { files } = schema;

const mockProcessMessage = mock(async () => {
    // returning a mock ReadableStream that yields "Mock summary"
    let done = false;
    return new ReadableStream<Uint8Array>({
        pull(controller) {
            if (!done) {
                controller.enqueue(new TextEncoder().encode("Mock summary"));
                done = true;
            }
            controller.close();
        },
    });
});

mock.module("@/services/model-providers/providers/unified-provider-service", () => ({
    unifiedProvider: {
      processMessage: mockProcessMessage,
    },
}));

describe("file-summary-service", () => {
    let projectId: string;
    let globalState: GlobalState;

    beforeEach(async () => {
        projectId = randomString();
        globalState = {
            settings: {
                summarizationEnabledProjectIds: [projectId],
                summarizationIgnorePatterns: [],
                summarizationAllowPatterns: [],
            },
            // other fields omitted
        } as any;
    });

    test("shouldSummarizeFile returns false if project not in enabled list", async () => {
        const result = await shouldSummarizeFile("otherProject", "foo.ts");
        expect(result).toBe(false);
    });

    test("summarizeSingleFile does nothing if file is empty", async () => {
        const file = await db.insert(files).values({
            projectId,
            name: "EmptyFile",
            path: "empty.ts",
            extension: ".ts",
            size: 0,
            content: "",
        }).returning().then(r => r[0]);

        await summarizeSingleFile(file);
        const fetched = await db.select().from(files).where((f) => eq(f.id, file.id)).then(r => r[0] ?? null);
        expect(fetched?.summary).toBe(null);
    });

    test("summarizeSingleFile calls provider if file not empty", async () => {
        const file = await db.insert(files).values({
            projectId,
            name: "NonEmptyFile",
            path: "nonempty.ts",
            extension: ".ts",
            size: 10,
            content: "function test() {}",
        }).returning().then(r => r[0]);

        await summarizeSingleFile(file);
        const updated = await db.select().from(files).where((f) => eq(f.id, file.id)).then(r => r[0] ?? null);
        expect(updated?.summary).toBe("Mock summary");
    });

    test("summarizeFiles includes only files from the same project if project is enabled", async () => {
        const f1 = await db.insert(files).values({
            projectId,
            name: "F1",
            path: "f1.ts",
            extension: ".ts",
            size: 200,
            content: "f1 content",
        }).returning().then(r => r[0]);

        const f2 = await db.insert(files).values({
            projectId: "other",
            name: "F2",
            path: "f2.ts",
            extension: ".ts",
            size: 300,
            content: "f2 content",
        }).returning().then(r => r[0]);

        const result = await summarizeFiles(projectId, [f1, f2], globalState);
        expect(result.included).toBe(1);
        expect(result.skipped).toBe(1);
    });

    test("forceSummarizeFiles ignores existing summary", async () => {
        const file = await db.insert(files).values({
            projectId,
            name: "AlreadyHasSummary",
            path: "hasSummary.ts",
            extension: ".ts",
            size: 10,
            content: "existing content",
            summary: "existing summary",
            summaryLastUpdatedAt: new Date(),
        }).returning().then(r => r[0]);

        await forceSummarizeFiles(projectId, [file], globalState);
        const updated = await db.select().from(files).where((f) => eq(f.id, file.id)).then(r => r[0] ?? null);
        expect(updated?.summary).toBe("Mock summary");
    });

    test("forceResummarizeSelectedFiles returns how many were actually summarized", async () => {
        const fileA = await db.insert(files).values({
            projectId,
            name: "A",
            path: "a.ts",
            extension: ".ts",
            size: 10,
            content: "file A",
        }).returning().then(r => r[0]);

        // not in the same project => skip
        const fileB = await db.insert(files).values({
            projectId: "otherProj",
            name: "B",
            path: "b.ts",
            extension: ".ts",
            size: 10,
            content: "file B",
        }).returning().then(r => r[0]);

        const result = await forceResummarizeSelectedFiles(projectId, [fileA, fileB], globalState);
        expect(result.included).toBe(1);
        expect(result.skipped).toBe(1);
    });
});