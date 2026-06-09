import { Command } from 'commander';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { uploadFile, loadConfig, getDb, formatBytes } from '@s3sync/core';
import { log, createProgressBar } from '../output';
import chalk from 'chalk';

export function makeUploadCommand(): Command {
  return new Command('upload')
    .description('Upload files from a source directory to S3')
    .argument('<source>', 'Source directory or file path')
    .option('-b, --bucket <bucket>', 'S3 bucket name')
    .option('-r, --recursive', 'Recurse into subdirectories', false)
    .option('-s, --storage-class <class>', 'S3 storage class', 'INTELLIGENT_TIERING')
    .option('-t, --tag <tag>', 'Tag to apply (repeatable)', collect, [])
    .option('-p, --property <name=value>', 'Property to set (repeatable)', collectKV, {})
    .option('--profile <profile>', 'AWS profile name')
    .option('--region <region>', 'AWS region')
    .option('--dry-run', 'Show what would be uploaded without uploading', false)
    .option('--skip-existing', 'Skip files already in the database by checksum', false)
    .action(async (source: string, opts) => {
      const config = loadConfig();
      const bucket = opts.bucket ?? config.bucket;

      if (!bucket) {
        log.error('No bucket specified. Use --bucket or run: s3sync config --bucket <name>');
        process.exit(1);
      }

      getDb(config.dbPath);

      const s3Config = {
        region: opts.region ?? config.region,
        profile: opts.profile ?? config.profile,
        endpoint: config.endpoint,
      };

      const paths = collectPaths(source, opts.recursive as boolean);
      if (paths.length === 0) {
        log.warn('No files found at the specified path.');
        return;
      }

      log.info(`Found ${paths.length} file(s) to upload to s3://${bucket}`);

      let uploaded = 0;
      let skipped = 0;
      let failed = 0;
      let totalBytes = 0;

      for (const filePath of paths) {
        const size = statSync(filePath).size;
        const label = chalk.dim(filePath);

        if (opts.dryRun) {
          console.log(`  ${chalk.cyan('dry-run')}  ${filePath}  ${formatBytes(size)}`);
          continue;
        }

        const { bar, onProgress } = createProgressBar(
          `  ${chalk.bold(require('path').basename(filePath))}`
        );

        try {
          const result = await uploadFile({
            bucket,
            filePath,
            tags: opts.tag as string[],
            properties: opts.property as Record<string, string>,
            storageClass: opts.storageClass,
            s3Config,
            onProgress,
          });

          if (!bar.isActive) bar.start(size, size);
          bar.stop();

          log.success(
            `${result.fileId.slice(0, 8)}  ${chalk.bold(require('path').basename(filePath))}  ${formatBytes(result.fileSize)}`
          );
          uploaded++;
          totalBytes += result.fileSize;
        } catch (err: unknown) {
          if (bar.isActive) bar.stop();
          log.error(`Failed: ${filePath} — ${(err as Error).message}`);
          failed++;
        }
      }

      if (!opts.dryRun) {
        console.log('');
        log.info(
          `Done. Uploaded: ${chalk.green(uploaded)}, Skipped: ${chalk.yellow(skipped)}, Failed: ${chalk.red(failed)}  (${formatBytes(totalBytes)} total)`
        );
      }
    });
}

function collectPaths(sourcePath: string, recursive: boolean): string[] {
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

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function collectKV(value: string, previous: Record<string, string>): Record<string, string> {
  const [k, ...rest] = value.split('=');
  return { ...previous, [k]: rest.join('=') };
}
