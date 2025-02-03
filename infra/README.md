# CubeCobra CDK

This directory contains the CubeCobra CDK code that manages our infrastructure in AWS.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Bootstrapping

There are resources needed before CDK can be automated. By deploying once per environment with `--context bootstrap=true`
these resources will be created. For each new environment, run:

```bash
npx cdk diff --context environment=<environment> --context bootstrap=true

# then

npx cdk deploy --context environment=<environment> --context bootstrap=true
```

This should create all the required resources to then deploy the main stack.

## Manual Deployment

The following environment variables must be set:

| Name                     |
|--------------------------|
| `EMAIL_USER`             |
| `EMAIL_PASS`             |
| `JOBS_TOKEN`             |
| `PATREON_CLIENT_ID`      |
| `PATREON_CLIENT_SECRET`  |
| `PATREON_HOOK_SECRET`    |
| `SESSION_TOKEN`          |
| `SESSION_SECRET`         |
| `TCG_PLAYER_PUBLIC_KEY`  |
| `TCG_PLAYER_PRIVATE_KEY` |
| `CAPTCHA_SITE_KEY`       |
| `CAPTCHA_SECRET_KEY`     |
| `DRAFTMANCER_API_KEY`    |
| `STRIPE_SECRET_KEY`      |
| `STRIPE_PUBLIC_KEY`      |

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

* `<your-environment`> is the key you added in [`config.ts`](./config.ts).
* `<version>` is taken from [`package.json`](./../package.json)

If everything worked you should now have your own CubeCobra environment.

You can run `npx cdk deploy --context environment=<your-environment>` to destroy all cloud resources CDK created when
you no longer need your environment.