import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3 } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
// @ts-ignore - jsonparse doesn't have proper types
import Parser from 'jsonparse';
import { Readable } from 'stream';

// Initialize S3 client
export const s3 = new S3({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION,
  maxAttempts: 5,
});

/**
 * Get the DATA_BUCKET name from environment variables
 */
export const getJobsBucket = (): string => {
  if (!process.env.DATA_BUCKET) {
    throw new Error('DATA_BUCKET environment variable is not set');
  }
  return process.env.DATA_BUCKET;
};

/**
 * Get the public bucket name for exports
 */
export const getPublicBucket = (): string => {
  return 'cubecobra-public';
};

/**
 * Upload a JSON object to S3
 */
export const uploadJson = async (key: string, data: any): Promise<void> => {
  const bucket = getJobsBucket();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    }),
  );
};

/**
 * Upload a JSON object to S3 by streaming it to a temp file first.
 * Use this for payloads that may exceed V8's max string length (~512MB),
 * which would cause JSON.stringify to throw "Invalid string length".
 *
 * Serializes top-level (and one level of nested) entries one at a time so
 * the full JSON is never materialized as a single string in memory.
 */
export const uploadJsonStreaming = async (key: string, data: Record<string, any> | any[]): Promise<void> => {
  const fs = await import('fs');
  const os = await import('os');
  const pathMod = await import('path');
  const { randomUUID } = await import('crypto');

  const tmpPath = pathMod.join(os.tmpdir(), `s3-upload-${randomUUID()}.json`);
  const stream = fs.createWriteStream(tmpPath, { encoding: 'utf-8' });

  const write = (chunk: string): Promise<void> =>
    new Promise((resolve, reject) => {
      if (!stream.write(chunk)) {
        stream.once('drain', () => resolve());
        stream.once('error', reject);
      } else {
        resolve();
      }
    });

  const writeValue = async (value: any): Promise<void> => {
    if (Array.isArray(value)) {
      await write('[');
      let first = true;
      for (const item of value) {
        if (!first) await write(',');
        await write(JSON.stringify(item));
        first = false;
      }
      await write(']');
    } else if (value && typeof value === 'object') {
      await write('{');
      let first = true;
      for (const [k, v] of Object.entries(value)) {
        if (!first) await write(',');
        await write(`${JSON.stringify(k)}:${JSON.stringify(v)}`);
        first = false;
      }
      await write('}');
    } else {
      await write(JSON.stringify(value));
    }
  };

  try {
    if (Array.isArray(data)) {
      await write('[');
      let first = true;
      for (const item of data) {
        if (!first) await write(',');
        await writeValue(item);
        first = false;
      }
      await write(']');
    } else {
      await write('{');
      let first = true;
      for (const [k, v] of Object.entries(data)) {
        if (!first) await write(',');
        await write(`${JSON.stringify(k)}:`);
        await writeValue(v);
        first = false;
      }
      await write('}');
    }

    await new Promise<void>((resolve, reject) => {
      stream.end((err?: any) => (err ? reject(err) : resolve()));
    });

    await uploadFile(key, tmpPath, 'application/json');
  } finally {
    try {
      await fs.promises.unlink(tmpPath);
    } catch {
      // ignore cleanup failures
    }
  }
};

/**
 * Upload a file from the filesystem to S3
 * Uses streaming to avoid loading large files into memory
 */
export const uploadFile = async (key: string, filePath: string, contentType?: string): Promise<void> => {
  const fs = await import('fs');
  const bucket = getJobsBucket();
  const stream = fs.createReadStream(filePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: stream,
      ContentType: contentType || 'application/json',
    }),
  );
};

/**
 * Upload a file to the public bucket for exports
 * Uses streaming to avoid loading large files into memory
 */
export const uploadFileToPublicBucket = async (key: string, filePath: string, contentType?: string): Promise<void> => {
  const fs = await import('fs');
  const bucket = getPublicBucket();
  const stream = fs.createReadStream(filePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: stream,
      ContentType: contentType || 'application/json',
    }),
  );
};

