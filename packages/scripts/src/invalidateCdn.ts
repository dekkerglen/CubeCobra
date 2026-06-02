import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';

dotenv.config();

// Creates a CloudFront invalidation after a deploy.
//
// Hashed bundles (`/js/*.bundle.js`) NEVER need invalidation — the filename
// changes when the content does, and CloudFront caches them for a year.
// /content/* is the same in spirit: those assets are append-only and are never
// overwritten in place, so a cached object can't be stale. Invalidating the
// whole content tree every deploy just evicts good cache entries for nothing,
// so it's deliberately NOT in the default set. (If you ever do overwrite a
// content file, pass its path explicitly or use `--all`.)
//
// What's left is genuinely unhashed-and-mutable: manifest.json (the 60s atomic
// bundle pointer), the legacy fixed-path stylesheet.css, and robots.txt
// (uploaded from packages/server/public/robots.txt with a 1d cache, so we'd
// otherwise wait up to a day for robots.txt edits to take effect on a deploy).
// The `?v=${GIT_COMMIT}` query string now busts stylesheet.css on its own —
// the css cache policy keeps the query string in the cache key (see
// assets-distribution.ts cssCachePolicy) — so this invalidation is a true,
// free safety net rather than load-bearing.
//
// Distribution ID is read from CDN_DISTRIBUTION_ID, exported by the CDK stack
// and surfaced into the deploy job (or via `aws cloudformation describe-stacks`).
//
// Pass paths via argv or default to a safe set. Use `--all` to invalidate `/*`
// (rare; only when you've changed something everywhere or you're not sure).

const DEFAULT_PATHS = ['/manifest.json', '/css/stylesheet.css', '/robots.txt'];

const parseArgs = (): { distributionId: string; paths: string[] } => {
  const distributionId = process.env.CDN_DISTRIBUTION_ID;
  if (!distributionId) {
    console.error('CDN_DISTRIBUTION_ID is required');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (args.includes('--all')) {
    return { distributionId, paths: ['/*'] };
  }
  if (args.length > 0) {
    return { distributionId, paths: args };
  }
  return { distributionId, paths: DEFAULT_PATHS };
};

const main = async (): Promise<void> => {
  const { distributionId, paths } = parseArgs();
  const client = new CloudFrontClient({
    region: process.env.AWS_REGION || 'us-east-2',
    credentials: fromNodeProviderChain(),
  });
  const callerReference = `cubecobra-deploy-${Date.now()}`;

  console.log(`Invalidating ${paths.length} path(s) on distribution ${distributionId}:`);
  for (const p of paths) console.log(`  ${p}`);

  const result = await client.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: callerReference,
        Paths: { Quantity: paths.length, Items: paths },
      },
    }),
  );

  console.log(`Invalidation ${result.Invalidation?.Id} submitted (${result.Invalidation?.Status}).`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
