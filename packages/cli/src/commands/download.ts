import { Command } from 'commander';
import { downloadFile, loadConfig, getDb } from '@s3sync/core';
import { log, createProgressBar } from '../output';
import chalk from 'chalk';

export function makeDownloadCommand(): Command {
  return new Command('download')
    .description('Download a file from S3 by its database ID')
    .argument('<file-id>', 'File ID from the database (UUID or first 8 chars)')
    .argument('<dest-dir>', 'Destination directory')
    .option('--no-verify', 'Skip SHA256 verification after download')
    .option('--profile <profile>', 'AWS profile name')
    .option('--region <region>', 'AWS region')
    .action(async (fileId: string, destDir: string, opts) => {
      const config = loadConfig();
      getDb(config.dbPath);

      const s3Config = {
        region: opts.region ?? config.region,
        profile: opts.profile ?? config.profile,
        endpoint: config.endpoint,
      };

      const { bar, onProgress } = createProgressBar('  Downloading');

      try {
        const result = await downloadFile({
          fileId,
          destDir,
          s3Config,
          verifyChecksum: opts.verify !== false,
          onProgress,
        });

        if (bar.isActive) bar.stop();

        log.success(`Saved to: ${chalk.bold(result.destPath)}`);
        log.dim(`  SHA256: ${result.checksum}`);

        if (result.checksumMatch === true) {
          log.success('Checksum verified — file integrity confirmed.');
        } else if (result.checksumMatch === false) {
          log.error('Checksum MISMATCH — file may be corrupted!');
          process.exit(1);
        }
      } catch (err: unknown) {
        if (bar.isActive) bar.stop();
        log.error((err as Error).message);
        process.exit(1);
      }
    });
}
