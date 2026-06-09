import { S3Client } from '@aws-sdk/client-s3';

let _client: S3Client | null = null;

export interface S3Config {
  region: string;
  profile?: string;
  endpoint?: string; // for local dev with LocalStack etc.
}

export function getS3Client(config?: S3Config): S3Client {
  if (_client) return _client;

  const region = config?.region ?? process.env.AWS_REGION ?? 'us-east-1';

  if (config?.profile) {
    process.env.AWS_PROFILE = config.profile;
  }

  _client = new S3Client({
    region,
    ...(config?.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
  });

  return _client;
}

export function resetS3Client(): void {
  _client = null;
}
