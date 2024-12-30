import { router } from "server-router";
import { json } from "@bnk/router";
import { ApiError } from 'shared';
import { flags, eq } from "shared";
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
    const initFlag = await db
        .select()
        .from(flags)
        .where(eq(flags.key, 'feature-flags'));

    if (initFlag.length > 0) {
        flagsInitialized = true;
        return;
    }

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
};

router.get("/api/flags/:flagKey", {
    validation: getFlagParams,
}, async (_, { params }) => {
    await initiateFlags();

    const result = await db
        .select()
        .from(flags)
        .where(eq(flags.key, params.flagKey));

    if (result.length === 0) {
        throw new ApiError("Flag not found", 404, "FLAG_NOT_FOUND");
    }

    return json({ success: true, flag: result[0] });
});

export { initiateFlags };