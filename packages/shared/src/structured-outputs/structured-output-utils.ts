// packages/shared/src/structured-outputs/structured-output-utils.ts
import { z } from "zod";

/**
 * The simplified schema type that OpenRouter expects.
 * Only supports object schemas with properties.
 */
export type JsonSchema = {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
};

// this is the old one 
export interface OpenRouterJSONSchema {
    type: "object" | "array" | "string" | "number" | "boolean";
    [key: string]: unknown; // could include 'properties', 'items', etc.
}



/**
 * This interface represents the entire "json_schema" object you pass
 * to OpenRouter, containing:
 *   - name: a short identifier (e.g. "weather")
 *   - strict: whether to enforce the schema strictly
 *   - schema: the JSON Schema definition
 */
export interface OpenRouterJSONSchemaDefinition {
    name: string;
    strict: boolean;
    schema: JSONSchema;
  }
  
  /**
   * This is the core JSONSchema type that OpenRouter expects:
   *   - If `type: "object"`, it must have `properties` (and optionally `required` and `additionalProperties`).
   *   - If `type: "array"`, it must have `items`.
   *   - If `type: "string" | "number" | "boolean"`, you can optionally specify `description` or `enum` (for strings).
   */
  export type JSONSchema =
    | JSONSchemaObject
    | JSONSchemaArray
    | JSONSchemaString
    | JSONSchemaNumber
    | JSONSchemaBoolean;
  
  /**
   * Object-type schema:
   *   - must have `properties`
   *   - can have `required`
   *   - can have `additionalProperties`
   */
  interface JSONSchemaObject {
    type: "object";
    description?: string;
    properties: Record<string, JSONSchema>;
    required?: string[];
    additionalProperties?: boolean;
  }
  
  /**
   * Array-type schema:
   *   - must have `items` (the schema for each array element)
   */
  interface JSONSchemaArray {
    type: "array";
    description?: string;
    items: JSONSchema;
  }
  
  /**
   * String-type schema:
   *   - can have `description` and an optional `enum`
   */
  interface JSONSchemaString {
    type: "string";
    description?: string;
    enum?: string[];
  }
  
  /**
   * Number-type schema:
   *   - can have `description`
   */
  interface JSONSchemaNumber {
    type: "number";
    description?: string;
  }
  
  /**
   * Boolean-type schema:
   *   - can have `description`
   */
  interface JSONSchemaBoolean {
    type: "boolean";
    description?: string;
  }

/**
 * Recursively convert a Zod schema into an OpenRouter-compatible JSON schema.
 */
export function zodToStructuredJsonSchema<T extends z.ZodTypeAny>(
    zodSchema: T
): JSONSchema {
    const def = zodSchema._def;

    switch (def.typeName) {
        case z.ZodFirstPartyTypeKind.ZodOptional: {
            const unwrapped = def.innerType;
            return zodToStructuredJsonSchema(unwrapped);
        }
        // Handle .nullable(), .default(), etc. similarly if needed.

        case z.ZodFirstPartyTypeKind.ZodObject: {
            const shape = def.shape();
            const properties: Record<string, JSONSchema> = {};
            const required: string[] = [];

            for (const key in shape) {
                const childSchema = shape[key];
                properties[key] = zodToStructuredJsonSchema(childSchema);

                if (!isOptionalSchema(childSchema)) {
                    required.push(key);
                }
            }

            return {
                type: "object",
                properties,
                additionalProperties: false,
                ...(required.length > 0 ? { required } : {}),
            };
        }
        case z.ZodFirstPartyTypeKind.ZodString:
            return { type: "string" } as JSONSchemaString;

        case z.ZodFirstPartyTypeKind.ZodNumber:
            return { type: "number" } as JSONSchemaNumber;

        case z.ZodFirstPartyTypeKind.ZodBoolean:
            return { type: "boolean" } as JSONSchemaBoolean;

        case z.ZodFirstPartyTypeKind.ZodArray: {
            const arrayDef = def as z.ZodArrayDef;
            return {
                type: "array",
                items: zodToStructuredJsonSchema(arrayDef.type),
            } as JSONSchemaArray;
        }

        case z.ZodFirstPartyTypeKind.ZodEnum: {
            const enumValues = def.values;
            return { type: "string", enum: enumValues } as JSONSchemaString;
        }

        default:
            throw new Error(
                `Unhandled or advanced Zod type: ${def.typeName}. Expand the function to handle unions, etc.`
            );
    }
}

function isOptionalSchema(schema: z.ZodTypeAny): boolean {
    const typeName = schema._def.typeName;
    return (
        typeName === z.ZodFirstPartyTypeKind.ZodOptional ||
        typeName === z.ZodFirstPartyTypeKind.ZodNullable ||
        typeName === z.ZodFirstPartyTypeKind.ZodDefault
    );
}

/**
 * Converts our rich JSONSchema type to OpenRouter's simpler JsonSchema format.
 * OpenRouter only supports object schemas with properties.
 */
export function toOpenRouterSchema(schema: JSONSchema): JsonSchema {
    if (schema.type !== "object") {
        throw new Error("OpenRouter only supports object schemas at the top level");
    }

    return {
        type: "object",
        properties: schema.properties,
        ...(schema.required ? { required: schema.required } : {}),
        ...(schema.additionalProperties !== undefined ? { additionalProperties: schema.additionalProperties } : {}),
    };
}