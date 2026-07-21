import { Command } from 'commander';
import { listFiles, verifyFile, loadConfig, getDb } from '@archivault/core';
import { log } from '../output';
import chalk from 'chalk';

export function makeVerifyCommand(): Command {
  return new Command('verify')
    .description('Verify integrity of uploaded files by re-downloading and checking SHA256')
    .option('--id <id>', 'Verify a single file by ID')
    .option('--all', 'Verify all active files (may take a long time)', false)
    .option('--unverified', 'Verify only files that have never been verified', false)
    .option('--limit <n>', 'Max files to verify', '100')
    .option('--profile <profile>', 'AWS profile name')
    .option('--region <region>', 'AWS region')
    .action(async (opts) => {
      const config = loadConfig();
      getDb(config.dbPath);

      const s3Config = {
        region: opts.region ?? config.region,
        profile: opts.profile ?? config.profile,
        endpoint: config.endpoint,
      };

      let filesToVerify = await listFiles({
        status: 'active',
        limit: parseInt(opts.limit, 10),
        orderBy: 'uploaded_at',
        orderDir: 'asc',
      });

      if (opts.unverified) {
        filesToVerify = filesToVerify.filter((f) => !f.lastVerifiedAt);
      }

      if (filesToVerify.length === 0) {
        log.info('No files to verify.');
        return;
      }

      log.info(`Verifying ${filesToVerify.length} file(s)...`);

      let ok = 0;
      let mismatch = 0;
      let failed = 0;

      for (const file of filesToVerify) {
        process.stdout.write(`  ${chalk.dim(file.id.slice(0, 8))}  ${file.fileName.padEnd(40)} `);

        try {
          const { checksum, checksumMatch } = await verifyFile(file, s3Config);

          if (checksumMatch) {
            console.log(chalk.green('OK'));
            ok++;
          } else {
            console.log(chalk.red('MISMATCH'));
            console.log(chalk.dim(`    expected: ${file.checksumBefore}`));
            console.log(chalk.dim(`    actual:   ${checksum}`));
            mismatch++;
          }
        } catch (err: unknown) {
          console.log(chalk.red(`ERROR: ${(err as Error).message}`));
          failed++;
        }
      }

      console.log('');
      log.info(
        `Results — OK: ${chalk.green(ok)}, Mismatch: ${chalk.red(mismatch)}, Errors: ${chalk.red(failed)}`
      );

      if (mismatch > 0 || failed > 0) process.exit(1);
    });
}
