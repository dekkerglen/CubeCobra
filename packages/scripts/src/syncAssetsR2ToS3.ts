import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';

dotenv.config();

// Incident/migration bridge: copies the live static assets from the Cloudflare R2
// bucket back into the legacy AWS S3 assets bucket that the old CloudFront
// distribution still serves. During the R2 cutover `uploadAssets` in R2 mode
// stopped writing to S3, so the new hashed bundles exist only in R2. Users whose
// DNS still resolves assets.<domain> to the old CloudFront/S3 origin then get
// S3 AccessDenied/NoSuchKey (application/xml + nosniff) for the new hashes and
// the page's scripts are blocked. Running this makes BOTH origins serve the same
// bytes, so it no longer matters which one a user's DNS lands on. Safe to re-run;
// it overwrites each key with the identical bytes from R2 (Content-Type and
// Cache-Control preserved). Retire once DNS has fully converged onto Cloudflare.
//
//   npm --workspace @cubecobra/scripts run sync-assets-r2-to-s3
//
// Env (same vars the jobs already use):
//   Source R2:  R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//   Dest   S3:  CUBECOBRA_ASSETS_BUCKET (the legacy bucket, e.g. cubecobra-assets-production),
//               CUBECOBRA_ASSETS_REGION (defaults to us-east-1 — the AssetsStack region)

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET;
const S3_BUCKET = process.env.CUBECOBRA_ASSETS_BUCKET;
const S3_REGION = process.env.CUBECOBRA_ASSETS_REGION || 'us-east-1';

if (!R2_ENDPOINT || !R2_BUCKET || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  console.error('Set R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (source).');
  process.exit(1);
}
if (!S3_BUCKET) {
  console.error('Set CUBECOBRA_ASSETS_BUCKET to the legacy S3 assets bucket (destination).');
  process.exit(1);
}

const r2 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const s3 = new S3Client({
  region: S3_REGION,
  credentials: fromNodeProviderChain(),
});

// Prefixes to bridge. manifest.json is copied LAST (like uploadAssets) so the old
// origin's bundle map only flips after every referenced bundle is already there.
// Pass prefixes as CLI args to override (e.g. `... js/` to sync only bundles).
const DEFAULT_PREFIXES = ['js/', 'css/', 'content/'];
const argPrefixes = process.argv.slice(2);
const dataPrefixes = argPrefixes.length ? argPrefixes.filter((p) => p !== 'manifest.json') : DEFAULT_PREFIXES;
const includeManifest = argPrefixes.length === 0 || argPrefixes.includes('manifest.json');

const CONCURRENCY = 12;

const listKeys = async (prefix: string): Promise<string[]> => {
  const keys: string[] = [];
  let ContinuationToken: string | undefined;
  do {
    const res = await r2.send(
      new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix, ContinuationToken }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
};

const copyOne = async (key: string): Promise<void> => {
  const src = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  const body = Buffer.from(await src.Body!.transformToByteArray());
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: src.ContentType,
      CacheControl: src.CacheControl,
    }),
  );
};

const runPool = async (keys: string[], n: number, worker: (key: string) => Promise<void>): Promise<void> => {
  let i = 0;
  let done = 0;
  const runners = Array.from({ length: Math.min(n, keys.length) }, async () => {
    while (i < keys.length) {
      const key = keys[i++];
      if (key === undefined) break;
      await worker(key);
      done += 1;
      if (done % 25 === 0 || done === keys.length) {
        console.log(`  ${done}/${keys.length}`);
      }
    }
  });
  await Promise.all(runners);
};

const main = async (): Promise<void> => {
  console.log(`Bridging R2 (${R2_BUCKET}) -> S3 (${S3_BUCKET}, ${S3_REGION})`);

  const keys: string[] = [];
  for (const prefix of dataPrefixes) {
    const found = await listKeys(prefix);
    console.log(`  ${prefix} -> ${found.length} objects`);
    keys.push(...found);
  }

  console.log(`Copying ${keys.length} objects...`);
  await runPool(keys, CONCURRENCY, copyOne);

  if (includeManifest) {
    console.log('Copying manifest.json last...');
    await copyOne('manifest.json');
  }

  console.log('Done. Both origins now serve the same assets.');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
