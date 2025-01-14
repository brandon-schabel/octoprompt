import { $ } from "bun";
import { join } from "path";

type SetupOptions = {
  force?: boolean;
  verbose?: boolean;
};

async function setupDatabase(options: SetupOptions = {}) {
  const { force = false, verbose = false } = options;
  
  try {
    const rootDir = process.cwd();
    const sharedDir = join(rootDir, "packages", "shared");

    const log = verbose 
      ? console.log 
      : (..._: unknown[]) => {};

    log("📦 Setting up database...");
    log(`🚀 Changing to directory: ${sharedDir}`);
    
    process.chdir(sharedDir);

    // Check if database already exists
    const dbExists = await Bun.file("dev.db").exists();
    
    if (dbExists && !force) {
      console.log("⚠️ Database already exists. Use --force to recreate.");
      return;
    }

    log("⚡ Running database migrations...");
    await $`bun run migrate`.quiet();
    
    log("📤 Pushing schema changes...");
    await $`bun run push`.quiet();

    console.log("✅ Database setup completed successfully!");
  } catch (error) {
    console.error("❌ Error setting up database:", error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
await setupDatabase({
  force: args.includes("--force"),
  verbose: args.includes("--verbose")
}); 