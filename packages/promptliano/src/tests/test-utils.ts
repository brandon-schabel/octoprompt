import { mkdtemp, rm, mkdir, writeFile, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';

export class TestEnvironment {
  private tempDirs: string[] = [];

  async createTempDir(prefix = 'promptliano-test-'): Promise<string> {
    const tempDir = await mkdtemp(join(tmpdir(), prefix));
    this.tempDirs.push(tempDir);
    return tempDir;
  }

  async cleanup(): Promise<void> {
    for (const dir of this.tempDirs) {
      if (existsSync(dir)) {
        await rm(dir, { recursive: true, force: true });
      }
    }
    this.tempDirs = [];
  }

  async createMockInstallation(basePath: string): Promise<void> {
    // Create mock Promptliano installation structure
    const paths = [
      'packages/server',
      'packages/client',
      'packages/schemas',
      'packages/storage',
      'logs'
    ];

    for (const path of paths) {
      await mkdir(join(basePath, path), { recursive: true });
    }

    // Create mock package.json
    await writeFile(
      join(basePath, 'package.json'),
      JSON.stringify({
        name: 'promptliano-core',
        version: '0.8.2',
        type: 'module'
      }, null, 2)
    );

    // Create mock server files
    await writeFile(
      join(basePath, 'packages/server/server.ts'),
      'console.log("Mock server");'
    );
  }

  async createMockMCPConfig(editor: string, configPath: string): Promise<void> {
    const config = {
      mcpServers: {
        'promptliano-test': {
          command: 'node',
          args: ['server.js'],
          cwd: '/test/path'
        }
      }
    };

    await mkdir(join(configPath, '..'), { recursive: true });
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }
}

export class MockProcess {
  static mockSpawn = jest.fn();
  static mockExec = jest.fn();

  static setup() {
    jest.doMock('child_process', () => ({
      spawn: this.mockSpawn,
      exec: (cmd: string, callback: Function) => {
        this.mockExec(cmd, callback);
      }
    }));
  }

  static reset() {
    this.mockSpawn.mockReset();
    this.mockExec.mockReset();
    jest.dontMock('child_process');
  }
}

export class MockFetch {
  private static responses: Map<string, any> = new Map();

  static mockResponse(url: string, response: any) {
    this.responses.set(url, response);
  }

  static setup() {
    global.fetch = jest.fn(async (url: string) => {
      const response = this.responses.get(url);
      if (response) {
        return {
          ok: true,
          json: async () => response,
          text: async () => JSON.stringify(response)
        };
      }
      throw new Error(`No mock response for ${url}`);
    });
  }

  static reset() {
    this.responses.clear();
    // @ts-ignore
    delete global.fetch;
  }
}

export function mockConsole() {
  const originalLog = console.log;
  const originalError = console.error;
  const logs: string[] = [];
  const errors: string[] = [];

  console.log = (...args: any[]) => {
    logs.push(args.join(' '));
  };

  console.error = (...args: any[]) => {
    errors.push(args.join(' '));
  };

  return {
    logs,
    errors,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    }
  };
}

export async function expectFileExists(path: string): Promise<void> {
  expect(existsSync(path)).toBe(true);
}

export async function expectFileContains(path: string, content: string): Promise<void> {
  const fileContent = await readFile(path, 'utf-8');
  expect(fileContent).toContain(content);
}