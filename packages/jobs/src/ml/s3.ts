// Bucket helpers for the ML stages. Unlike ../utils/s3.ts these take an explicit bucket: the
// stages read the public export, the run's working prefix and the live model, and publish to
// several environments' buckets.
import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { Upload } from '@aws-sdk/lib-storage';
import {
  isLegacyModelKey,
  LEGACY_MODEL_VERSION,
  MODEL_POINTER_KEY,
  MODEL_PREFIX,
  modelVersionPrefix,
  parseModelPointer,
} from '@utils/ml/modelBundle';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

import { downloadJsonFromBucket } from '../utils/s3';

export const s3 = new S3Client({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION,
  maxAttempts: 5,
});

const isNotFound = (error: any): boolean =>
  error?.name === 'NoSuchKey' || error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404;

export const listKeys = async (bucket: string, prefix: string): Promise<string[]> => {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const response = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }),
    );
    for (const object of response.Contents || []) {
      if (object.Key && !object.Key.endsWith('/')) keys.push(object.Key);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
};

export const objectExists = async (bucket: string, key: string): Promise<boolean> => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
};

/** Parses JSON of any size (large payloads are parsed incrementally). Null when the key is missing. */
export const readJson = async <T>(bucket: string, key: string): Promise<T | null> =>
  (await downloadJsonFromBucket(key, bucket)) as T | null;

export const writeJson = async (bucket: string, key: string, data: unknown): Promise<void> => {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    }),
  );
};

export const downloadFile = async (bucket: string, key: string, localPath: string): Promise<void> => {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error(`Empty body for s3://${bucket}/${key}`);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  await pipeline(response.Body as Readable, fs.createWriteStream(localPath));
};

/** Downloads every key under `prefix` into `localDir`, keeping the path below the prefix. */
export const downloadPrefix = async (bucket: string, prefix: string, localDir: string): Promise<number> => {
  const keys = await listKeys(bucket, prefix);
  for (const key of keys) {
    await downloadFile(bucket, key, path.join(localDir, key.slice(prefix.length)));
  }
  return keys.length;
};

const contentTypeFor = (file: string): string => {
  if (file.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
};

/** Multipart upload, so files past the 5 GB single-PUT limit (the co-occurrence matrix) work. */
export const uploadFile = async (bucket: string, key: string, localPath: string): Promise<void> => {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(localPath),
      ContentType: contentTypeFor(localPath),
    },
    partSize: 64 * 1024 * 1024,
    queueSize: 4,
  });
  await upload.done();
};

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

export const uploadDirectory = async (localDir: string, bucket: string, prefix: string): Promise<number> => {
  const files = walk(localDir);
  for (const file of files) {
    const relative = path.relative(localDir, file).split(path.sep).join('/');
    await uploadFile(bucket, `${prefix}${relative}`, file);
  }
  return files.length;
};

export const copyObject = async (
  sourceBucket: string,
  sourceKey: string,
  bucket: string,
  key: string,
): Promise<void> => {
  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: key,
      CopySource: `${sourceBucket}/${encodeURIComponent(sourceKey).replace(/%2F/g, '/')}`,
    }),
  );
};

/**
 * Downloads the model an environment currently serves into `localDir` (encoder/, cube_decoder/, ...,
 * indexToOracleMap.json and, for pipeline-built versions, archetypes/). Returns its version, or null
 * when the bucket has no model at all.
 */
export const downloadServedModel = async (bucket: string, localDir: string): Promise<string | null> => {
  let pointerRaw: string | null = null;
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: MODEL_POINTER_KEY }));
    pointerRaw = (await response.Body?.transformToString()) ?? null;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  if (pointerRaw) {
    const { version } = parseModelPointer(pointerRaw);
    const count = await downloadPrefix(bucket, modelVersionPrefix(version), localDir);
    if (count === 0) throw new Error(`Pointer names ${version} but s3://${bucket}/model/${version}/ is empty`);
    return version;
  }

  // Before the first pointer, the model sits flat under model/.
  const legacyKeys = (await listKeys(bucket, MODEL_PREFIX)).filter(isLegacyModelKey);
  if (legacyKeys.length === 0) return null;
  for (const key of legacyKeys) {
    await downloadFile(bucket, key, path.join(localDir, key.slice(MODEL_PREFIX.length)));
  }
  return LEGACY_MODEL_VERSION;
};
