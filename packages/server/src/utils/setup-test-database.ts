// packages/server/test-utils/setup-test-db.ts
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrationsDir as migrationsDirPath } from "./db-config";

interface CreateTestDatabaseOptions {
    /**
     * Optionally override the migrations folder path.
     * Defaults to the "drizzle" folder in shared package.
     */
    migrationsFolder?: string;
}

/**
 * Creates a new in-memory SQLite database using Bun, initializes Drizzle,
 * and runs migrations from the specified folder.
 */
export async function setupTestDatabase(
    options: CreateTestDatabaseOptions = {}
): Promise<BunSQLiteDatabase> {
    // Create a new in-memory SQLite DB (unique to each test invocation)
    const memoryDB = new Database(":memory:");
    const db = drizzle(memoryDB);

    // Default location of migrations, adjust if your folder layout differs
    const migrationsDir =
        options.migrationsFolder ??
        migrationsDirPath;

    // Run all migrations against this fresh in-memory DB
    await migrate(db, { migrationsFolder: migrationsDir });

    return db;
}