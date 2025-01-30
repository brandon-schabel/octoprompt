/** packages/shared/src/structured-outputs/structured-output-utils.test.ts */
import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { zodToOpenRouterJsonSchema, zodToOpenRouterFunctionSpec } from "./structured-output-utils";

describe("structured-output-utils", () => {
    it("converts a simple object schema", () => {
        const schema = z.object({
            title: z.string(),
            count: z.number().min(0),
            tags: z.array(z.string()).optional(),
        });
        const jsonSchema = zodToOpenRouterJsonSchema(schema);

        // Basic shape checks
        expect(jsonSchema).toEqual({
            type: "object",
            properties: {
                title: { type: "string" },
                count: { type: "number" },
                tags: {
                    type: "array",
                    items: { type: "string" },
                },
            },
            required: ["title", "count"],
        });
    });

    it("marks optional fields as not required", () => {
        const schema = z.object({
            mandatory: z.string(),
            optionalField: z.string().optional(),
        });
        const jsonSchema = zodToOpenRouterJsonSchema(schema);
        // Expect only "mandatory" in required
        expect(jsonSchema).toEqual({
            type: "object",
            properties: {
                mandatory: { type: "string" },
                optionalField: { type: "string" },
            },
            required: ["mandatory"],
        });
    });

    it("creates an OpenRouter function spec", () => {
        const schema = z.object({
            name: z.string().min(1),
        });
        const fnSpec = zodToOpenRouterFunctionSpec(
            "createUser",
            "Creates a user with basic info",
            schema
        );
        expect(fnSpec.name).toBe("createUser");
        expect(fnSpec.parameters).toMatchObject({
            type: "object",
            properties: {
                name: { type: "string" },
            },
        });
    });
});