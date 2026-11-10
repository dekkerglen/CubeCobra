#!/usr/bin/env ts-node
// use dotenv
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import {
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import {
  isLegacyModelKey,
  LEGACY_MODEL_VERSION,
  MODEL_POINTER_KEY,
  MODEL_PREFIX,
  type ModelPointer,
  modelVersionPrefix,
} from '@utils/ml/modelBundle';

// One-time move of a data bucket's ML model to the versioned layout (see @utils/ml/modelBundle).
//
// Before the retraining pipeline the model sat flat under model/ (model/encoder/...,
// model/indexToOracleMap.json). This copies those legacy files to model/v3/ with server-side
// CopyObject, then writes model/current.json = { version: 'v3' } unless the bucket already has a
// pointer. R2 already has model/v3/ (scripts/uploadMLModel.ts), so the browser needs nothing.
//
// The flat files are left in place: anything deployed before the versioned layout still reads them,
// and every consumer falls back to them while a bucket has no pointer.
//
// Dry run by default; pass --apply to write. Safe to re-run: files already copied at the same size
// are skipped, and an existing pointer is never overwritten.
//
// Env:
//   DATA_BUCKET            — the bucket to migrate (required)
//   DATA_BUCKET_REGION     — its region (defaults to AWS_REGION / us-east-2)

const apply = process.argv.includes('--apply');

const bucket: string = process.env.DATA_BUCKET || '';
if (!bucket) {
  console.error('DATA_BUCKET is required');
  process.exit(1);
}

const region = process.env.DATA_BUCKET_REGION || process.env.AWS_REGION || 'us-east-2';

const s3 = new S3Client({
  credentials: fromNodeProviderChain(),
  region,
});

interface ObjectInfo {
  key: string;
  size: number;
}

const listAll = async (prefix: string): Promise<ObjectInfo[]> => {
  const out: ObjectInfo[] = [];
  let token: string | undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    for (const o of res.Contents || []) {
      if (!o.Key || o.Key.endsWith('/')) continue;
      out.push({ key: o.Key, size: o.Size || 0 });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
};

const pointerExists = async (): Promise<boolean> => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: MODEL_POINTER_KEY }));
    return true;
  } catch (err) {
    const { name, $metadata } = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (name === 'NotFound' || name === 'NoSuchKey' || $metadata?.httpStatusCode === 404) return false;
    throw err;
  }
};

const main = async (): Promise<void> => {
  const destPrefix = modelVersionPrefix(LEGACY_MODEL_VERSION);
  console.log(`${apply ? 'Migrating' : 'Dry run:'} s3://${bucket}/${MODEL_PREFIX} → ${destPrefix} (${region})`);

  const objects = await listAll(MODEL_PREFIX);
  const legacy = objects.filter((o) => isLegacyModelKey(o.key));
  const destSizeByKey = new Map(
    objects.filter((o) => o.key.startsWith(destPrefix)).map((o): [string, number] => [o.key, o.size]),
  );

  if (legacy.length === 0 && destSizeByKey.size === 0) {
    console.log('No legacy model files and nothing under model/v3/ — nothing to do.');
    return;
  }

  let copied = 0;
  let skipped = 0;
  for (const src of legacy) {
    const destKey = `${destPrefix}${src.key.slice(MODEL_PREFIX.length)}`;
    if (destSizeByKey.get(destKey) === src.size) {
      skipped += 1;
      continue;
    }
    if (apply) {
      await s3.send(
        new CopyObjectCommand({ Bucket: bucket, Key: destKey, CopySource: encodeURI(`${bucket}/${src.key}`) }),
      );
    }
    copied += 1;
    console.log(`  ${apply ? 'copied' : 'would copy'} ${src.key} → ${destKey}`);
  }
  console.log(`${apply ? 'Copied' : 'Would copy'} ${copied}, skipped ${skipped} (same size).`);

  if (await pointerExists()) {
    console.log(`${MODEL_POINTER_KEY} already exists — leaving it alone.`);
    return;
  }

  const pointer: ModelPointer = { version: LEGACY_MODEL_VERSION, promotedAt: Date.now() };
  if (apply) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: MODEL_POINTER_KEY,
        Body: JSON.stringify(pointer),
        ContentType: 'application/json',
        // Never clobber a pointer written since the check above.
        IfNoneMatch: '*',
      }),
    );
  }
  console.log(`${apply ? 'Wrote' : 'Would write'} ${MODEL_POINTER_KEY}: ${JSON.stringify(pointer)}`);
  if (!apply) {
    console.log('Dry run — pass --apply to write.');
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
