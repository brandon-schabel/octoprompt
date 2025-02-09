// File: packages/server/src/tests/file-sync-server.test.ts
import { describe, test, expect, spyOn } from "bun:test";
import { db, eq } from "@db";
import { schema } from "shared";
import { syncProject, getTextFiles, computeChecksum } from "@/services/file-services/file-sync-service";
import * as fs from "node:fs";
import { join } from "node:path";

const { files, projects } = schema;

describe("file-sync-service", () => {
    test("computeChecksum returns a hex string", () => {
        const sum = computeChecksum("Hello");
        expect(sum).toMatch(/^[0-9a-f]+$/i);
    });

    test("getTextFiles returns only matching extension files", () => {
        // @ts-ignore
        spyOn(fs, "readdirSync").mockImplementation((path: fs.PathLike, options?: fs.ObjectEncodingOptions & { withFileTypes?: boolean }) => {
            if (options && options.withFileTypes) {
                return [
                    { name: "file1.ts", isDirectory: () => false } as fs.Dirent,
                    { name: "file2.txt", isDirectory: () => false } as fs.Dirent,
                    { name: "folder", isDirectory: () => true } as fs.Dirent,
                ];
            } else {
                return ["file1.ts", "file2.txt", "folder"] as fs.Dirent[] | string[];
            }
        });
        spyOn(fs, "statSync").mockImplementation(() => ({ size: 12n } as any));

        const result = getTextFiles("/fakeDir", []);
        expect(result.length).toBe(2);
    });

    test("syncProject inserts or updates DB records, removes missing", async () => {
        const project = await db.insert(projects).values({
            name: "SyncProject",
            path: "/tmp/test-sync",
        }).returning().then(r => r[0]);

        // Pre-insert a file that will later be removed
        const oldFile = await db.insert(files).values({
            projectId: project.id,
            name: "old.ts",
            path: "old.ts",
            extension: ".ts",
            size: 100,
            content: "old content",
        }).returning().then(r => r[0]);

        // @ts-ignore
        spyOn(fs, "readdirSync").mockImplementation((path: fs.PathLike, options?: fs.ObjectEncodingOptions & { withFileTypes?: boolean }) => {
            if (options && options.withFileTypes) {
                return [
                    { name: "keep.ts", isDirectory: () => false } as fs.Dirent,
                    { name: "update.ts", isDirectory: () => false } as fs.Dirent,
                ];
            } else {
                return ["keep.ts", "update.ts"] as fs.Dirent[] | string[];
            }
        });

        spyOn(fs, "readFileSync").mockImplementation(
            // @ts-ignore
            (path: fs.PathOrFileDescriptor, options?: { encoding: BufferEncoding | null; flag?: string | undefined; } | BufferEncoding | null) => {
                const filePath = path as string;
                if (filePath.endsWith("keep.ts")) return "keep content";
                if (filePath.endsWith("update.ts")) return "update content";
                return "";
            }
        );

        spyOn(fs, "statSync").mockImplementation(() => ({ size: 99n } as any));

        await syncProject(project);

        // Verify that the old file has been removed
        const maybeOld = await db.select().from(files)
            .where(eq(files.id, oldFile.id))
            .get();
        expect(maybeOld).toBeUndefined();

        // Verify that keep.ts and update.ts are present in the DB
        const all = await db.select().from(files)
            .where(eq(files.projectId, project.id));
        expect(all.length).toBe(2);
        expect(all.find(x => x.path === "keep.ts")).toBeTruthy();
        expect(all.find(x => x.path === "update.ts")).toBeTruthy();
    });
});
