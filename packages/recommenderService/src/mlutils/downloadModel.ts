import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import {
  INDEX_TO_ORACLE_FILE,
  isLegacyModelKey,
  isValidModelVersion,
  LEGACY_MODEL_VERSION,
  MODEL_POINTER_KEY,
  MODEL_PREFIX,
  type ModelPointer,
  modelVersionPrefix,
  parseModelPointer,
  REQUIRED_MODEL_NAMES,
} from '@utils/ml/modelBundle';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
dotenv.config();

const PUBLIC_BUCKET = 'cubecobra-public';

// Written into the local model/ directory alongside the files, naming the version they are.
export const LOCAL_VERSION_FILE = '.version';

const DOWNLOAD_CONCURRENCY = 4;

const publicS3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  // No credentials
  credentials: { accessKeyId: '', secretAccessKey: '' },
  // No signing of requests
  signer: { sign: async (req) => req },
});

const authenticatedS3 = new S3Client({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION,
});

/**
 * Path of a bucket key relative to the bundle it belongs to (model/<version>/encoder/model.json and
 * the legacy model/encoder/model.json both give encoder/model.json), or null for directory markers
 * and anything that would land outside the model directory.
 */
export const relativeModelPath = (key: string, sourcePrefix: string): string | null => {
  if (!key.startsWith(sourcePrefix) || key.endsWith('/')) return null;
  const relative = key.slice(sourcePrefix.length);
  if (!relative || relative.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return null;
  }
  return relative;
};

const hasRequiredModels = (modelDir: string): boolean =>
  fs.existsSync(path.join(modelDir, INDEX_TO_ORACLE_FILE)) &&
  REQUIRED_MODEL_NAMES.every((model) => fs.existsSync(path.join(modelDir, model, 'model.json')));

/** The version recorded in <basePath>/model/.version, or null when there isn't one. */
export const readLocalModelVersion = (basePath: string = ''): string | null => {
  try {
    const version = fs.readFileSync(path.join(basePath, 'model', LOCAL_VERSION_FILE), 'utf8').trim();
    return isValidModelVersion(version) ? version : null;
  } catch {
    return null;
  }
};

const isMissingObject = (err: unknown, anonymous: boolean): boolean => {
  const { name, $metadata } = (err ?? {}) as { name?: string; $metadata?: { httpStatusCode?: number } };
  const status = $metadata?.httpStatusCode;
  // An anonymous request for a key that doesn't exist gets 403 unless the bucket allows public listing.
  return name === 'NoSuchKey' || name === 'NotFound' || status === 404 || (anonymous && status === 403);
};

const clientFor = (bucket: string): S3Client => (bucket === PUBLIC_BUCKET ? publicS3 : authenticatedS3);

/**
 * model/current.json, or null when the bucket has none (it still has the legacy flat layout).
 * Other S3 failures throw, so a flaky read is never mistaken for a missing pointer.
 */
export const readModelPointer = async (bucket: string): Promise<ModelPointer | null> => {
  const s3 = clientFor(bucket);
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: MODEL_POINTER_KEY }));
    return parseModelPointer(await res.Body!.transformToString());
  } catch (err) {
    if (isMissingObject(err, s3 === publicS3)) return null;
    throw err;
  }
};

