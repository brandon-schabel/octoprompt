import { test, expect } from "bun:test";
// Assuming the refactored function is in './summary-formatter-xml.ts'
// Adjust the import path as necessary
import { buildCombinedFileSummariesXml, type SummaryXmlOptions } from "./summary-formatter";
import type { ProjectFile } from "../schemas/project.schemas"; // Assuming this path is correct

// Use a compatible interface for testing, ProjectFile might have more fields
interface TestProjectFile {
    id: string;
    name: string;
    summary?: string;
}

test("returns empty <summary_memory> block when file list is empty", () => {
    const result = buildCombinedFileSummariesXml([]);
    // Updated expectation for empty XML block
    expect(result).toBe("<summary_memory>\n</summary_memory>");
});

test("formats a single file with a summary using default options (XML)", () => {
    const files: TestProjectFile[] = [
        { id: "file-1", name: "TestFile.ts", summary: "This is a summary." } // <--- ADD ID
    ];
    // Use the new function name. Cast might be needed if TestProjectFile isn't identical to ProjectFile
    const result = buildCombinedFileSummariesXml(files as ProjectFile[]);

    // Expected output is now XML
    const expected =
        `<summary_memory>
  <file>
    <file_id>file-1</file_id>
    <name>TestFile.ts</name>
    <summary>This is a summary.</summary>
  </file>
</summary_memory>`;
    expect(result).toBe(expected);
});

test("skips files with empty/whitespace summary when includeEmptySummaries is false (default)", () => {
    const files: TestProjectFile[] = [
        { id: "f1", name: "File1.ts", summary: "Valid summary" }, // <--- ADD ID
        { id: "f2", name: "File2.ts", summary: "   " },           // <--- ADD ID
        { id: "f3", name: "File3.ts", summary: undefined }        // <--- ADD ID
    ];
    const result = buildCombinedFileSummariesXml(files as ProjectFile[]);

    // Only File1 should be included in the XML
    const expected =
        `<summary_memory>
  <file>
    <file_id>f1</file_id>
    <name>File1.ts</name>
    <summary>Valid summary</summary>
  </file>
</summary_memory>`;
    expect(result).toBe(expected);
});

test("includes files with empty/undefined summary when includeEmptySummaries is true (XML)", () => {
    const files: TestProjectFile[] = [
        { id: "id_a", name: "File1.ts", summary: "Valid summary" }, // <--- ADD ID
        { id: "id_b", name: "File2.ts", summary: "   " },           // <--- ADD ID
        { id: "id_c", name: "File3.ts", summary: undefined }        // <--- ADD ID
    ];
    // Use the new options interface
    const options: SummaryXmlOptions = { includeEmptySummaries: true };
    const result = buildCombinedFileSummariesXml(files as ProjectFile[], options);

    // File2 and File3 should be included with the default placeholder
    const expected =
        `<summary_memory>
  <file>
    <file_id>id_a</file_id>
    <name>File1.ts</name>
    <summary>Valid summary</summary>
  </file>
  <file>
    <file_id>id_b</file_id>
    <name>File2.ts</name>
    <summary>(No summary provided)</summary>
  </file>
  <file>
    <file_id>id_c</file_id>
    <name>File3.ts</name>
    <summary>(No summary provided)</summary>
  </file>
</summary_memory>`;
    expect(result).toBe(expected);
});

test("uses custom emptySummaryText when includeEmptySummaries is true (XML)", () => {
    const files: TestProjectFile[] = [
        { id: "needs-id", name: "NeedsSummary.ts", summary: "" } // <--- ADD ID
    ];
    // Test the custom placeholder text option
    const options: SummaryXmlOptions = {
        includeEmptySummaries: true,
        emptySummaryText: "[Summary Missing]"
    };
    const result = buildCombinedFileSummariesXml(files as ProjectFile[], options);
    const expected =
        `<summary_memory>
  <file>
    <file_id>needs-id</file_id>
    <name>NeedsSummary.ts</name>
    <summary>[Summary Missing]</summary>
  </file>
</summary_memory>`;
    expect(result).toBe(expected);
});


test("formats multiple files with valid summaries (XML)", () => {
    const files: TestProjectFile[] = [
        { id: "multi-1", name: "File1.ts", summary: "Summary 1" }, // <--- ADD ID
        { id: "multi-2", name: "File2.js", summary: "Summary 2" }  // <--- ADD ID
    ];
    const result = buildCombinedFileSummariesXml(files as ProjectFile[]);
    const expected =
        `<summary_memory>
  <file>
    <file_id>multi-1</file_id>
    <name>File1.ts</name>
    <summary>Summary 1</summary>
  </file>
  <file>
    <file_id>multi-2</file_id>
    <name>File2.js</name>
    <summary>Summary 2</summary>
  </file>
</summary_memory>`;
    expect(result).toBe(expected);
});


test("correctly escapes special XML characters in name and summary", () => {
    const files: TestProjectFile[] = [
        // Input data remains the same
        { id: "escape_id", name: "file_with_<_&_>_chars.ts", summary: "Summary with \"quotes\" & 'apostrophes' > data <" }
    ];
    const result = buildCombinedFileSummariesXml(files as ProjectFile[]);
    const expected =
        `<summary_memory>
  <file>
    <file_id>escape_id</file_id>
    <name>file_with_&lt;_&amp;_&gt;_chars.ts</name>
    <summary>Summary with &quot;quotes&quot; &amp; &apos;apostrophes&apos; &gt; data &lt;</summary>
  </file>
</summary_memory>`;
    expect(result).toBe(expected);
});

// Removed the test for headerStyle/footerStyle as those options are no longer valid.
// Added a new test specifically for XML escaping.
// Added a test for custom emptySummaryText.