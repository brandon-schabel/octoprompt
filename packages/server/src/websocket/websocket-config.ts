// websocket-config.ts
import { globalStateSchema, createInitialGlobalState, type GlobalState } from "shared";
import { db } from "shared/database";
import { globalStateTable, eq } from "shared";
import { ZodError } from "zod";

// --------------------------------------------------
// 1. In-Memory Cache
// --------------------------------------------------
// This holds your state in memory for fast reads/writes.
let inMemoryGlobalState: GlobalState | null = null;

// --------------------------------------------------
// 2. Fetch from Database
// --------------------------------------------------
async function loadFromDb(): Promise<GlobalState> {
    const row = await db
        .select()
        .from(globalStateTable)
        .where(eq(globalStateTable.id, "main"))
        .get();

    if (!row) {
        // No stored state in DB; create a fresh one and persist
        const initialState = createInitialGlobalState();
        await db
            .insert(globalStateTable)
            .values({ id: "main", state_json: JSON.stringify(initialState) })
            .run();
        return initialState;
    }

    // Validate or fall back if the schema fails
    try {
        const parsed = JSON.parse(row.state_json);
        return globalStateSchema.parse(parsed);
    } catch (err) {
        if (err instanceof ZodError) {
            // If DB state is invalid, reset to a known good state
            const fallback = createInitialGlobalState();
            await saveToDb(fallback);
            return fallback;
        }
        throw err;
    }
}

// --------------------------------------------------
// 3. Save to Database
// --------------------------------------------------
async function saveToDb(newState: GlobalState): Promise<void> {
    const exists = await db
        .select()
        .from(globalStateTable)
        .where(eq(globalStateTable.id, "main"))
        .get();

    if (!exists) {
        await db
            .insert(globalStateTable)
            .values({ id: "main", state_json: JSON.stringify(newState) })
            .run();
    } else {
        await db
            .update(globalStateTable)
            .set({ state_json: JSON.stringify(newState) })
            .where(eq(globalStateTable.id, "main"))
            .run();
    }
}

// --------------------------------------------------
// 4. getState / setState for BNK manager
// --------------------------------------------------
export async function getState(): Promise<GlobalState> {
    // If our in-memory copy is null, load from DB once
    if (!inMemoryGlobalState) {
        inMemoryGlobalState = await loadFromDb();
    }
    // Return a clone (structuredClone or deep copy) to avoid accidental mutations
    return structuredClone(inMemoryGlobalState);
}

export async function setState(newState: GlobalState): Promise<void> {
    // Update in-memory copy
    inMemoryGlobalState = structuredClone(newState);

    // Optionally, write to DB immediately. 
    // If you'd rather do periodic saves, comment this out or queue it in an interval.
    await saveToDb(inMemoryGlobalState);
}

// --------------------------------------------------
// 5. Optional: Periodic DB Save Interval
// --------------------------------------------------
const SAVE_INTERVAL_MS = 10_000; // e.g. 10 seconds
setInterval(async () => {
    if (inMemoryGlobalState) {
        await saveToDb(inMemoryGlobalState);
        // console.log("[PeriodicSync] State saved to DB");
    }
}, SAVE_INTERVAL_MS);