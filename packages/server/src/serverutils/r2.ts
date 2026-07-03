// Cloudflare R2 client for the server package. R2 is S3-API compatible but uses its own
// endpoint + access keys (distinct from the AWS credentials used for app data via s3client).
// Mirrors packages/jobs/src/utils/r2.ts.
//
// Required env: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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

export const deleteObject = async (key: string): Promise<void> => {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    }),
  );
};
