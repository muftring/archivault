import { Command } from 'commander';
import { loadConfig, saveConfig, configPath } from '@archivault/core';
import { log } from '../output';
import chalk from 'chalk';

export function makeConfigCommand(): Command {
  return new Command('config')
    .description('View or update archivault configuration')
    .option('--bucket <bucket>', 'Default S3 bucket name')
    .option('--region <region>', 'AWS region')
    .option('--profile <profile>', 'AWS profile (from ~/.aws/config)')
    .option('--storage-class <class>', 'Default S3 storage class')
    .option('--endpoint <url>', 'Custom S3 endpoint (e.g. for LocalStack)')
    .option('--db-type <type>', 'Database backend: sqlite or postgres')
    .option('--sqlite-path <path>', 'Path to the SQLite database file')
    .option('--pg-host <host>', 'Postgres host')
    .option('--pg-port <port>', 'Postgres port', parseInt)
    .option('--pg-database <name>', 'Postgres database name')
    .option('--pg-schema <schema>', 'Postgres schema name')
    .option('--pg-username <user>', 'Postgres username')
    .option('--pg-password <password>', 'Postgres password')
    .option('--pg-ssl', 'Enable SSL for Postgres connection')
    .option('--no-pg-ssl', 'Disable SSL for Postgres connection')
    .option('--show', 'Show current configuration', false)
    .action((opts) => {
      const hasS3Updates = opts.bucket || opts.region || opts.profile || opts.storageClass || opts.endpoint;
      const hasDbTypeUpdate = opts.dbType;
      const hasSqliteUpdate = opts.sqlitePath;
      const hasPgUpdate =
        opts.pgHost || opts.pgPort || opts.pgDatabase || opts.pgSchema ||
        opts.pgUsername || opts.pgPassword || opts.pgSsl !== undefined;

      if (hasS3Updates || hasDbTypeUpdate || hasSqliteUpdate || hasPgUpdate) {
        saveConfig({
          ...(opts.bucket ? { bucket: opts.bucket } : {}),
          ...(opts.region ? { region: opts.region } : {}),
          ...(opts.profile ? { profile: opts.profile } : {}),
          ...(opts.storageClass ? { storageClass: opts.storageClass } : {}),
          ...(opts.endpoint ? { endpoint: opts.endpoint } : {}),
          ...((hasDbTypeUpdate || hasSqliteUpdate || hasPgUpdate) ? {
            database: {
              ...(opts.dbType ? { type: opts.dbType } : {}),
              ...(hasSqliteUpdate ? { sqlite: { path: opts.sqlitePath } } : {}),
              ...(hasPgUpdate ? {
                postgres: {
                  ...(opts.pgHost ? { host: opts.pgHost } : {}),
                  ...(opts.pgPort ? { port: opts.pgPort } : {}),
                  ...(opts.pgDatabase ? { database: opts.pgDatabase } : {}),
                  ...(opts.pgSchema ? { schema: opts.pgSchema } : {}),
                  ...(opts.pgUsername ? { username: opts.pgUsername } : {}),
                  ...(opts.pgPassword ? { password: opts.pgPassword } : {}),
                  ...(opts.pgSsl !== undefined ? { ssl: opts.pgSsl } : {}),
                },
              } : {}),
            },
          } : {}),
        });
        log.success(`Configuration saved to ${configPath()}`);
      }

      if (!hasS3Updates && !hasDbTypeUpdate && !hasSqliteUpdate && !hasPgUpdate || opts.show) {
        const current = loadConfig();
        console.log('');
        console.log(chalk.bold('Current Configuration'));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(`${chalk.dim('bucket'.padEnd(20))} ${current.bucket || chalk.italic('(not set)')}`);
        console.log(`${chalk.dim('region'.padEnd(20))} ${current.region}`);
        console.log(`${chalk.dim('storageClass'.padEnd(20))} ${current.storageClass}`);
        if (current.profile) console.log(`${chalk.dim('profile'.padEnd(20))} ${current.profile}`);
        if (current.endpoint) console.log(`${chalk.dim('endpoint'.padEnd(20))} ${current.endpoint}`);

        const dbType = current.database?.type ?? 'sqlite';
        console.log('');
        console.log(chalk.bold('Database'));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(`${chalk.dim('type'.padEnd(20))} ${dbType}`);

        if (dbType === 'sqlite') {
          const sqlitePath =
            current.database?.sqlite?.path ??
            current.dbPath ??
            '~/.archivault/files.db (default)';
          console.log(`${chalk.dim('path'.padEnd(20))} ${sqlitePath}`);
        } else {
          const pg = current.database?.postgres ?? {};
          console.log(`${chalk.dim('host'.padEnd(20))} ${pg.host ?? chalk.italic('localhost (default)')}`);
          console.log(`${chalk.dim('port'.padEnd(20))} ${pg.port ?? chalk.italic('5432 (default)')}`);
          console.log(`${chalk.dim('database'.padEnd(20))} ${pg.database ?? chalk.italic('archivault (default)')}`);
          if (pg.schema) console.log(`${chalk.dim('schema'.padEnd(20))} ${pg.schema}`);
          console.log(`${chalk.dim('username'.padEnd(20))} ${pg.username ?? chalk.italic('(not set)')}`);
          console.log(`${chalk.dim('password'.padEnd(20))} ${pg.password ? chalk.dim('(set)') : chalk.italic('(not set)')}`);
          console.log(`${chalk.dim('ssl'.padEnd(20))} ${pg.ssl ? 'enabled' : 'disabled'}`);
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
      const { addTag, getDb, loadConfig } = await import('@archivault/core');
      const config = loadConfig();
      getDb(config.dbPath);
      await addTag(fileId, tag);
      log.success(`Tag "${tag}" added to ${fileId.slice(0, 8)}`);
    });

  cmd
    .command('remove <file-id> <tag>')
    .description('Remove a tag from a file')
    .action(async (fileId: string, tag: string) => {
      const { removeTag, getDb, loadConfig } = await import('@archivault/core');
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
      const { setProperty, getDb, loadConfig } = await import('@archivault/core');
      const config = loadConfig();
      getDb(config.dbPath);
      await setProperty(fileId, name, value);
      log.success(`Property "${name}=${value}" set on ${fileId.slice(0, 8)}`);
    });

  cmd
    .command('remove <file-id> <name>')
    .description('Remove a property from a file')
    .action(async (fileId: string, name: string) => {
      const { removeProperty, getDb, loadConfig } = await import('@archivault/core');
      const config = loadConfig();
      getDb(config.dbPath);
      await removeProperty(fileId, name);
      log.success(`Property "${name}" removed from ${fileId.slice(0, 8)}`);
    });

  return cmd;
}
