import { $ } from "bun";
import { join } from "path";

async function startClientDev() {
  try {
    const rootDir = process.cwd();
    
    // Start client (Vite runs on 5173 by default)
    console.log("🚀 Starting client...");
    const clientProcess = Bun.spawn(["bun", "run", "dev"], {
      cwd: join(rootDir, "packages", "client"),
      stdio: ["inherit", "inherit", "inherit"],
    });

    // Handle process termination
    process.on("SIGINT", () => {
      console.log("\n👋 Shutting down client...");
      clientProcess.kill();
      process.exit(0);
    });

    // Keep the script running
    await new Promise(() => {});
  } catch (error) {
    console.error("❌ Error starting client:", error);
    process.exit(1);
  }
}

await startClientDev(); 