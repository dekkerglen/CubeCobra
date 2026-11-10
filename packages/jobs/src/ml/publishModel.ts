// Retraining stage 8: copies the run's checked bundle to model/<version>/ in every environment's
// data bucket (for the recommender and jobs) and R2 bucket (for the browser draft bot). Nothing
// reads a published version until promotion moves model/current.json to it, and published versions
// are never overwritten, so rollback is always possible. Safe to retry: files already published
// with the same size are skipped.
import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import {
  ARCHETYPE_NAMES_FILE,
  ARCHETYPE_NAMING_FILE,
  ARCHETYPE_TOPICS_FILE,
  BUNDLE_MANIFEST_FILE,
  INDEX_TO_ORACLE_FILE,
  ModelManifest,
  modelVersionPrefix,
  REQUIRED_MODEL_NAMES,
  runPrefix,
} from '@utils/ml/modelBundle';
import { Readable } from 'stream';

import { mlPublishBuckets, mlR2Targets, mlRunId, mlRunsBucket, R2Target } from './config';
import { copyObject, listKeys, readJson, s3 } from './s3';

// The browser caches model files for a year: every version lives at its own URL.
const IMMUTABLE = 'public, max-age=31536000, immutable';

const contentTypeFor = (key: string) => (key.endsWith('.json') ? 'application/json' : 'application/octet-stream');

const sizeOf = async (client: S3Client, bucket: string, key: string): Promise<number | null> => {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength ?? null;
  } catch (error: any) {
    if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
};

/** Throws unless every file the recommender and the browser load is in the bundle. */
const checkBundle = async (bucket: string, prefix: string, keys: Set<string>) => {
  const required = [
    BUNDLE_MANIFEST_FILE,
    INDEX_TO_ORACLE_FILE,
    ARCHETYPE_TOPICS_FILE,
    ARCHETYPE_NAMES_FILE,
    ARCHETYPE_NAMING_FILE,
  ];
  for (const name of REQUIRED_MODEL_NAMES) {
    required.push(`${name}/model.json`);
    const modelJson = await readJson<{ weightsManifest: Array<{ paths: string[] }> }>(bucket, `${prefix}${name}/model.json`);
    for (const group of modelJson?.weightsManifest || []) {
      required.push(...group.paths.map((shard) => `${name}/${shard}`));
    }
  }
  const missing = required.filter((file) => !keys.has(`${prefix}${file}`));
  if (missing.length > 0) throw new Error(`Bundle is incomplete, missing: ${missing.join(', ')}`);
};

const publishToR2 = async (target: R2Target, runsBucket: string, sourceKeys: string[], sourcePrefix: string, destPrefix: string) => {
  const r2 = new S3Client({
    region: 'auto',
    endpoint: target.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: target.accessKeyId, secretAccessKey: target.secretAccessKey },
  });
  for (const key of sourceKeys) {
    const destKey = `${destPrefix}${key.slice(sourcePrefix.length)}`;
    const source = await s3.send(new GetObjectCommand({ Bucket: runsBucket, Key: key }));
    if ((await sizeOf(r2, target.bucket, destKey)) === source.ContentLength) {
      (source.Body as Readable).destroy();
      continue;
    }
    // Cross-provider, so stream each object through rather than CopyObject.
    await new Upload({
      client: r2,
      params: {
        Bucket: target.bucket,
        Key: destKey,
        Body: source.Body as Readable,
        ContentType: contentTypeFor(key),
        CacheControl: IMMUTABLE,
      },
    }).done();
  }
  console.log(`Published ${sourceKeys.length} files to R2 ${target.name} (${target.bucket}/${destPrefix})`);
};

(async () => {
  const runId = mlRunId();
  const runsBucket = mlRunsBucket();
  const sourcePrefix = `${runPrefix(runId)}bundle/`;
  const keys = await listKeys(runsBucket, sourcePrefix);
  await checkBundle(runsBucket, sourcePrefix, new Set(keys));

  const manifest = await readJson<ModelManifest>(runsBucket, `${sourcePrefix}${BUNDLE_MANIFEST_FILE}`);
  if (!manifest) throw new Error('Bundle has no manifest');
  const destPrefix = modelVersionPrefix(manifest.version);

  for (const bucket of mlPublishBuckets()) {
    let copied = 0;
    for (const key of keys) {
      const destKey = `${destPrefix}${key.slice(sourcePrefix.length)}`;
      const [sourceSize, destSize] = await Promise.all([sizeOf(s3, runsBucket, key), sizeOf(s3, bucket, destKey)]);
      if (destSize !== null && destSize === sourceSize) continue;
      await copyObject(runsBucket, key, bucket, destKey);
      copied += 1;
    }
    console.log(`Published ${manifest.version} to s3://${bucket}/${destPrefix} (${copied} files copied)`);
  }

  for (const target of mlR2Targets()) {
    await publishToR2(target, runsBucket, keys, sourcePrefix, destPrefix);
  }

  process.exit(0);
})().catch((error) => {
  console.error('Publishing the model failed:', error);
  process.exit(1);
});
