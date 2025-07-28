import { readFileSync, writeFileSync } from 'node:fs';
import type { CLIConfig } from '../types/index.js';
import { CONFIG_PATH } from '../utils/constants.js';
import { ensureParentDir, fileExists } from '../utils/paths.js';

export class ConfigService {
  private config: CLIConfig = {};
  
  constructor() {
    this.load();
  }
  
  load(): void {
    if (fileExists(CONFIG_PATH)) {
      try {
        const data = readFileSync(CONFIG_PATH, 'utf-8');
        this.config = JSON.parse(data);
      } catch (error) {
        // Invalid config, start fresh
        this.config = {};
      }
    }
  }
  
  save(): void {
    ensureParentDir(CONFIG_PATH);
    writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
  }
  
  get<K extends keyof CLIConfig>(key: K): CLIConfig[K] {
    return this.config[key];
  }
  
  set<K extends keyof CLIConfig>(key: K, value: CLIConfig[K]): void {
    this.config[key] = value;
    this.save();
  }
  
  getAll(): CLIConfig {
    return { ...this.config };
  }
  
  clear(): void {
    this.config = {};
    this.save();
  }
}