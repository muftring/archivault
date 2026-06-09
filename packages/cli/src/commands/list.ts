import { Command } from 'commander';
import { listFiles, getFileById, loadConfig, getDb, formatBytes } from '@archivault/core';
import { log, formatFileRow } from '../output';
import chalk from 'chalk';

export function makeListCommand(): Command {
  return new Command('list')
    .alias('ls')
    .description('List and search files in the database')
    .option('--path <prefix>', 'Filter by source path prefix')
    .option('--name <pattern>', 'Filter by file name (substring)')
    .option('--from <date>', 'Filter by upload date from (ISO 8601, e.g. 2024-01-01)')
    .option('--to <date>', 'Filter by upload date to (ISO 8601)')
    .option('-t, --tag <tag>', 'Filter by tag (repeatable)', collect, [])
    .option('--prop <name>', 'Filter by property name')
    .option('--prop-value <value>', 'Filter by property value (requires --prop)')
    .option('--status <status>', 'Filter by status (active/deleted/archived)', 'active')
    .option('-l, --limit <n>', 'Max results to return', '50')
    .option('--offset <n>', 'Offset for pagination', '0')
    .option('--sort <field>', 'Sort by: uploaded_at, file_name, file_size', 'uploaded_at')
    .option('--asc', 'Sort ascending (default is descending)')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const config = loadConfig();
      getDb(config.dbPath);

      const results = await listFiles({
        pathPrefix: opts.path,
        fileName: opts.name,
        fromDate: opts.from,
        toDate: opts.to,
        tags: opts.tag.length > 0 ? opts.tag : undefined,
        propertyName: opts.prop,
        propertyValue: opts.propValue,
        status: opts.status,
        limit: parseInt(opts.limit, 10),
        offset: parseInt(opts.offset, 10),
        orderBy: opts.sort,
        orderDir: opts.asc ? 'asc' : 'desc',
      });

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        log.info('No files found matching the criteria.');
        return;
      }

      console.log(
        chalk.dim(`${'ID'.padEnd(10)}${'Name'.padEnd(36)}${'Size'.padEnd(12)}${'Uploaded'.padEnd(14)}S3 Key`)
      );
      console.log(chalk.dim('─'.repeat(90)));

      for (const file of results) {
        console.log(formatFileRow(file));
        if (file.properties && Object.keys(file.properties).length > 0) {
          for (const [k, v] of Object.entries(file.properties)) {
            console.log(chalk.dim(`           ${k}: ${v}`));
          }
        }
      }

      console.log('');
      log.dim(`Showing ${results.length} result(s). Use --limit and --offset to paginate.`);
    });
}

export function makeShowCommand(): Command {
  return new Command('show')
    .description('Show full details for a file by ID')
    .argument('<file-id>', 'File ID (UUID or first 8 chars)')
    .option('--json', 'Output as JSON')
    .action(async (fileId: string, opts) => {
      const config = loadConfig();
      getDb(config.dbPath);

      const file = await getFileById(fileId);
      if (!file) {
        log.error(`File not found: ${fileId}`);
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(file, null, 2));
        return;
      }

      console.log('');
      console.log(chalk.bold('File Details'));
      console.log(chalk.dim('─'.repeat(60)));
      field('ID', file.id);
      field('Name', file.fileName);
      field('Source Path', file.sourcePath);
      field('MIME Type', file.mimeType ?? 'unknown');
      field('Size', formatBytes(file.fileSize));
      field('Extension', file.fileExtension ?? 'none');
      field('Status', file.status ?? 'active');
      field('Uploaded', new Date(file.uploadedAt).toLocaleString());
      if (file.lastVerifiedAt) {
        field('Last Verified', new Date(file.lastVerifiedAt).toLocaleString());
      }
      console.log(chalk.dim('─'.repeat(60)));
      field('S3 Bucket', file.s3Bucket);
      field('S3 Key', file.s3Key);
      field('Storage Class', file.s3StorageClass ?? 'STANDARD');
      console.log(chalk.dim('─'.repeat(60)));
      field('SHA256 (before)', file.checksumBefore);
      if (file.checksumAfter) {
        field('SHA256 (after)', file.checksumAfter);
        const match = file.checksumAfter === file.checksumBefore;
        field('Integrity', match ? chalk.green('OK') : chalk.red('MISMATCH'));
      }
      if (file.tags.length > 0) {
        console.log(chalk.dim('─'.repeat(60)));
        field('Tags', file.tags.join(', '));
      }
      if (Object.keys(file.properties).length > 0) {
        console.log(chalk.dim('─'.repeat(60)));
        console.log(chalk.dim('Properties:'));
        for (const [k, v] of Object.entries(file.properties)) {
          field(`  ${k}`, v);
        }
      }
      console.log('');
    });
}

function field(label: string, value: string): void {
  console.log(`${chalk.dim(label.padEnd(20))} ${value}`);
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
