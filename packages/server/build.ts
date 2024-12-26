import { execSync } from "child_process";
import { mkdirSync, copyFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { createWriteStream } from "node:fs";
import archiver from "archiver";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "shared/schema";  // adjust path as needed

const startTime = performance.now();

// clear dist
execSync("rm -rf dist", { stdio: "inherit" });

// Build client first
console.log("Building client...");
execSync("cd ../client && npm run build", { stdio: "inherit" });

// Build server as normal JS bundle first
console.log("Building server...");
await Bun.build({
    entrypoints: ['./server.ts'],
    outdir: './dist',
    target: 'bun',
    minify: true,
    sourcemap: 'external',
    plugins: []
});

// Prepare dist folder
console.log("Copying required files to dist...");
mkdirSync(join("dist", "client-dist"), { recursive: true });

// Modify the database creation and migration section
console.log("Creating and migrating database...");
try {
    execSync("rm -f dist/sqlite.db", { stdio: "inherit" });
} catch (error) {
    console.log("No existing database to remove");
}

// Create the dist directory first if it doesn't exist
mkdirSync("dist", { recursive: true });

// Create and migrate the database directly
const sqlite = new Database("dist/sqlite.db");
const db = drizzle(sqlite, { schema });

// Apply migrations programmatically
console.log("Applying migrations...");
await migrate(db, {
    migrationsFolder: "./drizzle"
});

// Close the database connection
sqlite.close();

// Write modified package.json to dist
const pkg = require("./package.json");
pkg.scripts = {
    "start": "bun ./server.js"
};
Bun.write(join("dist", "package.json"), JSON.stringify(pkg, null, 2));

// Copy built client files
console.log("Copying built client files to server dist...");
execSync("cp -r ./client-dist/* ./dist/client-dist/", { stdio: "inherit" });

copyFileSync("../../instructions.md", join("dist", "instructions.md"));

// Define targets with proper executable extensions
const bundleNamePrefix = `${pkg.name}-${pkg.version}`;
type PlatformTarget = {
    name: string;
    target: string;
    executableExt: string;
};

const targets: PlatformTarget[] = [
    { name: `${bundleNamePrefix}-linux-x64`, target: "bun-linux-x64", executableExt: "" },
    { name: `${bundleNamePrefix}-macos-x64`, target: "bun-darwin-x64", executableExt: "" },
    { name: `${bundleNamePrefix}-macos-arm64`, target: "bun-darwin-arm64", executableExt: "" },
    { name: `${bundleNamePrefix}-windows-x64`, target: "bun-windows-x64", executableExt: ".exe" }
];

for (const { name, target, executableExt } of targets) {
    console.log(`Creating ${name} standalone executable...`);
    const platformDir = join("dist", name);
    mkdirSync(platformDir, { recursive: true });

    // Copy the database from dist to platform directory
    copyFileSync(join("dist", "sqlite.db"), join(platformDir, "sqlite.db"));
    // Ensure proper file permissions
    chmodSync(join(platformDir, "sqlite.db"), 0o644);

    // Build the standalone binary with version in the name
    const executableName = `${pkg.name}-v${pkg.version}${executableExt}`;
    execSync(
        `bun build --compile --target=${target} ./server.ts --outfile ${join(platformDir, executableName)}`,
        { stdio: "inherit" }
    );

    // For non-Windows platforms, ensure the executable has proper permissions
    if (!executableExt) {
        chmodSync(join(platformDir, executableName), 0o755);
    }

    // Copy the already migrated sqlite.db and instructions.md to this platform directory
    copyFileSync(join("dist", "instructions.md"), join(platformDir, "instructions.md"));

    // Create a zip archive with the versioned name
    console.log(`Creating zip archive for ${name}...`);
    try {
        await createZipArchive(platformDir, `${platformDir}.zip`);
        // Rename the zip file to include version
        execSync(`mv ${platformDir}.zip dist/${name}.zip`, { stdio: "inherit" });
    } catch (error) {
        console.error(`Failed to create zip archive for ${name}:`, error);
        process.exit(1);
    }
}

console.log("Platform-specific bundles created successfully!");

// Add at the very end of the file, before the last function
const endTime = performance.now();
const totalSeconds = ((endTime - startTime) / 1000).toFixed(2);
console.log(`\nBuild completed in ${totalSeconds} seconds`);

function createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const output = createWriteStream(outputPath);
        const archive = archiver("zip", {
            zlib: { level: 9 }
        });

        output.on("close", () => {
            console.log(`Zip archive created successfully: ${archive.pointer()} total bytes`);
            resolve();
        });

        archive.on("error", (err) => {
            reject(err);
        });

        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}