import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Database } from "bun:sqlite";

// Use an environment variable to determine the database file.
const dbFilename = process.env.DB_FILENAME || ":memory:"; // Default to in-memory
const sqlite = new Database(dbFilename);
const db = drizzle(sqlite);

// This will run your migrations on the database.  Make sure your migrations
// are in the 'drizzle' folder relative to *this* file (migrate-db.ts).
migrate(db, { migrationsFolder: "drizzle" }) // Or wherever your migrations are
  .then(() => {
    console.log("Migrations complete!");
    process.exit(0); // Exit cleanly after migrations
  })
  .catch((err) => {
    console.error("Migrations failed:", err);
    process.exit(1); // Exit with an error code
  }); 