import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

export function ensureParentDir(filePath: string): void {
  const dir = dirname(filePath);
  ensureDir(dir);
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}