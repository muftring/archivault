import { Command } from 'commander';
import { loadConfig, getDb, applyPgSchema } from '@archivault/core';
import { log } from '../output';
import chalk from 'chalk';

export function makeDbCommand(): Command {
  const cmd = new Command('db').description('Database management commands');

  cmd
    .command('setup')
    .description('Create database tables for the configured backend (required for Postgres)')
    .action(async () => {
      const config = loadConfig();
      const dbType = config.database?.type ?? 'sqlite';

      if (dbType === 'postgres') {
        const pg = config.database?.postgres ?? {};
        log.info(
          `Connecting to Postgres at ${chalk.bold(`${pg.host ?? 'localhost'}:${pg.port ?? 5432}/${pg.database ?? 'archivault'}`)}`
        );
        if (pg.schema) log.info(`Using schema: ${chalk.bold(pg.schema)}`);
        try {
          getDb();
          await applyPgSchema();
          log.success('Postgres schema applied successfully.');
        } catch (err: unknown) {
          log.error(`Failed to apply schema: ${(err as Error).message}`);
          process.exit(1);
        }
      } else {
        getDb(config.dbPath);
        log.success('SQLite database initialized.');
        log.dim(`  Path: ${config.database?.sqlite?.path ?? config.dbPath ?? '~/.archivault/files.db'}`);
      }
    });

  return cmd;
}
