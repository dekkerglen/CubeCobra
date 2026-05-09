import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Uploads packages/server/public/* to the assets S3 bucket configured for the
// current stage. Hashed bundles get an immutable cache header; everything else
// gets a 1-day TTL with stale-while-revalidate. manifest.json is uploaded last
// so the server's bundle map flips atomically from old → new.
//
// Used by `npm run upload-assets` (via root publish) and by CI against
// LocalStack to smoke-test the path.

const PUBLIC_DIR = path.resolve(__dirname, '../../server/public');
const HASHED_RE = /\.[a-f0-9]{8}\.(?:js|css)$/;
const MANIFEST_NAME = 'manifest.json';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const SHORT = 'public, max-age=86400, stale-while-revalidate=604800';
const NO_CACHE = 'public, max-age=60, must-revalidate';

// The assets bucket lives in the AssetsStack, which is pinned to us-east-1
// (CloudFront's required region for ACM certs on custom domains — see
// packages/cdk/app/infra.ts). CodeBuild sets AWS_DEFAULT_REGION to us-east-2
// for the main stack, so we can't fall back to that here or S3 returns a
// PermanentRedirect.
const s3 = new S3Client({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: fromNodeProviderChain(),
  region: process.env.CUBECOBRA_ASSETS_REGION || 'us-east-1',
});

const bucket = process.env.CUBECOBRA_ASSETS_BUCKET;
if (!bucket) {
  console.error('CUBECOBRA_ASSETS_BUCKET is required');
  process.exit(1);
}

const cacheControlFor = (key: string): string => {
  if (key === MANIFEST_NAME) return NO_CACHE;
  if (HASHED_RE.test(key)) return IMMUTABLE;
  if (key.startsWith('js/')) return IMMUTABLE; // webpack outputs are content-hashed
  return SHORT;
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
