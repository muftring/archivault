import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { formatBytes } from '@s3sync/core';

export const log = {
  info: (msg: string) => console.log(chalk.cyan('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✔'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.error(chalk.red('✖'), msg),
  dim: (msg: string) => console.log(chalk.dim(msg)),
};

export function createProgressBar(label: string): {
  bar: cliProgress.SingleBar;
  onProgress: (loaded: number, total: number) => void;
} {
  const bar = new cliProgress.SingleBar(
    {
      format: `${label} [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s`,
      formatValue: (v, _opts, type) =>
        type === 'value' || type === 'total' ? formatBytes(v) : String(v),
    },
    cliProgress.Presets.shades_classic
  );

  const onProgress = (loaded: number, total: number) => {
    if (!bar.isActive) bar.start(total, 0);
    bar.update(loaded);
    if (loaded >= total) bar.stop();
  };

  return { bar, onProgress };
}

export function formatFileRow(file: {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  s3Key: string;
  status: string | null;
  tags: string[];
}): string {
  const date = new Date(file.uploadedAt).toLocaleDateString();
  const size = formatBytes(file.fileSize);
  const tags = file.tags.length > 0 ? chalk.dim(` [${file.tags.join(', ')}]`) : '';
  const status = file.status !== 'active' ? chalk.yellow(` (${file.status})`) : '';
  return [
    chalk.gray(file.id.slice(0, 8)),
    chalk.bold(file.fileName),
    chalk.dim(size),
    chalk.dim(date),
    chalk.dim(file.s3Key.slice(0, 17) + '…'),
    tags,
    status,
  ].join('  ');
}
