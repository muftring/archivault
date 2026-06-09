import { Command } from 'commander';
import { loadConfig, saveConfig, configPath } from '@s3sync/core';
import { log } from '../output';
import chalk from 'chalk';

export function makeConfigCommand(): Command {
  return new Command('config')
    .description('View or update s3sync configuration')
    .option('--bucket <bucket>', 'Default S3 bucket name')
    .option('--region <region>', 'AWS region')
    .option('--profile <profile>', 'AWS profile (from ~/.aws/config)')
    .option('--storage-class <class>', 'Default S3 storage class')
    .option('--db-path <path>', 'Path to the SQLite database file')
    .option('--endpoint <url>', 'Custom S3 endpoint (e.g. for LocalStack)')
    .option('--show', 'Show current configuration', false)
    .action((opts) => {
      const config = loadConfig();

      const hasUpdates = opts.bucket || opts.region || opts.profile || opts.storageClass || opts.dbPath || opts.endpoint;

      if (hasUpdates) {
        saveConfig({
          ...(opts.bucket ? { bucket: opts.bucket } : {}),
          ...(opts.region ? { region: opts.region } : {}),
          ...(opts.profile ? { profile: opts.profile } : {}),
          ...(opts.storageClass ? { storageClass: opts.storageClass } : {}),
          ...(opts.dbPath ? { dbPath: opts.dbPath } : {}),
          ...(opts.endpoint ? { endpoint: opts.endpoint } : {}),
        });
        log.success(`Configuration saved to ${configPath()}`);
      }

      if (!hasUpdates || opts.show) {
        const current = loadConfig();
        console.log('');
        console.log(chalk.bold('Current Configuration'));
        console.log(chalk.dim('─'.repeat(50)));
        for (const [k, v] of Object.entries(current)) {
          console.log(`${chalk.dim(k.padEnd(20))} ${v ?? chalk.italic('(not set)')}`);
        }
        console.log(chalk.dim(`\nConfig file: ${configPath()}`));
        console.log('');
      }
    });
}

export function makeTagCommand(): Command {
  const cmd = new Command('tag').description('Manage tags on a file');

  cmd
    .command('add <file-id> <tag>')
    .description('Add a tag to a file')
    .action(async (fileId: string, tag: string) => {
      const { addTag, getDb, loadConfig } = await import('@s3sync/core');
      const config = loadConfig();
      getDb(config.dbPath);
      await addTag(fileId, tag);
      log.success(`Tag "${tag}" added to ${fileId.slice(0, 8)}`);
    });

  cmd
    .command('remove <file-id> <tag>')
    .description('Remove a tag from a file')
    .action(async (fileId: string, tag: string) => {
      const { removeTag, getDb, loadConfig } = await import('@s3sync/core');
      const config = loadConfig();
      getDb(config.dbPath);
      await removeTag(fileId, tag);
      log.success(`Tag "${tag}" removed from ${fileId.slice(0, 8)}`);
    });

  return cmd;
}

export function makePropertyCommand(): Command {
  const cmd = new Command('prop').description('Manage properties on a file');

  cmd
    .command('set <file-id> <name> <value>')
    .description('Set a property on a file')
    .action(async (fileId: string, name: string, value: string) => {
      const { setProperty, getDb, loadConfig } = await import('@s3sync/core');
      const config = loadConfig();
      getDb(config.dbPath);
      await setProperty(fileId, name, value);
      log.success(`Property "${name}=${value}" set on ${fileId.slice(0, 8)}`);
    });

  cmd
    .command('remove <file-id> <name>')
    .description('Remove a property from a file')
    .action(async (fileId: string, name: string) => {
      const { removeProperty, getDb, loadConfig } = await import('@s3sync/core');
      const config = loadConfig();
      getDb(config.dbPath);
      await removeProperty(fileId, name);
      log.success(`Property "${name}" removed from ${fileId.slice(0, 8)}`);
    });

  return cmd;
}
