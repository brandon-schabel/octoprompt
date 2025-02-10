import path from "path";

export const migrationsDir = path.resolve(import.meta.dir, "../../drizzle");
export const databaseInitPath = path.resolve(import.meta.dir, "database.ts");
export const sqliteDBPath = path.resolve(import.meta.dir, "../../sqlite.db");