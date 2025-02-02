
/**
 * Recursively merges two or more objects.
 * Non-object inputs are skipped.
 * Arrays and primitive values are overwritten by later objects.
 *
 * @param objects - One or more objects to merge.
 * @returns A new object with merged properties.
 */
export function mergeDeep(...objects: any[]): any {
    // Return an empty object if no objects are provided.
    if (objects.length === 0) {
        return {};
    }

    const result: Record<string, any> = {};

    for (const obj of objects) {
        // Only process non-null objects that are not arrays.
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    const value = obj[key];

                    // If the value is an object (and not an array), merge recursively.
                    if (value && typeof value === "object" && !Array.isArray(value)) {
                        if (
                            result.hasOwnProperty(key) &&
                            result[key] &&
                            typeof result[key] === "object" &&
                            !Array.isArray(result[key])
                        ) {
                            result[key] = mergeDeep(result[key], value);
                        } else {
                            // Clone the object to avoid mutation.
                            result[key] = mergeDeep({}, value);
                        }
                    } else {
                        // For arrays and primitive values, override with the new value.
                        result[key] = value;
                    }
                }
            }
        }
    }

    return result;
}