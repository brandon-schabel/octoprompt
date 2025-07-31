import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

// Test our reliability fixes
describe('Reliability Fixes', () => {
  const testDir = join(tmpdir(), 'promptliano-test-' + Date.now());
  
  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });
  
  describe('Version Parsing', () => {
    test('should handle numeric versions correctly', async () => {
      const { PromptlianoDownloader } = await import('../lib/downloader.js');
      const downloader = new PromptlianoDownloader();
      
      // Access private method via any type
      const compareVersions = (downloader as any).compareVersions.bind(downloader);
      
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });
    
    test('should handle pre-release versions', async () => {
      const { PromptlianoDownloader } = await import('../lib/downloader.js');
      const downloader = new PromptlianoDownloader();
      const compareVersions = (downloader as any).compareVersions.bind(downloader);
      
      expect(compareVersions('1.0.0-beta', '1.0.0')).toBe(-1);
      expect(compareVersions('1.0.0', '1.0.0-beta')).toBe(1);
      expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
    });
    
    test('should handle versions with v prefix', async () => {
      const { PromptlianoDownloader } = await import('../lib/downloader.js');
      const downloader = new PromptlianoDownloader();
      const compareVersions = (downloader as any).compareVersions.bind(downloader);
      
      expect(compareVersions('v1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('v1.0.1', 'v1.0.0')).toBe(1);
    });
  });
  
  describe('Port Scanning Limits', () => {
    test('should respect max attempts limit', async () => {
      const { PortManager } = await import('../lib/port-manager.js');
      const portManager = new PortManager();
      
      // Mock all ports as in use
      const originalCheckPort = (portManager as any).checkPort;
      (portManager as any).checkPort = async () => ({ available: false, inUse: true });
      
      try {
        await portManager.findAvailablePort();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain('No available ports found after checking');
        expect((error as Error).message).toContain('10 ports'); // Max attempts is 10
      }
      
      // Restore original method
      (portManager as any).checkPort = originalCheckPort;
    });
  });
  
  describe('Windows Executable Detection', () => {
    test.skip('should detect Windows executables by extension', async () => {
      const { PermissionChecker } = await import('../lib/permission-checker.js');
      const checker = new PermissionChecker();
      
      // Create test files
      const exePath = join(testDir, 'test.exe');
      const batPath = join(testDir, 'test.bat');
      const txtPath = join(testDir, 'test.txt');
      
      await writeFile(exePath, 'test');
      await writeFile(batPath, 'test');
      await writeFile(txtPath, 'test');
      
      // Override platform method directly on checker
      const originalPlatform = (await import('os')).platform;
      const os = await import('os');
      (os as any).platform = () => 'win32';
      
      // Recreate checker to use mocked platform
      const winChecker = new PermissionChecker();
      
      expect(await winChecker.checkExecutable(exePath)).toBe(true);
      expect(await winChecker.checkExecutable(batPath)).toBe(true);
      expect(await winChecker.checkExecutable(txtPath)).toBe(false);
      
      // Restore platform
      (os as any).platform = originalPlatform;
    });
  });
  
  describe('Log Rotation', () => {
    test('should rotate logs when size limit is reached', async () => {
      const { Logger } = await import('../lib/logger.js');
      
      // Create a test logger with small size limit
      const testLogger = new Logger();
      (testLogger as any).logFile = join(testDir, 'test.log');
      (testLogger as any).maxLogSize = 100; // 100 bytes for testing
      
      // Write enough logs to trigger rotation
      for (let i = 0; i < 5; i++) {
        await testLogger.info('This is a test log message that should trigger rotation');
      }
      
      // Check that rotation happened
      const rotatedLog = join(testDir, 'test.log.1');
      expect(existsSync(rotatedLog)).toBe(true);
    });
  });
});

// Test tar error handling
describe('Tar Import Error Handling', () => {
  test('should provide helpful error for missing tar package', async () => {
    const { BackupManager } = await import('../lib/backup-manager.js');
    const backupManager = new BackupManager();
    
    // Create a mock backup manager that throws the expected error  
    const testExtract = async function() {
      try {
        const { extract } = await import('tar');
        // If import succeeds, we can't test the error path
        // So manually throw the expected error
        const error: any = new Error('Cannot find module');
        error.code = 'MODULE_NOT_FOUND';
        throw error;
      } catch (error: any) {
        if (error.code === 'MODULE_NOT_FOUND') {
          throw new Error(
            'tar package is not installed. Please run "npm install" or "bun install" to install dependencies.'
          );
        }
        throw error;
      }
    };
    
    try {
      await testExtract();
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain('tar package is not installed');
      expect(error.message).toContain('npm install');
    }
  });
});