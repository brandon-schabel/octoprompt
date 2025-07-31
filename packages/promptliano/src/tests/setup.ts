// Test setup file
import { TestEnvironment } from './test-utils';

// Global test environment
export const testEnv = new TestEnvironment();

// Bun doesn't have afterAll, would need to handle cleanup differently
// Could use process.on('exit') or manage in individual tests

// Mock logger for tests
declare global {
  var mockLogger: {
    info: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    debug: (...args: any[]) => void;
  };
}

global.mockLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {}
};