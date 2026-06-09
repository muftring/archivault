import { createReadStream } from 'fs';
import { createHash } from 'crypto';
import { Transform, Readable } from 'stream';

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}

export function createHashingTransform(): {
  hash: ReturnType<typeof createHash>;
  transform: Transform;
} {
  const hash = createHash('sha256');
  const transform = new Transform({
    transform(chunk: Buffer, _enc: string, cb: () => void) {
      hash.update(chunk);
      this.push(chunk);
      cb();
    },
  });
  return { hash, transform };
}

export async function sha256Stream(readable: Readable): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of readable) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}
