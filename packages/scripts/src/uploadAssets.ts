import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Uploads packages/server/public/* to the assets S3 bucket configured for the
// current stage. Everything except manifest.json is treated as immutable for
// a year — hashed JS/CSS bundles can be safely cached forever because the URL
// changes on content change, and content/* assets are renamed (not edited in
// place) when they need to change. manifest.json is uploaded last so the
// server's bundle map flips atomically from old → new.
//
// Used by `npm run upload-assets` (via root publish) and by CI against
// LocalStack to smoke-test the path.

const PUBLIC_DIR = path.resolve(__dirname, '../../server/public');
const MANIFEST_NAME = 'manifest.json';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const NO_CACHE = 'public, max-age=60, must-revalidate';

// The assets bucket lives in the AssetsStack, which is pinned to us-east-1
// (CloudFront's required region for ACM certs on custom domains — see
// packages/cdk/app/infra.ts). CodeBuild sets AWS_DEFAULT_REGION to us-east-2
// for the main stack, so we can't fall back to that here or S3 returns a
// PermanentRedirect.
// When R2_ENDPOINT is set we upload to Cloudflare R2 (S3-compatible) instead of
// AWS S3 — the target for the Cloudflare cutover. R2 uses its own access keys
// (not the AWS provider chain) and path-style addressing. CUBECOBRA_ASSETS_BUCKET
// is then the R2 bucket name. Leaving R2_ENDPOINT unset keeps the AWS S3 path.
const useR2 = !!process.env.R2_ENDPOINT;

const s3 = new S3Client(
  useR2
    ? {
        endpoint: process.env.R2_ENDPOINT,
        region: 'auto',
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
      }
    : {
        endpoint: process.env.AWS_ENDPOINT || undefined,
        forcePathStyle: !!process.env.AWS_ENDPOINT,
        credentials: fromNodeProviderChain(),
        region: process.env.CUBECOBRA_ASSETS_REGION || 'us-east-1',
      },
);

// In R2 mode target R2_BUCKET so we don't disturb CUBECOBRA_ASSETS_BUCKET, which
// the jobs still use to write the card catalog to the S3 assets bucket.
const bucket = (useR2 && process.env.R2_BUCKET) || process.env.CUBECOBRA_ASSETS_BUCKET;
if (!bucket) {
  console.error('Set R2_BUCKET (R2 mode) or CUBECOBRA_ASSETS_BUCKET');
  process.exit(1);
}

const cacheControlFor = (key: string): string => {
  if (key === MANIFEST_NAME) return NO_CACHE;
  return IMMUTABLE;
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.html': 'text/html',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

const contentTypeFor = (filePath: string): string =>
  CONTENT_TYPE_BY_EXT[path.extname(filePath).toLowerCase()] || 'application/octet-stream';

const walk = (dir: string, base: string = dir): string[] => {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, base));
    } else if (entry.isFile()) {
      out.push(path.relative(base, full));
    }
  }
  return out;
};

const uploadOne = async (relativePath: string): Promise<void> => {
  const key = relativePath.split(path.sep).join('/');
  const filePath = path.join(PUBLIC_DIR, relativePath);
  const body = fs.readFileSync(filePath);
  const contentType = contentTypeFor(filePath);
  const cacheControl = cacheControlFor(key);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
};

const main = async (): Promise<void> => {
  if (!fs.existsSync(PUBLIC_DIR)) {
    console.error(`No public dir at ${PUBLIC_DIR} — did you run the build first?`);
    process.exit(1);
  }

  const files = walk(PUBLIC_DIR);
  // Push manifest.json last so the server's bundle map cuts over only after
  // all referenced bundles are already on S3.
  const ordered = [...files.filter((f) => f !== MANIFEST_NAME), ...files.filter((f) => f === MANIFEST_NAME)];

  console.log(`Uploading ${ordered.length} files to s3://${bucket}/`);
  let count = 0;
  for (const f of ordered) {
    await uploadOne(f);
    count += 1;
    if (count % 25 === 0 || count === ordered.length) {
      console.log(`  ${count}/${ordered.length}`);
    }
  }

  // Round-trip check: confirm manifest landed.
  await s3.send(new GetObjectCommand({ Bucket: bucket, Key: MANIFEST_NAME }));
  console.log('Upload complete.');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
