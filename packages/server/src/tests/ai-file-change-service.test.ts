// File: packages/server/src/tests/ai-file-change-service.test.ts
import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { db } from "@db";  // <-- only db, no eq, no schema
import {
  generateFileChange,
  confirmFileChange,
  getFileChange,
  readLocalFileContent,
} from "@/services/file-services/ai-file-change-service";
import { randomString } from "./test-utils";
import { join } from "node:path";
import fs from "fs/promises";

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
    // If you have a global test setup that re-initializes or clears the DB, rely on that.
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

    // Raw query to find the new row
    const record = db
      .query("SELECT * FROM file_changes WHERE id = ?")
      .get(changeId);
    expect(record).not.toBeUndefined();
    if (record) {
      expect(record.file_path).toContain(tempFileName);
    }

    // Cleanup the file
    await fs.rm(tempFileName);
  });

  test("confirmFileChange writes the new content to disk and marks as confirmed", async () => {
    const tempFileName = `${randomString()}.ts`;
    await Bun.write(tempFileName, "Old content");

    // Insert a pending row manually via raw query
    db.run(
      `
      INSERT INTO file_changes (file_path, original_content, suggested_diff, status, timestamp)
      VALUES (?, ?, ?, ?, ?)
      `,
      [tempFileName, "Old content", "Better content", "pending", Date.now()]
    );
    const rowIdObj = db.query("SELECT last_insert_rowid() as id").get();
    const createdId = rowIdObj.id;

    const success = await confirmFileChange(db, createdId);
    expect(success).toBe(true);

    const newContent = await Bun.file(tempFileName).text();
    expect(newContent).toBe("Better content");

    const updated = db
      .query("SELECT * FROM file_changes WHERE id = ?")
      .get(createdId);
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
    // Manually insert a row
    db.run(
      `
      INSERT INTO file_changes (file_path, original_content, suggested_diff, status, timestamp)
      VALUES (?, ?, ?, ?, ?)
      `,
      ["somefile.ts", "content", "diff", "pending", 123]
    );
    const newId = db.query("SELECT last_insert_rowid() as id").get().id;

    const found = await getFileChange(db, newId);
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
    await expect(readLocalFileContent(tempFileName)).rejects.toThrow(
      "Could not read file content"
    );
  });
});