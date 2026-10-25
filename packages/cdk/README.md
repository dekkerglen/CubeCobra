# CubeCobra CDK

This directory contains the CubeCobra CDK code that manages our infrastructure in AWS.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template

## Bootstrapping

There are resources needed before CDK can be automated. By deploying once per environment with `--context bootstrap=true`
these resources will be created. For each new environment, run:

```bash
npx cdk diff --context environment=<environment> --context bootstrap=true

# then

npx cdk deploy --context environment=<environment> --context bootstrap=true
```

This should create all the required resources to then deploy the main stack.

## Environment flags

Per-environment settings live in [`config.ts`](./config.ts). Security-relevant flags, all off by default:

- `secretsFromSsm`: the services load their secrets at runtime from SSM SecureStrings under
  `/cubecobra/<beta|prod>/secrets/<ENV_VAR_NAME>` instead of having them synthesized into CloudFormation and passed
  through the CodeBuild environment (see [`lib/secrets.ts`](./lib/secrets.ts) for the per-service lists). Create the
  parameters first and enable it beta-then-production following
  [`packages/docs/maintenance/secrets-migration.md`](../docs/maintenance/secrets-migration.md); redeploy the pipeline
  stack (`npm run deploy:pipeline`) afterwards so that stage's build stops receiving secrets.
- `restrictAlbToCloudflare`: limit the web load balancer's ingress to Cloudflare's IP ranges (prerequisites in the
  comment in `config.ts`). It changes load balancer settings, so follow the next section when enabling it.

## Elastic Beanstalk settings and immutable deploys

The Elastic Beanstalk environments deploy with the `Immutable` policy, and every pipeline run ships a new application
version. Elastic Beanstalk refuses an immutable deployment that also changes a setting that replaces instances (such as
`DisableIMDSv1` or the instance type) or a load balancer setting (such as the listener's `SSLPolicy` or security
groups). It records "During immutable deployments, you may not deploy application and configuration changes
simultaneously" in the environment's events and keeps running the previous version, while CloudFormation still reports
the stack update as successful. Environment variables aren't affected.

So these settings stay out of the template:

- IMDSv2 only: already the Amazon Linux 2023 platform default (`DisableIMDSv1` = `true`); nothing to set.
- TLS 1.2+ on the HTTPS listener (`ELBSecurityPolicy-TLS13-1-2-2021-06`; the ELB default still allows TLS 1.0/1.1). Set
  it once on each web environment (`cubecobra-beta-v2-env`, `cubecobra-production-v2-env`). It only changes the load
  balancer listener; instances aren't restarted:

  ```bash
  aws elasticbeanstalk update-environment --region us-east-2 --environment-name cubecobra-production-v2-env \
    --option-settings Namespace=aws:elbv2:listener:443,OptionName=SSLPolicy,Value=ELBSecurityPolicy-TLS13-1-2-2021-06
  ```

To change a load balancer setting through CDK (`restrictAlbToCloudflare`), switch that environment's
`aws:elasticbeanstalk:command` `DeploymentPolicy` to `Rolling` before the pipeline run that carries the change, and back
to `Immutable` once it has deployed. After any deploy that changes environment settings, check the environment's events
rather than CloudFormation's status.

## Manual Deployment

The following environment variables must be set:

| Name                    |
| ----------------------- |
| `PATREON_CLIENT_ID`     |
| `PATREON_CLIENT_SECRET` |
| `PATREON_HOOK_SECRET`   |
| `SESSION_TOKEN`         |
| `CAPTCHA_SITE_KEY`      |
| `CAPTCHA_SECRET_KEY`    |
| `DRAFTMANCER_API_KEY`   |
| `MANAMATRIX_API_KEY`    |
| `STRIPE_SECRET_KEY`     |
| `STRIPE_PUBLIC_KEY`     |

Optional: `RECOMMENDER_SHARED_SECRET` (the pipeline reads it from SSM `/cubecobra/<beta|prod>/recommender-shared-secret`
when that parameter exists). Leave it unset to deploy with recommender authentication disabled.

For an environment with `secretsFromSsm` enabled, the secret variables above are ignored (only `PATREON_CLIENT_ID`,
`CAPTCHA_SITE_KEY`, `STRIPE_PUBLIC_KEY`, `GA_MEASUREMENT_ID` and the non-secret `R2_*`/`CARD_IMAGE_BASE_URL` values are
read).

You'll also need the app version which must match an app bundle on S3 (_v1.2.3_).

```bash
# First check the changes that will be applied by doing a diff with the live environment
npx cdk diff --context environment=<environment> --context version=<version>

# then deploy
npx cdk deploy --context environment=<environment> --context version=<version>
```

## Deploying your own environment

It's possible to use CDK to deploy your own environment with some effort. We use a combination of GitHub actions and
CDK to do so, but it's possible to do everything locally.

Do not commit any changes you make to the CDK code that is specific to your environment.

1. Add a new environment in [`config.ts`](./config.ts).
2. Build the CubeCobra application with `npm run build`
3. Upload the build to S3 using the [`publish.js`](./../scripts/publish.js) script. You'll need AWS credentials and
   an S3 bucket. Make sure to set the `CUBECOBRA_APP_BUCKET` environment variable to your S3 bucket.
4. Set the required environment variables. An up-to-date list can be found in [
   `cdk_deploy.yml`](./../.github/workflows/cdk_deploy.yml)
5. Deploy the environment with CDK:
   `npx cdk deploy --context environment=<your-environment> --context version=<version>`

- `<your-environment`> is the key you added in [`config.ts`](./config.ts).
- `<version>` is taken from [`package.json`](./../package.json)

If everything worked you should now have your own CubeCobra environment.

You can run `npx cdk deploy --context environment=<your-environment>` to destroy all cloud resources CDK created when
you no longer need your environment.

`npx cdk deploy --context environment=production --context version=1.2.3` to deploy the production environment with version 1.2.3 of the CubeCobra application.
