import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface AppConfig {
  bucket: string;
  region: string;
  profile?: string;
  storageClass: string;
  dbPath?: string;
  endpoint?: string;
}

const CONFIG_DIR = join(homedir(), '.s3sync');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULTS: AppConfig = {
  bucket: '',
  region: 'us-east-1',
  storageClass: 'INTELLIGENT_TIERING',
};

export function loadConfig(): AppConfig {
  if (!existsSync(CONFIG_FILE)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(config: Partial<AppConfig>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const current = loadConfig();
  writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...config }, null, 2));
}

export function configPath(): string {
  return CONFIG_FILE;
}
