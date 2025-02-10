import { z } from "zod";
import { KVKey } from "./kv-keys";

export const KvSchemas = {
    myKey: z.string(),
    anotherKey: z.number(),
    userSettings: z.object({
        theme: z.enum(["light", "dark"]),
        notifications: z.boolean(),
    }),
} satisfies Record<KVKey, z.ZodTypeAny>; // CRITICAL for type safety

// Helper type to get the value type for a given key
export type KVValue<K extends KVKey> = z.infer<typeof KvSchemas[K]>; 