// Test setup file
import { TestEnvironment } from './test-utils';

// Global test environment
export const testEnv = new TestEnvironment();

// Clean up after all tests
afterAll(async () => {
  await testEnv.cleanup();
});

// Set test timeout
// Bun test doesn't use jest

// Mock logger for tests
global.mockLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {}
};