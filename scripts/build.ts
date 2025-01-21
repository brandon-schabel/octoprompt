import { mkdirSync, copyFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { createWriteStream } from "node:fs";
import archiver from "archiver";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "../packages/shared/schema";
import { $ } from "bun";

async function buildProject() {
    const startTime = performance.now();
    const rootDir = process.cwd();
    const serverDir = join(rootDir, "packages", "server");
    const clientDir = join(rootDir, "packages", "client");
    const sharedDir = join(rootDir, "packages", "shared");
    const distDir = join(rootDir, "dist");

    // clear dist
    await $`rm -rf ${distDir}`;

    // Build client first
    console.log("Building client...");
    await $`cd ${clientDir} && bun run build`;

    // Build server as normal JS bundle first
    console.log("Building server...");
    await Bun.build({
        entrypoints: [join(serverDir, 'server.ts')],
        outdir: distDir,
        target: 'bun',
        minify: true,
        sourcemap: 'external',
        plugins: []
    });

    // Prepare dist folder
    console.log("Copying required files to dist...");
    mkdirSync(join(distDir, "client-dist"), { recursive: true });

    // Modify the database creation and migration section
    console.log("Creating and migrating database...");
    try {
        await $`rm -f ${join(distDir, "sqlite.db")}`;
    } catch (error) {
        console.log("No existing database to remove");
    }

    // Create and migrate the database directly
    const sqlite = new Database(join(distDir, "sqlite.db"));
    const db = drizzle(sqlite, { schema });

    // Apply migrations programmatically
    console.log("Applying migrations...");
    await migrate(db, {
        migrationsFolder: join(sharedDir, "drizzle")
    });

    // Close the database connection
    sqlite.close();

    // Write modified package.json to dist
    const pkg = require(join(serverDir, "package.json"));
    pkg.scripts = {
        "start": "bun ./server.js"
    };
    await Bun.write(join(distDir, "package.json"), JSON.stringify(pkg, null, 2));

    // Copy built client files
    console.log("Copying built client files to server dist...");
    await $`cp -r ${join(clientDir, "dist")}/* ${join(distDir, "client-dist")}/`;

    // Copy prompts folder
    console.log("Copying prompts folder to dist...");
    await $`cp -r ${join(serverDir, "prompts")} ${join(distDir, "prompts")}`;

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
        const platformDir = join(distDir, name);
        mkdirSync(platformDir, { recursive: true });

        // Copy the database from dist to platform directory
        copyFileSync(join(distDir, "sqlite.db"), join(platformDir, "sqlite.db"));
        // Ensure proper file permissions
        chmodSync(join(platformDir, "sqlite.db"), 0o644);

        // Copy prompts folder to platform directory
        await $`cp -r ${join(distDir, "prompts")} ${join(platformDir, "prompts")}`;

        // Copy client-dist folder to platform directory
        await $`cp -r ${join(distDir, "client-dist")} ${join(platformDir, "client-dist")}`;

        // Build the standalone binary with version in the name
        const executableName = `${pkg.name}-v${pkg.version}${executableExt}`;
        await $`cd ${serverDir} && bun build --compile --target=${target} ./server.ts --outfile ${join(platformDir, executableName)}`;

        // For non-Windows platforms, ensure the executable has proper permissions
        if (!executableExt) {
            chmodSync(join(platformDir, executableName), 0o755);
        }

        // Create a zip archive with the versioned name
        console.log(`Creating zip archive for ${name}...`);
        try {
            await createZipArchive(platformDir, `${platformDir}.zip`);
            // Rename the zip file to include version
            await $`mv ${platformDir}.zip ${join(distDir, name)}.zip`;
        } catch (error) {
            console.error(`Failed to create zip archive for ${name}:`, error);
            process.exit(1);
        }
    }

    console.log("Platform-specific bundles created successfully!");

    const endTime = performance.now();
    const totalSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\nBuild completed in ${totalSeconds} seconds`);
}

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

await buildProject(); 