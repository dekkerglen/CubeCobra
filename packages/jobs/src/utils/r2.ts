// Cloudflare R2 client for the jobs package. R2 is S3-API compatible, but it
// uses its own endpoint + access keys (distinct from the AWS credentials the
// rest of the jobs use via utils/s3.ts), so it gets its own client here.
//
// Required env: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export const R2_BUCKET = process.env.R2_BUCKET || '';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  maxAttempts: 5,
});

export const r2Configured = (): boolean =>
  !!(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && R2_BUCKET);

export const putObject = async (
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl?: string,
): Promise<void> => {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
};

// Read a small JSON object, returning null if the key doesn't exist yet.
export const getJson = async <T>(key: string): Promise<T | null> => {
  try {
    const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    const text = await res.Body!.transformToString();
    return JSON.parse(text) as T;
  } catch (e: any) {
    if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
};

export const putJson = async (key: string, data: unknown): Promise<void> => {
  await putObject(key, Buffer.from(JSON.stringify(data)), 'application/json', 'no-cache');
};
