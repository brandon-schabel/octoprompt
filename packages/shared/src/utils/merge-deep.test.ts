import { describe, it, expect } from "bun:test";
import { mergeDeep } from "./merge-deep";

describe("mergeDeep", () => {
    it("should merge two flat objects", () => {
        const obj1 = { a: 1 };
        const obj2 = { b: 2 };
        const result = mergeDeep(obj1, obj2);
        expect(result).toEqual({ a: 1, b: 2 });
    });

    it("should override properties with later objects", () => {
        const obj1 = { a: 1, b: 2 };
        const obj2 = { a: 42 };
        const result = mergeDeep(obj1, obj2);
        expect(result).toEqual({ a: 42, b: 2 });
    });

    it("should merge nested objects", () => {
        const obj1 = { a: { b: 1 } };
        const obj2 = { a: { c: 2 } };
        const result = mergeDeep(obj1, obj2);
        expect(result).toEqual({ a: { b: 1, c: 2 } });
    });

    it("should override nested objects completely if a non-object is provided", () => {
        const obj1 = { a: { b: 1 } };
        const obj2 = { a: 2 };
        const result = mergeDeep(obj1, obj2);
        expect(result).toEqual({ a: 2 });
    });

    it("should merge multiple objects", () => {
        const obj1 = { a: 1, nested: { x: 10 } };
        const obj2 = { b: 2, nested: { y: 20 } };
        const obj3 = { c: 3, nested: { z: 30 } };
        const result = mergeDeep(obj1, obj2, obj3);
        expect(result).toEqual({
            a: 1,
            b: 2,
            c: 3,
            nested: { x: 10, y: 20, z: 30 },
        });
    });

    it("should handle arrays by overwriting them", () => {
        const obj1 = { a: [1, 2, 3] };
        const obj2 = { a: [4, 5] };
        const result = mergeDeep(obj1, obj2);
        // Assuming arrays are not merged element-wise but overwritten.
        expect(result).toEqual({ a: [4, 5] });
    });

    it("should not mutate the original objects", () => {
        const obj1 = { a: 1, nested: { b: 2 } };
        const obj2 = { nested: { c: 3 } };
        const clone1 = JSON.parse(JSON.stringify(obj1));
        const clone2 = JSON.parse(JSON.stringify(obj2));
        const result = mergeDeep(obj1, obj2);
        expect(obj1).toEqual(clone1);
        expect(obj2).toEqual(clone2);
    });

    it("should skip non-object inputs gracefully", () => {
        const obj1 = { a: 1 };
        // Passing null should be ignored in the merge.
        const result = mergeDeep(obj1, null, { b: 2 });
        expect(result).toEqual({ a: 1, b: 2 });
    });

    it("should merge correctly when one of the objects is empty", () => {
        const obj1 = { a: 1 };
        const obj2 = {};
        const result = mergeDeep(obj1, obj2);
        expect(result).toEqual({ a: 1 });
    });

    it("should return an empty object if no arguments are provided", () => {
        // Assuming mergeDeep supports no-argument call and returns an empty object.
        const result = mergeDeep();
        expect(result).toEqual({});
    });
});