import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IConstruct } from 'constructs';

/**
 * Runtime secrets from SSM Parameter Store (config.ts `secretsFromSsm`).
 *
 * With the flag on, secret values are no longer synthesized into CloudFormation (EB option
 * settings, Lambda/ECS environment) or passed through the CodeBuild environment. Each service
 * instead gets SSM_SECRETS_PREFIX and SSM_SECRET_NAMES and loads the values at startup
 * (packages/utils/src/ssmSecrets.ts). Parameters are SecureStrings named
 * `/cubecobra/<segment>/secrets/<ENV_VAR_NAME>`; a trailing `?` in a name list marks a secret the
 * service may run without. See packages/docs/maintenance/secrets-migration.md.
 */

/**
 * The SSM path segment for an environment, matching the /cubecobra/beta/... and
 * /cubecobra/prod/... parameters the deployment pipeline already reads.
 */
export const ssmSegmentFor = (environmentName: string): string =>
  environmentName === 'production' ? 'prod' : environmentName;

export const ssmSecretsPrefixFor = (environmentName: string): string =>
  `/cubecobra/${ssmSegmentFor(environmentName)}/secrets/`;

// Secret names per service, in the SSM_SECRET_NAMES format (`?` = optional).
export const WEB_SERVER_SECRET_NAMES = [
  'SESSION',
  'SESSION_PREVIOUS?',
  'RECORD_TOKEN_SECRET?',
  'PATREON_CLIENT_SECRET',
  'PATREON_HOOK_SECRET',
  'PATREON_HOOK_SECRET_PREVIOUS?',
  'CAPTCHA_SECRET_KEY',
  'GA_API_SECRET?',
  'DRAFTMANCER_API_KEY',
  'DRAFTMANCER_API_KEY_PREVIOUS?',
  'MANAMATRIX_API_KEY',
  'MANAMATRIX_API_KEY_PREVIOUS?',
  'STRIPE_SECRET_KEY?',
  'RECOMMENDER_SHARED_SECRET?',
];
// Added for the web server (and injected into the jobs task) only on stages with R2 configured.
export const R2_SECRET_NAMES = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
export const RECOMMENDER_SECRET_NAMES = ['RECOMMENDER_SHARED_SECRET?', 'RECOMMENDER_SHARED_SECRET_PREVIOUS?'];
export const DAILY_JOBS_SECRET_NAMES = ['MANAMATRIX_API_KEY'];
export const BOT_DECKBUILD_SECRET_NAMES = ['RECOMMENDER_SHARED_SECRET?'];

export interface SsmSecrets {
  /** e.g. /cubecobra/prod/secrets/ */
  prefix: string;
  /** SSM_SECRET_NAMES entries; a trailing `?` marks an optional secret. */
  names: string[];
}

export const secretName = (entry: string): string => entry.replace(/\?$/, '');

/** The plain environment variables that tell the runtime loader what to fetch. */
export const ssmSecretsEnvironment = (secrets: SsmSecrets): { [key: string]: string } => ({
  SSM_SECRETS_PREFIX: secrets.prefix,
  SSM_SECRET_NAMES: secrets.names.join(','),
});

export const secretParameterArn = (scope: IConstruct, prefix: string, name: string): string => {
  const stack = cdk.Stack.of(scope);
  return `arn:aws:ssm:${stack.region}:${stack.account}:parameter${prefix}${secretName(name)}`;
};

/**
 * Lets `grantee` read exactly the listed parameters (optional ones included, since the loader
 * asks for them in the same GetParameters call). No kms:Decrypt grant: the SecureStrings use the
 * AWS-managed aws/ssm key, whose key policy already allows decryption through SSM for principals
 * in the account. Parameters encrypted with a customer-managed key would also need kms:Decrypt on
 * that key.
 */
export const grantReadSecrets = (grantee: iam.IGrantable, scope: IConstruct, secrets: SsmSecrets): void => {
  grantee.grantPrincipal.addToPrincipalPolicy(
    new iam.PolicyStatement({
      actions: ['ssm:GetParameters'],
      resources: secrets.names.map((name) => secretParameterArn(scope, secrets.prefix, name)),
    }),
  );
};
