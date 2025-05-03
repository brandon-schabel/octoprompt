import { z, ZodError, type ZodTypeAny } from 'zod';
import path from 'node:path';
// --- Helper Function ---

/**
 * Resolves a path input (string or array) into a normalized file path
 * ensuring it ends with '.json'.
 * @param rawPath - The path input, either a slash-separated string or an array of segments.
 * @param basePath - Optional base directory to resolve relative paths from (defaults to process.cwd()).
 * @returns The absolute path ending with '.json'.
 */
function resolveJsonPath(rawPath: string | string[], basePath: string = process.cwd()): string {
    let joinedPath: string;

    if (Array.isArray(rawPath)) {
        // Filter out any empty segments that might result from splitting
        const segments = rawPath.filter(segment => segment && typeof segment === 'string' && segment.trim() !== '');
        if (segments.length === 0) {
            throw new Error("Invalid path input: Path array cannot be empty or contain only empty strings.");
        }
        joinedPath = path.join(...segments);
    } else if (typeof rawPath === 'string' && rawPath.trim() !== '') {
        // Normalize slashes and remove leading/trailing slashes for consistent joining
        joinedPath = rawPath.trim().replace(/\\/g, '/');
        if (path.isAbsolute(joinedPath)) {
            // If it's already absolute, normalize it
            joinedPath = path.normalize(joinedPath);
        }
        // If it's relative, join it with the base path later
    } else {
        throw new Error("Invalid path input: Path must be a non-empty string or a non-empty array of strings.");
    }

    // Ensure the path ends with .json
    if (!joinedPath.toLowerCase().endsWith('.json')) {
        joinedPath += '.json';
    }

    // Resolve the path to an absolute path if it's not already
    if (!path.isAbsolute(joinedPath)) {
        return path.resolve(basePath, joinedPath);
    }

    return joinedPath; // Already absolute and normalized
}


// --- Type Definitions ---

/**
 * Options for the writeJson function.
 */
interface WriteJsonOptions<TData, S extends ZodTypeAny | undefined> {
    /** The path to the JSON file. Can be relative or absolute, string or array of segments. */
    path: string | string[];
    /** The data to write to the file. */
    data: TData;
    /** Optional Zod schema to validate the data against before writing. */
    schema?: S;
    /** Optional base directory for resolving relative paths. Defaults to current working directory. */
    basePath?: string;
}

/**
 * Options for the readJson function.
 */
interface ReadJsonOptions {
    /** The path to the JSON file. Can be relative or absolute, string or array of segments. */
    path: string | string[];
    /** Optional base directory for resolving relative paths. Defaults to current working directory. */
    basePath?: string;
}

// --- Core Functions ---

/**
 * Writes data to a JSON file, optionally validating it with a Zod schema.
 * Creates directories if they don't exist.
 *
 * @param options - The options object containing path, data, and optional schema.
 * @returns A Promise that resolves with the validated data (if schema provided)
 * or the original data (if no schema provided), or rejects on error.
 */
export async function writeJson<
    TData,
    S extends ZodTypeAny | undefined = undefined
>(
    options: WriteJsonOptions<TData, S>
): Promise<S extends ZodTypeAny ? z.infer<S> : TData> {
    const { path: rawPath, data, schema, basePath } = options;
    const filePath = resolveJsonPath(rawPath, basePath);

    try {
        let dataToWrite: any = data;

        // 1. Validate data if schema is provided
        if (schema) {
            // Use parseAsync for potentially async refinements/transforms
            const validationResult = await schema.safeParseAsync(data);
            if (!validationResult.success) {
                // Throw a more informative error
                console.error(`Zod validation failed for path: ${filePath}`);
                throw new ZodError(validationResult.error.errors);
            }
            dataToWrite = validationResult.data; // Use the potentially transformed data
        }

        // 2. Stringify the data (validated or original)
        const jsonString = JSON.stringify(dataToWrite, null, 2); // Pretty print JSON

        // 3. Write the file using Bun.write (creates directories automatically)
        await Bun.write(filePath, jsonString);

        console.log(`Successfully wrote JSON to: ${filePath}`);

        // 4. Return the data that was actually written
        //    (validated version if schema was provided, original otherwise)
        return dataToWrite as S extends ZodTypeAny ? z.infer<S> : TData;

    } catch (error) {
        console.error(`Error writing JSON to ${filePath}:`, error);
        if (error instanceof ZodError) {
            // Re-throw Zod errors specifically if needed downstream
            throw error;
        }
        // Throw a generic error for other issues (e.g., file system permissions)
        throw new Error(`Failed to write JSON file at ${filePath}. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Reads and parses a JSON file.
 * Does *not* perform validation on read.
 *
 * @param options - The options object containing the path.
 * @param T - Optional generic type for the expected JSON structure. Defaults to `unknown`.
 * @returns A Promise that resolves with the parsed JSON data (typed as T)
 * or null if the file doesn't exist. Rejects on parsing or other read errors.
 */
export async function readJson<T = unknown>(
    options: ReadJsonOptions
): Promise<T | null> {
    const { path: rawPath, basePath } = options;
    const filePath = resolveJsonPath(rawPath, basePath);
    const file = Bun.file(filePath);

    try {
        // Check if the file exists first
        if (!(await file.exists())) {
            console.warn(`JSON file not found at: ${filePath}`);
            return null; // Return null if file doesn't exist
        }

        // Read and parse the JSON content
        const jsonData = await file.json();
        console.log(`Successfully read JSON from: ${filePath}`);
        return jsonData as T;

    } catch (error) {
        console.error(`Error reading or parsing JSON from ${filePath}:`, error);
        // Throw a specific error for reading/parsing issues
        throw new Error(`Failed to read or parse JSON file at ${filePath}. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export const jsonScribe = {
    write: writeJson,
    read: readJson,
}
