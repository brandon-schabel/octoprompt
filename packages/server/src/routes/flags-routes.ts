import { router } from "server-router";
import { json } from "@bnk/router";
import { flags, eq , } from "shared";
import { z } from "zod";
import { db } from "shared/database";

const getFlagParams = { params: z.object({ flagKey: z.string() }) } as const;

let flagsInitialized = false;

export const defaultFlags = {
    "feature-flags": {
        key: "feature-flags",
        enabled: true,
        description: "Indicates if feature flags have been initialized",
        data: ""
    },

} satisfies Record<string, {
    key: string;
    enabled: boolean;
    description: string;
    data: string;
}>;

const initiateFlags = async (): Promise<void> => {
    if (flagsInitialized) return;

    try {
        // Check if flags are already initialized
        const initFlag = await db
            .select()
            .from(flags)
            .where(eq(flags.key, 'feature-flags'));


        if (initFlag.length > 0) {
            flagsInitialized = true;
            return;
        }

        // Initialize all default flags
        const flagValues = Object.values(defaultFlags);

        for (const flag of flagValues) {
            await db.insert(flags).values({
                key: flag.key,
                enabled: flag.enabled,
                description: flag.description,
                data: flag.data
            });
        }

        flagsInitialized = true;
    } catch (error) {
        // Enhanced error logging
        console.error('Error initializing flags:', {
            error,
            stack: error instanceof Error ? error.stack : undefined,
            message: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error; // Re-throw to be caught by the route handler
    }
};

router.get("/api/flags/:flagKey", {
    validation: getFlagParams,
}, async (req, { params }) => {
    try {
        await initiateFlags();

        const result = await db
            .select()
            .from(flags)
            .where(eq(flags.key, params.flagKey));


        if (result.length === 0) {
            return json.error("Flag not found", 404);
        }

        return json({ success: true, flag: result[0] });
    } catch (error) {
        // Enhanced error logging
        console.error('Error in flag route:', {
            error,
            stack: error instanceof Error ? error.stack : undefined,
            message: error instanceof Error ? error.message : 'Unknown error',
            flagKey: params.flagKey
        });
        return json.error("Internal server error", 500);
    }
});

export { initiateFlags };