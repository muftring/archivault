import { readdirSync, statSync } from 'fs';
import { join } from 'path';

export function collectUploadPaths(sourcePath: string, recursive: boolean): string[] {
  const stats = statSync(sourcePath);
  if (stats.isFile()) return [sourcePath];

  const results: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isFile()) {
        results.push(full);
      } else if (entry.isDirectory() && recursive) {
        walk(full);
      }
    }
  }

  walk(sourcePath);
  return results;
}
