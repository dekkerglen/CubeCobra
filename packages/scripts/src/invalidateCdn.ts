import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';

dotenv.config();

// Creates a CloudFront invalidation after a deploy.
//
// Hashed bundles (`/js/*.bundle.js`, `*.[hash].css`) NEVER need invalidation —
// the filename changes when the content does, and CloudFront caches them
// forever. We only need to bust unhashed paths: manifest.json, /content/* (any
// images that were updated in this deploy), favicon.ico, and the legacy
// stylesheet.css path. The `?v=${GIT_COMMIT}` query string already busts
// stylesheet.css if the cache policy includes the query string in its key,
// but invalidating the path is a free safety net.
//
// Distribution ID is read from CDN_DISTRIBUTION_ID, exported by the CDK stack
// and surfaced into the deploy job (or via `aws cloudformation describe-stacks`).
//
// Pass paths via argv or default to a safe set. Use `--all` to invalidate `/*`
// (rare; only when you've changed something everywhere or you're not sure).

const DEFAULT_PATHS = ['/manifest.json', '/content/*', '/css/stylesheet.css'];

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
