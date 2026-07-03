#!/usr/bin/env ts-node
// use dotenv
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { Upload } from '@aws-sdk/lib-storage';
import { MODEL_VERSION } from '@utils/modelVersion';

// Mirrors the ML model from the data bucket (where the recommender service
// downloads it on boot) into the R2 assets bucket so it's reachable at
// https://assets.<domain>/model/<MODEL_VERSION>/... for the client draft bot.
//
// The source layout on S3 is flat and unversioned (`model/...`, overwritten in
// place by the training pipeline). We publish into a versioned R2 prefix so the
// browser — which caches these files `immutable` for a year — fetches a fresh
// URL on every model rollout instead of a stale, cached graph. Bump
// @utils/modelVersion (and redeploy the client) in the same release you run this.
//
// Cross-provider (AWS S3 -> Cloudflare R2), so we stream each object from S3
// straight into R2 — CopyObject can't span providers. Streamed via lib-storage
// so large model files don't get buffered in memory.
//
// Manual, one-shot: the model changes ~once a year. Idempotent by size (ETags
// aren't comparable across providers).
//
// Env:
//   DATA_BUCKET            — source S3 bucket (defaults to cubecobra-data-production)
//   DATA_BUCKET_REGION     — source region (defaults to us-east-2 / AWS_REGION)
//   R2_ENDPOINT            — R2 S3 endpoint (required)
//   R2_ACCESS_KEY_ID       — R2 access key (required)
//   R2_SECRET_ACCESS_KEY   — R2 secret key (required)
//   R2_BUCKET              — destination R2 bucket (required)

// Flat source prefix on S3; versioned destination prefix on R2.
const SOURCE_PREFIX = 'model/';
const DEST_PREFIX = `model/${MODEL_VERSION}/`;
const IMMUTABLE = 'public, max-age=31536000, immutable';

const sourceBucket = process.env.DATA_BUCKET || 'cubecobra-data-production';
const destBucket = process.env.R2_BUCKET;
if (!process.env.R2_ENDPOINT || !destBucket) {
  console.error('R2_ENDPOINT and R2_BUCKET are required (plus R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)');
  process.exit(1);
}

const sourceRegion = process.env.DATA_BUCKET_REGION || process.env.AWS_REGION || 'us-east-2';

const sourceS3 = new S3Client({
  credentials: fromNodeProviderChain(),
  region: sourceRegion,
});

const destR2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const contentTypeFor = (key: string): string =>
  key.endsWith('.json') ? 'application/json' : 'application/octet-stream';

interface ObjectInfo {
  key: string;
  size: number;
}

const listAll = async (s3: S3Client, bucket: string, prefix: string): Promise<ObjectInfo[]> => {
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

const main = async (): Promise<void> => {
  console.log(`Mirroring s3://${sourceBucket}/${SOURCE_PREFIX} (${sourceRegion}) → R2 ${destBucket}/${DEST_PREFIX}`);

  const [sourceObjects, destObjects] = await Promise.all([
    listAll(sourceS3, sourceBucket, SOURCE_PREFIX),
    listAll(destR2, destBucket!, DEST_PREFIX),
  ]);

  if (sourceObjects.length === 0) {
    console.log('No model files in source — nothing to do.');
    return;
  }

  // Compare by path relative to each prefix: source keys are `model/<rel>`,
  // dest keys are `model/<MODEL_VERSION>/<rel>`.
  const destSizeByRelKey = new Map<string, number>();
  for (const o of destObjects) destSizeByRelKey.set(o.key.slice(DEST_PREFIX.length), o.size);

  let copied = 0;
  let skipped = 0;
  for (const src of sourceObjects) {
    const relKey = src.key.slice(SOURCE_PREFIX.length);
    const destKey = `${DEST_PREFIX}${relKey}`;
    if (destSizeByRelKey.get(relKey) === src.size) {
      skipped += 1;
      continue;
    }

    const obj = await sourceS3.send(new GetObjectCommand({ Bucket: sourceBucket, Key: src.key }));
    await new Upload({
      client: destR2,
      params: {
        Bucket: destBucket,
        Key: destKey,
        Body: obj.Body,
        CacheControl: IMMUTABLE,
        ContentType: contentTypeFor(src.key),
      },
    }).done();
    copied += 1;
    console.log(`  copied ${src.key} → ${destKey}`);
  }

  console.log(`Done. Copied ${copied}, skipped ${skipped} (same size).`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
