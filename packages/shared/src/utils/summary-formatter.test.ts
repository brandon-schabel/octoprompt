import { test, expect } from "bun:test";
import { buildCombinedFileSummaries, type SummaryFormatOptions } from "./summary-formatter";

interface TestProjectFile {
    name: string;
    summary?: string;
}

test("returns 'No files provided.' when file list is empty", () => {
    const result = buildCombinedFileSummaries([]);
    expect(result).toBe("No files provided.");
});

test("formats a single file with a summary using default options", () => {
    const files: TestProjectFile[] = [
        { name: "TestFile.ts", summary: "This is a summary." }
    ];
    const result = buildCombinedFileSummaries(files as any);

    const expected =
        `<summary_memory>
File: TestFile.ts
This is a summary.
----------------------------------------

</summary_memory>`;
    expect(result).toBe(expected);
});

test("skips files with empty summary when includeEmptySummaries is false", () => {
    const files: TestProjectFile[] = [
        { name: "File1.ts", summary: "Valid summary" },
        { name: "File2.ts", summary: "   " } // Whitespace-only summary
    ];
    const result = buildCombinedFileSummaries(files as any);
    const expected =
        `<summary_memory>
File: File1.ts
Valid summary
----------------------------------------

</summary_memory>`;
    expect(result).toBe(expected);
});

test("includes files with empty summary when includeEmptySummaries is true", () => {
    const files: TestProjectFile[] = [
        { name: "File1.ts", summary: "Valid summary" },
        { name: "File2.ts", summary: "   " } // Whitespace-only summary treated as empty
    ];
    const options: SummaryFormatOptions = { includeEmptySummaries: true };
    const result = buildCombinedFileSummaries(files as any, options);
    // For File2, summary becomes "(No summary provided)"
    const expected =
        `<summary_memory>
File: File1.ts
Valid summary
----------------------------------------

File: File2.ts
(No summary provided)
----------------------------------------

</summary_memory>`;
    expect(result).toBe(expected);
});

test("applies custom headerStyle and footerStyle functions", () => {
    const files: TestProjectFile[] = [
        { name: "CustomFile.ts", summary: "Custom summary" }
    ];
    const options: SummaryFormatOptions = {
        headerStyle: (file: TestProjectFile) => `*** ${file.name} ***`,
        footerStyle: (file: TestProjectFile) => `*** End of ${file.name} ***`
    };
    const result = buildCombinedFileSummaries(files as any, options);
    const expected =
        `<summary_memory>
*** CustomFile.ts ***
Custom summary
*** End of CustomFile.ts ***
----------------------------------------

</summary_memory>`;
    expect(result).toBe(expected);
});

test("formats multiple files with valid summaries", () => {
    const files: TestProjectFile[] = [
        { name: "File1.ts", summary: "Summary 1" },
        { name: "File2.ts", summary: "Summary 2" }
    ];
    const result = buildCombinedFileSummaries(files as any);
    const expected =
        `<summary_memory>
File: File1.ts
Summary 1
----------------------------------------

File: File2.ts
Summary 2
----------------------------------------

</summary_memory>`;
    expect(result).toBe(expected);
});

test("handles undefined summary when includeEmptySummaries is true", () => {
    const files: TestProjectFile[] = [
        { name: "FileWithUndefined", summary: undefined }
    ];
    const options: SummaryFormatOptions = { includeEmptySummaries: true };
    const result = buildCombinedFileSummaries(files as any, options);
    const expected =
        `<summary_memory>
File: FileWithUndefined
(No summary provided)
----------------------------------------

</summary_memory>`;
    expect(result).toBe(expected);
});