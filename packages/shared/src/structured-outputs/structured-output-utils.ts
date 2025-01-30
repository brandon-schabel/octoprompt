import { z } from "zod";

export interface OpenRouterFunctionSpec {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
}

/**
 * Recursively convert a Zod schema into
 * an OpenRouter-compatible JSON schema. Minimal example.
 */
export function zodToOpenRouterJsonSchema<T extends z.ZodTypeAny>(
    zodSchema: T
): Record<string, unknown> {
    const def = zodSchema._def;

    switch (zodSchema._def.typeName) {
        /**
         * Unbox `ZodOptional`: we skip the optional wrapper and
         * convert the underlying schema to JSON schema.
         */
        case z.ZodFirstPartyTypeKind.ZodOptional: {
            const unwrapped = (def as z.ZodOptionalDef).innerType;
            return zodToOpenRouterJsonSchema(unwrapped);
        }

        /**
         * Similarly, if you need to handle .default() or .nullable(),
         * unbox them here. For example:
         *
         * case z.ZodFirstPartyTypeKind.ZodDefault: {
         *   return zodToOpenRouterJsonSchema((def as z.ZodDefaultDef).innerType);
         * }
         *
         * case z.ZodFirstPartyTypeKind.ZodNullable: {
         *   return zodToOpenRouterJsonSchema((def as z.ZodNullableDef).innerType);
         * }
         */

        case z.ZodFirstPartyTypeKind.ZodObject: {
            const shape = (def as z.ZodObjectDef).shape();
            const properties: Record<string, unknown> = {};
            const required: string[] = [];

            for (const key in shape) {
                const childSchema = shape[key];
                properties[key] = zodToOpenRouterJsonSchema(childSchema);

                // If the child is *not* optional, add to "required":
                // (We skip if child is optional, nullable, or default.)
                if (!isOptionalSchema(childSchema)) {
                    required.push(key);
                }
            }
            return {
                type: "object",
                properties,
                ...(required.length > 0 ? { required } : {}),
            };
        }

        case z.ZodFirstPartyTypeKind.ZodString:
            return { type: "string" };

        case z.ZodFirstPartyTypeKind.ZodNumber:
            return { type: "number" };

        case z.ZodFirstPartyTypeKind.ZodBoolean:
            return { type: "boolean" };

        case z.ZodFirstPartyTypeKind.ZodArray: {
            const arrayDef = def as z.ZodArrayDef;
            return {
                type: "array",
                items: zodToOpenRouterJsonSchema(arrayDef.type),
            };
        }

        case z.ZodFirstPartyTypeKind.ZodEnum: {
            const enumValues = (def as z.ZodEnumDef).values;
            return { type: "string", enum: enumValues };
        }

        default:
            // fallback for advanced or unhandled types
            // (union, tuple, literal, etc. would need more logic)
            throw new Error(`Unhandled Zod type: ${zodSchema._def.typeName}`);
    }
}

/**
 * Converts a Zod schema to an OpenRouter function spec.
 */
export function zodToOpenRouterFunctionSpec<T extends z.ZodTypeAny>(
    schemaName: string,
    description: string,
    zodSchema: T
): OpenRouterFunctionSpec {
    return {
        name: schemaName,
        description,
        parameters: zodToOpenRouterJsonSchema(zodSchema),
    };
}

/**
 * Checks if a schema is optional/nullable/default => not required.
 */
function isOptionalSchema(schema: z.ZodTypeAny): boolean {
    const typeName = schema._def.typeName;

    // True if it's optional, nullable, or default
    return (
        typeName === z.ZodFirstPartyTypeKind.ZodOptional ||
        typeName === z.ZodFirstPartyTypeKind.ZodNullable ||
        typeName === z.ZodFirstPartyTypeKind.ZodDefault
    );
}