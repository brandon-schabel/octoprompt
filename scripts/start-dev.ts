import { $ } from "bun";
import { join } from "path";

type Process = {
  kill: () => void;
};

async function startServices() {
  const processes: Process[] = [];

  try {
    const rootDir = process.cwd();
    // Start server (runs on 3147)
    // the server must be running first because the client needs 
    // to generate the openapi-ts client from the server's openapi spec located at /doc
    console.log("🚀 Starting server...");
    const serverProcess = Bun.spawn(["bun", "run", "dev"], {
      cwd: join(rootDir, "packages", "server"),
      stdio: ["inherit", "inherit", "inherit"],
    });
    processes.push(serverProcess);



    // run openapi-ts generate
    console.log("🚀 Generating openapi-ts client...");
    const openapiTsProcess = Bun.spawn(["bun", "run", "openapi-ts"], {
      cwd: join(rootDir),
      stdio: ["inherit", "inherit", "inherit"],
    });
    processes.push(openapiTsProcess);

    // Start client (Vite runs on 5173 by default)
    console.log("🚀 Starting client...");
    const clientProcess = Bun.spawn(["bun", "run", "dev"], {
      cwd: join(rootDir, "packages", "client"),
      stdio: ["inherit", "inherit", "inherit"],
    });
    processes.push(clientProcess);


    // Handle process termination
    process.on("SIGINT", async () => {
      console.log("\n👋 Shutting down services...");
      processes.forEach(proc => proc.kill());
      process.exit(0);
    });

    // Keep the script running
    await new Promise(() => { });
  } catch (error) {
    console.error("❌ Error starting services:", error);
    processes.forEach(proc => proc.kill());
    process.exit(1);
  }
}

await startServices();