/**
 * Download a JSON object from a specific S3 bucket
 * Returns null if the object doesn't exist
 */
export const downloadJsonFromBucket = async (key: string, bucket: string): Promise<any | null> => {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      return null;
    }

    const { chunks, totalBytes } = await streamToChunks(response.Body as Readable);
    return parseJsonFromChunks(chunks, totalBytes);
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
};

/**
 * Download a JSON object from the DATA_BUCKET
 * Returns null if the object doesn't exist
 */
export const downloadJson = async (key: string): Promise<any | null> => {
  return downloadJsonFromBucket(key, getJobsBucket());
};

/**
 * Check if a file exists in S3
 */
export const fileExists = async (key: string): Promise<boolean> => {
  const bucket = getJobsBucket();
  try {
    await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    return true;
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
};

/**
 * List all files with a given prefix in S3
 * Returns an array of keys (file paths)
 */
export const listFiles = async (prefix: string): Promise<string[]> => {
  const bucket = getJobsBucket();
  const files: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key) {
          files.push(object.Key);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
};

/**
 * Get the most recent file from a list of S3 keys
 * Useful for getting the latest history state
 */
export const getMostRecentFile = async (prefix: string): Promise<string | null> => {
  const files = await listFiles(prefix);
  if (files.length === 0) {
    return null;
  }

  // Sort files by name (assuming date-based naming like YYYY-M-D.json)
  files.sort((a, b) => {
    const aName = a.split('/').pop()?.replace('.json', '') || '';
    const bName = b.split('/').pop()?.replace('.json', '') || '';

    // Parse date components
    const aParts = aName.split('-').map((x) => parseInt(x, 10));
    const bParts = bName.split('-').map((x) => parseInt(x, 10));

    // Compare year, month, day
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) {
        return bVal - aVal; // Descending order
      }
    }

    return 0;
  });

  return files[0] || null;
};

/**
 * V8 cannot create strings longer than ~512MB (0x1fffffe8 chars). Stay well
 * below that and stream-parse anything larger to avoid ERR_STRING_TOO_LONG.
 */
const MAX_JSON_STRING_BYTES = 256 * 1024 * 1024;

/**
 * Helper function to collect a stream into an array of buffers
 */
export async function streamToChunks(stream: Readable): Promise<{ chunks: Buffer[]; totalBytes: number }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    stream.on('data', (chunk) => {
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      chunks.push(buffer);
      totalBytes += buffer.length;
    });
    stream.on('error', reject);
    stream.on('end', () => resolve({ chunks, totalBytes }));
  });
}

/**
 * Parse JSON from buffered chunks. Small payloads use JSON.parse directly.
 * Payloads that would exceed V8's max string length are parsed incrementally
 * with jsonparse (the tokenizer underneath JSONStream), which builds the
 * result object token by token so the full JSON text is never materialized
 * as a single string (avoids ERR_STRING_TOO_LONG). Mirrors
 * uploadJsonStreaming, which does the same on the write side.
 *
 * Note: jsonparse is used directly instead of JSONStream because JSONStream
 * silently drops null values, which would not be faithful to JSON.parse.
 */
export async function parseJsonFromChunks(chunks: Buffer[], totalBytes: number): Promise<any> {
  if (totalBytes <= MAX_JSON_STRING_BYTES) {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  }

  return new Promise((resolve, reject) => {
    const parser = new Parser();
    let result: any;
    let done = false;

    parser.onValue = function (this: any, value: any) {
      // stack is empty once the root value is complete
      if (this.stack.length === 0) {
        result = value;
        done = true;
      }
    };
    parser.onError = (err: Error) => reject(err);

    try {
      for (const chunk of chunks) {
        parser.write(chunk);
      }
      if (!done) {
        // flush a trailing number token (e.g. a bare `42` root)
        parser.write(' ');
      }
    } catch (err) {
      reject(err);
      return;
    }

    if (!done) {
      reject(new Error('Unexpected end of JSON input'));
      return;
    }
    resolve(result);
  });
}
