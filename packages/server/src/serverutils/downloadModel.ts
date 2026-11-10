import type { S3 } from '@aws-sdk/client-s3';
import {
  INDEX_TO_ORACLE_FILE,
  isLegacyModelKey,
  isValidModelVersion,
  LEGACY_MODEL_VERSION,
  MODEL_PREFIX,
  modelVersionPrefix,
  REQUIRED_MODEL_NAMES,
} from '@utils/ml/modelBundle';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import 'dotenv/config';

import { publicS3, s3 as authenticatedS3 } from '../dynamo/s3client';
import { readModelPointer } from './modelPointer';

// Written into the local model/ directory alongside the files, naming the version they are. Same
// convention as the recommender's downloader (packages/recommenderService/src/mlutils/downloadModel.ts).
const LOCAL_VERSION_FILE = '.version';

const DOWNLOAD_CONCURRENCY = 4;

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

const readLocalModelVersion = (modelDir: string): string | null => {
  try {
    const version = fs.readFileSync(path.join(modelDir, LOCAL_VERSION_FILE), 'utf8').trim();
    return isValidModelVersion(version) ? version : null;
  } catch {
    return null;
  }
};

const listKeys = async (s3: S3, bucket: string, prefix: string): Promise<string[]> => {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await s3.listObjectsV2({ Bucket: bucket, Prefix: prefix, ContinuationToken: token });
    for (const object of res.Contents || []) {
      if (object.Key) keys.push(object.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
};

/**
 * Downloads the model the bucket's model/current.json points at into <basePath>/model/ and returns
 * its version. Without a pointer the bucket still has the legacy flat layout (version v3), and only
 * those flat files are fetched. Files are downloaded to a temporary directory that then replaces
 * model/, so an interrupted download never leaves a mix of two versions; nothing is downloaded when
 * model/ is already that version.
 */
export const downloadModelsFromS3 = async (basePath: string = '', bucket: string): Promise<string> => {
  // Use singleton S3 client based on bucket type
  const s3 = bucket === 'cubecobra-public' ? publicS3 : authenticatedS3;
  const modelDir = path.join(basePath, 'model');

  const pointer = await readModelPointer(bucket);
  const version = pointer?.version ?? LEGACY_MODEL_VERSION;
  if (hasRequiredModels(modelDir) && readLocalModelVersion(modelDir) === version) {
    console.log(`Model ${version} is already downloaded.`);
    return version;
  }

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
    console.log(`No model files found in s3://${bucket}/${sourcePrefix}`);
    return version;
  }

  console.log(`Downloading model ${version} (${files.length} files) from S3...`);
  fs.mkdirSync(basePath || '.', { recursive: true });
  const downloadDir = fs.mkdtempSync(path.join(basePath || '.', '.model-download-'));
  try {
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < files.length) {
        const file = files[next++]!;
        const res = await s3.getObject({ Bucket: bucket, Key: file.key });
        if (!res.Body) {
          throw new Error(`S3 object body is empty: ${file.key}`);
        }
        const localPath = path.join(downloadDir, file.relative);
        fs.mkdirSync(path.dirname(localPath), { recursive: true });
        // Models are a mix of JSON and binary, can't simply call res.Body.transformToString
        await pipeline(res.Body as Readable, fs.createWriteStream(localPath));
        console.log(`Downloaded ${file.key}`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, files.length) }, worker));
    fs.writeFileSync(path.join(downloadDir, LOCAL_VERSION_FILE), version);

    if (fs.existsSync(modelDir)) {
      fs.rmSync(modelDir, { recursive: true, force: true });
    }
    fs.renameSync(downloadDir, modelDir);
  } catch (err) {
    fs.rmSync(downloadDir, { recursive: true, force: true });
    throw err;
  }

  return version;
};
