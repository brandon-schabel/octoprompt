// packages/server/src/utils/database.ts
import { BunSQLiteDatabase, drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { sqliteDBPath, migrationsDir as migrationsDirPath } from './db-config';
import { schema } from 'shared';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

let db: BunSQLiteDatabase<typeof schema>;

if (process.env.NODE_ENV === 'test') {
    // Use an in-memory database for tests and run migrations
    const sqlite = new Database(":memory:");
    db = drizzle(sqlite, { schema });
    await migrate(db, { migrationsFolder: migrationsDirPath });
} else {
    const isDev = process.env.DEV === 'true';
    const sqlite = new Database(isDev ? sqliteDBPath : 'sqlite.db');
    db = drizzle(sqlite, { schema });
}

export type {
    InferSelectModel,
    InferInsertModel,
} from 'drizzle-orm';

export type {
    SQL,
    SQLWrapper,
} from 'drizzle-orm/sql';

export {
    eq,
    and,
    or,
    not,
    sql,
    inArray,
    desc,
} from 'drizzle-orm';

export type AppDB = BunSQLiteDatabase<typeof schema>;

export { db };
export default db;