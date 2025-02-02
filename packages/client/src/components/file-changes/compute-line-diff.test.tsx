import { describe, test, expect } from "bun:test";
import { computeLineDiff, DiffChunk } from "./compute-line-diff";

describe("computeLineDiff", () => {
    test("returns common diff for identical texts", () => {
        const text = "line1\nline2\nline3";
        const diff = computeLineDiff(text, text);
        const expected: DiffChunk[] = [
            { type: "common", content: "line1" },
            { type: "common", content: "line2" },
            { type: "common", content: "line3" },
        ];
        expect(diff).toEqual(expected);
    });

    test("handles added lines when old text is empty", () => {
        const oldText = "";
        const newText = "line1\nline2";
        const diff = computeLineDiff(oldText, newText);
        const expected: DiffChunk[] = [
            { type: "add", content: "line1" },
            { type: "add", content: "line2" },
        ];
        expect(diff).toEqual(expected);
    });

    test("handles removed lines when new text is empty", () => {
        const oldText = "line1\nline2";
        const newText = "";
        const diff = computeLineDiff(oldText, newText);
        const expected: DiffChunk[] = [
            { type: "remove", content: "line1" },
            { type: "remove", content: "line2" },
        ];
        expect(diff).toEqual(expected);
    });

    test("handles mixed changes with one modified line", () => {
        const oldText = "line1\nline2\nline3";
        const newText = "line1\nline2 modified\nline3";
        const diff = computeLineDiff(oldText, newText);
        const expected: DiffChunk[] = [
            { type: "common", content: "line1" },
            { type: "remove", content: "line2" },
            { type: "add", content: "line2 modified" },
            { type: "common", content: "line3" },
        ];
        expect(diff).toEqual(expected);
    });

    test("handles complex changes with interleaved additions and removals", () => {
        const oldText = "A\nB\nC\nD\nE";
        const newText = "A\nB\nX\nD\nE";
        const diff = computeLineDiff(oldText, newText);
        const expected: DiffChunk[] = [
            { type: "common", content: "A" },
            { type: "common", content: "B" },
            { type: "remove", content: "C" },
            { type: "add", content: "X" },
            { type: "common", content: "D" },
            { type: "common", content: "E" },
        ];
        expect(diff).toEqual(expected);
    });

    test("handles empty strings for both old and new texts", () => {
        const oldText = "";
        const newText = "";
        const diff = computeLineDiff(oldText, newText);
        const expected: DiffChunk[] = [];
        expect(diff).toEqual(expected);
    });
});