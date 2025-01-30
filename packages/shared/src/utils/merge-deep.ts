type JSONValue = string | number | boolean | null | object | JSONValue[];

/**
 * Deep merge two objects. 
 * For arrays and objects, it will recursively merge.
 * For primitive types, the second object's value overrides the first.
 */
export function mergeDeep<T extends JSONValue>(base: T, override: T): T {
    if (Array.isArray(base) && Array.isArray(override)) {
        // Example: if you always want the override array to take precedence:
        return override as T;
    } else if (isObject(base) && isObject(override)) {
        const result = { ...base as Record<string, unknown> };
        for (const key in override) {
            // For each key in override, recursively merge
            (result as any)[key] = mergeDeep((base as any)[key], (override as any)[key]);
        }
        return result as T;
    } else {
        // If not an object/array, override value wins (e.g. string, number, etc.)
        return override ?? base;
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}