const listKeys = async (s3: S3Client, bucket: string, prefix: string): Promise<string[]> => {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    for (const object of res.Contents || []) {
      if (object.Key) keys.push(object.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
};

const downloadFile = async (s3: S3Client, bucket: string, key: string, localPath: string): Promise<void> => {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) {
    throw new Error(`S3 object body is empty: ${key}`);
  }
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  // Models are a mix of JSON and binary shards, so stream the bytes rather than decoding them.
  await pipeline(res.Body as Readable, fs.createWriteStream(localPath));
};

// Replaces modelDir with the freshly downloaded directory. Both sit in the same parent, so each
// step is a rename and a reader never sees a half-written model directory.
const swapIntoPlace = (downloadDir: string, modelDir: string): void => {
  const retiredDir = path.join(path.dirname(downloadDir), `.model-retired-${process.pid}-${Date.now()}`);
  const hadModel = fs.existsSync(modelDir);
  if (hadModel) fs.renameSync(modelDir, retiredDir);
  try {
    fs.renameSync(downloadDir, modelDir);
  } catch (err) {
    if (hadModel) fs.renameSync(retiredDir, modelDir);
    throw err;
  }
  if (hadModel) fs.rmSync(retiredDir, { recursive: true, force: true });
};

const downloadVersion = async (
  s3: S3Client,
  bucket: string,
  basePath: string,
  pointer: ModelPointer | null,
): Promise<boolean> => {
  const version = pointer?.version ?? LEGACY_MODEL_VERSION;
  let sourcePrefix = modelVersionPrefix(version);
  let keys = pointer ? await listKeys(s3, bucket, sourcePrefix) : [];
  if (keys.length === 0 && version === LEGACY_MODEL_VERSION) {
    // No pointer yet, or a v3 pointer in a bucket whose flat files haven't been copied to model/v3/.
    sourcePrefix = MODEL_PREFIX;
    keys = (await listKeys(s3, bucket, MODEL_PREFIX)).filter(isLegacyModelKey);
  }
  const files = keys
    .map((key) => ({ key, relative: relativeModelPath(key, sourcePrefix) }))
    .filter((file): file is { key: string; relative: string } => file.relative !== null);

  if (files.length === 0) {
    console.error(`No model files found in s3://${bucket}/${sourcePrefix}`);
    return false;
  }

  console.log(`Downloading model ${version} (${files.length} files) from s3://${bucket}/${sourcePrefix}...`);
  fs.mkdirSync(basePath || '.', { recursive: true });
  const downloadDir = fs.mkdtempSync(path.join(basePath || '.', '.model-download-'));
  try {
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < files.length) {
        const file = files[next++]!;
        await downloadFile(s3, bucket, file.key, path.join(downloadDir, file.relative));
        console.log(`Downloaded ${file.key}`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, files.length) }, worker));
    fs.writeFileSync(path.join(downloadDir, LOCAL_VERSION_FILE), version);
    swapIntoPlace(downloadDir, path.join(basePath, 'model'));
  } catch (err) {
    fs.rmSync(downloadDir, { recursive: true, force: true });
    throw err;
  }
  return true;
};

// The version of a complete model on disk, or null. A model directory from before versioning has no
// .version file; its files are the legacy model.
const localModelVersion = (basePath: string): string | null =>
  hasRequiredModels(path.join(basePath, 'model')) ? (readLocalModelVersion(basePath) ?? LEGACY_MODEL_VERSION) : null;

/**
 * Makes <basePath>/model/ hold `pointer`'s version (the legacy flat files when there is no pointer),
 * downloading only when it doesn't already. False when the bucket has no files for that version;
 * S3 failures throw and leave model/ as it was.
 */
export const syncModelToPointer = async (
  basePath: string,
  bucket: string,
  pointer: ModelPointer | null,
): Promise<boolean> => {
  const version = pointer?.version ?? LEGACY_MODEL_VERSION;
  if (localModelVersion(basePath) === version) {
    console.log(`Model ${version} is already downloaded.`);
    return true;
  }
  if (!(await downloadVersion(clientFor(bucket), bucket, basePath, pointer))) return false;
  console.log(`Model ${version} is in place.`);
  return true;
};

/**
 * Makes <basePath>/model/ hold the model the bucket's model/current.json points at, and returns the
 * version left in place. When S3 can't be read and a model is already on disk, that model is kept
 * (and its version returned) instead.
 */
export const downloadModelsFromS3 = async (basePath: string = '', bucket: string): Promise<string> => {
  const localVersion = localModelVersion(basePath);
  try {
    const pointer = await readModelPointer(bucket);
    const version = pointer?.version ?? LEGACY_MODEL_VERSION;
    return (await syncModelToPointer(basePath, bucket, pointer)) ? version : (localVersion ?? version);
  } catch (err) {
    if (localVersion) {
      console.error(`Model download from s3://${bucket} failed; keeping local model ${localVersion}.`, err);
      return localVersion;
    }
    throw err;
  }
};
