# Promptliano

[![Website Deployment](https://github.com/brandon-schabel/promptliano/actions/workflows/deploy-website.yml/badge.svg)](https://github.com/brandon-schabel/promptliano/actions/workflows/deploy-website.yml)
[![GitHub Pages](https://img.shields.io/badge/Website-promptliano.com-blue)](https://promptliano.com)

## What is Promptliano?

Promptliano is an MCP (Model Context Protocol) server that gives AI assistants deep understanding of your codebase. It provides intelligent context management, reducing token usage by 60-70% while improving code generation accuracy. Works seamlessly with Claude Desktop, Cursor, VSCode, and other MCP-compatible editors.

Learn more at [promptliano.com](https://promptliano.com)

## Quick Start

### Option 1: CLI Setup (Recommended)

The easiest way to get started with Promptliano is using our CLI tool:

```bash
npx promptliano@latest
```

This will:

- Download and install the Promptliano server
- Configure MCP for your AI editor (Claude, Cursor, etc.)
- Start the server automatically
- Guide you through creating your first project

> **Note:** Using `@latest` ensures you always run the most recent version. No installation required!

### Option 2: Manual Download

If you prefer to download and run Promptliano manually:

[Download Promptliano's Latest Prebuilt Bun Server and UI Bundle](https://github.com/brandon-schabel/promptliano/releases/download/v0.9.2/promptliano-0.9.2-bun-bundle.zip)

[Download Promptliano For MacOS arm64 Binary - M1 and Newer](https://github.com/brandon-schabel/promptliano/releases/download/v0.9.2/promptliano-0.9.2-macos-arm64.zip)

[Download Promptliano For Windows x64 Binary](https://github.com/brandon-schabel/promptliano/releases/download/v0.9.2/promptliano-0.9.2-windows-x64.zip)

[Download Promptliano For Linux x64 Binary](https://github.com/brandon-schabel/promptliano/releases/download/v0.9.2/promptliano-0.9.2-linux-x64.zip)

> Once you have downloaded Promptliano for your platform please read "Running Binaries", especially for MacOS

[View More Releases and Downloads](https://github.com/brandon-schabel/promptliano/releases)

Don't have Bun but have NPM? Install Bun using NPM: `npm install -g bun`

Don't have NPM or Bun? Install Bun with curl on Mac/Linux `curl -fsSL https://bun.sh/install | bash` on Windows Powershell: `powershell -c "irm bun.sh/install.ps1 | iex"`

Extract the zip file and cd into the extracted zip file and run the Promptliano server.

```bash
cd promptliano-0.9.2-bun-bundle && bun run start
```

### Access Promptliano

[View Your Local Promptliano UI](http://localhost:3579/)

## MCP Setup

Promptliano works with all MCP-compatible editors. The easiest way to set up MCP is through the Promptliano UI:

1. Create a project in Promptliano
2. Click the **MCP** button in the top-left corner
3. Follow the automated setup wizard for your editor

For manual setup instructions, see [docs/manual-mcp-setup.md](./docs/manual-mcp-setup.md).

![promptliano-0-5-0-project-overview](https://github.com/user-attachments/assets/f92680e4-2877-488a-b336-79533c3999d4)

## Development Setup

```bash
# Clone the repository
git clone https://github.com/brandon-schabel/promptliano
cd promptliano

# Install dependencies (requires Bun)
bun install

# Start development server
bun run dev
```

The development UI will be available at [http://localhost:1420](http://localhost:1420)

## Running Binaries

### Running on Linux

On Linux you should be able to just navigate to the promptliano binary file in the terminal and run it for example:

```bash
cd ~/Downloads/promptliano-v0.9.2
```

Run the linux binary file:

```bash
./promptliano
```

### Running on MacOS

Currently I don't have MacOS code signing, so it just says the binary is damaged, but really it is quarntined. In order to run the binary on Mac you would have to do the following

```bash
cd ~/Downloads/promptliano-v0.9.2
```

Then run to remove the quarantine:

```bash
sudo xattr -r -d com.apple.quarantine ./promptliano
```

Finally you can run the Promptliano app by running the binary file as you normally would

```bash
./promptliano
```

### Running on Windows

After downloading and extracting the appropriate zip file (e.g., `promptliano-v0.9.2-windows-x64.zip`), open Command Prompt or PowerShell.

Navigate to the extracted folder. For example, if you extracted it to your Downloads folder:

```batch
cd %USERPROFILE%\Downloads\promptliano-v0.9.2-windows-x64
```

Or using PowerShell:

```powershell
cd $env:USERPROFILE\Downloads\promptliano-v0.9.2-windows-x64
```

Then, run the executable:

```batch
.\promptliano.exe
```

## Documentation

- [Getting Started Guide](https://promptliano.com/docs/getting-started)
- [MCP Integration](https://promptliano.com/integrations)
- [API Reference](https://promptliano.com/docs/api)
- [View all docs](https://promptliano.com/docs)

### API Documentation

- Server Base: [http://localhost:3147](http://localhost:3147)
- Swagger UI: [http://localhost:3147/swagger](http://localhost:3147/swagger)
- OpenAPI Spec: [http://localhost:3147/doc](http://localhost:3147/doc)

## Tech Stack

**Backend:** Bun, Hono, Zod, AI SDK  
**Frontend:** React, Vite, TanStack Router/Query, shadcn/ui, Tailwind CSS  
**Documentation:** OpenAPI/Swagger

## Building from Source

To create platform-specific binaries:

```bash
bun run build-binaries
```

This creates standalone executables for Linux, macOS, and Windows in the `/dist` directory.

## Contributing

We welcome all contributions—whether you're fixing a bug, adding a feature, or improving docs.  
General guidelines:

1. **Fork & Clone**
2. **Create** a new feature branch
3. **Implement** & Test
4. **Open** a Pull Request

Let's make Promptliano even better together!

---

## License

Promptliano is **open-source** under the [MIT License](./LICENSE). See [LICENSE](./LICENSE) for more details.

---

## Support

Join our **[Discord community](https://discord.gg/Z2nDnVQKKm)** for support, feature requests, and discussions.
