import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

/**
 * Loads application secrets from SSM Parameter Store into process.env at startup.
 *
 * Deployed services no longer receive secret values in their Elastic Beanstalk / Lambda
 * configuration (where anyone with read access to CloudFormation or the service config could
 * see them). Instead the infrastructure sets two plain variables:
 *
 *   SSM_SECRETS_PREFIX  e.g. /cubecobra/prod/secrets/
 *   SSM_SECRET_NAMES    e.g. SESSION,SESSION_PREVIOUS?,PATREON_HOOK_SECRET
 *
 * Each name is both the parameter name under the prefix and the environment variable it
 * fills. A trailing `?` marks an optional secret: if the parameter doesn't exist it is skipped.
 * A missing required secret, or any SSM error, rejects — the service should refuse to start
 * rather than run without its secrets. When the prefix isn't set (local development), this is
 * a no-op and secrets come from .env as before.
 *
 * See packages/docs/maintenance/secrets-migration.md.
 */

// GetParameters accepts at most 10 names per call.
const BATCH_SIZE = 10;

export interface SecretName {
  name: string;
  optional: boolean;
}

export const parseSecretNames = (raw: string | undefined): SecretName[] =>
  (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => ({ name: entry.replace(/\?$/, ''), optional: entry.endsWith('?') }));

export interface LoadSecretsOptions {
  prefix?: string;
  names?: SecretName[];
  env?: NodeJS.ProcessEnv;
  client?: Pick<SSMClient, 'send'>;
}

export interface LoadSecretsResult {
  loaded: string[];
  skipped: string[];
}

export const loadSecretsFromSsm = async (options: LoadSecretsOptions = {}): Promise<LoadSecretsResult> => {
  const env = options.env ?? process.env;
  const rawPrefix = options.prefix ?? env.SSM_SECRETS_PREFIX;
  const names = options.names ?? parseSecretNames(env.SSM_SECRET_NAMES);

  if (!rawPrefix || names.length === 0) {
    return { loaded: [], skipped: [] };
  }

  const prefix = rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`;
  const client = options.client ?? new SSMClient({ region: env.AWS_REGION || env.AWS_DEFAULT_REGION });

  const loaded: string[] = [];
  const missing: SecretName[] = [];

  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const batch = names.slice(i, i + BATCH_SIZE);
    const response = await client.send(
      new GetParametersCommand({ Names: batch.map(({ name }) => `${prefix}${name}`), WithDecryption: true }),
    );

    const found = new Map((response.Parameters ?? []).map((parameter) => [parameter.Name, parameter.Value ?? '']));
    for (const secret of batch) {
      const value = found.get(`${prefix}${secret.name}`);
      if (value === undefined) {
        missing.push(secret);
      } else {
        env[secret.name] = value;
        loaded.push(secret.name);
      }
    }
  }

  const missingRequired = missing.filter((secret) => !secret.optional).map((secret) => secret.name);
  if (missingRequired.length > 0) {
    throw new Error(`Required secrets not found under ${prefix}: ${missingRequired.join(', ')}`);
  }

  return { loaded, skipped: missing.map((secret) => secret.name) };
};

let pending: Promise<LoadSecretsResult> | undefined;

/** Loads secrets once per process (for Lambda handlers, which run many times per cold start). */
export const loadSecretsOnce = (): Promise<LoadSecretsResult> => {
  if (!pending) {
    pending = loadSecretsFromSsm().catch((err) => {
      // Let the next invocation retry instead of caching the failure for the container's life.
      pending = undefined;
      throw err;
    });
  }
  return pending;
};
