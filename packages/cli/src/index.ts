#!/usr/bin/env node
import { Command } from 'commander';
import { makeUploadCommand } from './commands/upload';
import { makeDownloadCommand } from './commands/download';
import { makeListCommand, makeShowCommand } from './commands/list';
import { makeVerifyCommand } from './commands/verify';
import { makeConfigCommand, makeTagCommand, makePropertyCommand } from './commands/config';

const program = new Command();

program
  .name('s3sync')
  .description('Upload and download files to/from AWS S3 with full metadata tracking')
  .version('1.0.0');

program.addCommand(makeUploadCommand());
program.addCommand(makeDownloadCommand());
program.addCommand(makeListCommand());
program.addCommand(makeShowCommand());
program.addCommand(makeVerifyCommand());
program.addCommand(makeConfigCommand());
program.addCommand(makeTagCommand());
program.addCommand(makePropertyCommand());

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
