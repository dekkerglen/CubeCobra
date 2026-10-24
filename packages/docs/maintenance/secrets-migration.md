# Secrets Migration Runbook: SSM Parameter Store at Runtime

This runbook moves CubeCobra's application secrets out of deployment configuration and into SSM Parameter Store, where each service reads them at startup. It then rotates every secret.

## Background

**Before:**

- Secrets live in SSM under `/cubecobra/<seg>/<kebab-name>`.
- CodeBuild reads them into the build environment during `cdk deploy`.
- CDK writes the values into:
  - Elastic Beanstalk option settings;
  - Lambda environment variables;
  - the ECS task definition.
- Anyone with read access to CloudFormation templates, the Elastic Beanstalk configuration, Lambda configuration or CodeBuild can see them. So can any dependency that runs during the build.

**After:**

- Secrets live as SecureStrings under `/cubecobra/<seg>/secrets/<ENV_VAR_NAME>`. The parameter name is the environment variable name.
- Deployed configuration only carries two plain variables:
  - `SSM_SECRETS_PREFIX`, e.g. `/cubecobra/prod/secrets/`;
  - `SSM_SECRET_NAMES`, e.g. `SESSION,SESSION_PREVIOUS?,PATREON_HOOK_SECRET`. A trailing `?` marks an optional secret.
- Each service loads its secrets at startup. The code is in `packages/utils/src/ssmSecrets.ts`; it is called from the `server.js` files and the Lambda handlers.
  - A missing required secret, or an SSM error, stops the service from starting, so a bad deploy rolls back.
- The ECS jobs task gets its R2 keys through native ECS `secrets` injection.
- The bot-deckbuild Lambda runs in VPC subnets with no internet route.
  - With the flag on, CDK gives it its own SSM interface endpoint, reachable only from that Lambda, and points the SDK at it with `AWS_ENDPOINT_URL_SSM`.
  - This costs roughly **$22/month per environment** (one endpoint across three availability zones), and nothing while the flag is off.
  - The web server and recommender sit in public subnets and reach SSM directly.
- The build no longer sees application secrets. One exception: the static-asset upload step still needs R2 write credentials.
  - It reads them from the old `/cubecobra/<seg>/r2-access-key-id` and `r2-secret-access-key` parameters, inside a subshell that runs only that upload.
  - They never reach `npm ci`, the package builds, `cdk deploy` or any template.
  - Follow-up: issue a separate, upload-only R2 token for this step.

The switch is per environment: `secretsFromSsm` in `packages/cdk/config.ts`. With the flag off, the old flow is unchanged. That makes every step below reversible until Phase 6.

`<seg>` is `beta` for beta and `prod` for production. These are the same path segments the existing parameters use.

## Inventory

### Secrets that move

| Env var                                    | Old parameter (`/cubecobra/<seg>/…`)       | Read by                                       | How to rotate                                                                      |
| ------------------------------------------ | ------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `SESSION`                                  | `session-token`                            | web server                                    | Generate; overlap with `SESSION_PREVIOUS`                                          |
| `PATREON_CLIENT_SECRET`                    | `patreon-client-secret`                    | web server                                    | Regenerate in the Patreon developer portal                                         |
| `PATREON_HOOK_SECRET`                      | `patreon-hook-secret`                      | web server                                    | Regenerate in the Patreon portal; overlap with `PATREON_HOOK_SECRET_PREVIOUS`      |
| `CAPTCHA_SECRET_KEY`                       | `captcha-secret-key`                       | web server                                    | New key pair in the reCAPTCHA admin console                                        |
| `GA_API_SECRET`                            | `ga-api-secret` (prod only)                | web server                                    | Create a new Measurement Protocol secret, then delete the old one                  |
| `DRAFTMANCER_API_KEY`                      | `draftmancer-api-key`                      | web server (Draftmancer sends it)             | Generate; overlap with `DRAFTMANCER_API_KEY_PREVIOUS`; coordinate with Draftmancer |
| `MANAMATRIX_API_KEY`                       | `manamatrix-api-key`                       | web server, daily-jobs Lambda                 | Generate; overlap with `MANAMATRIX_API_KEY_PREVIOUS`                               |
| `STRIPE_SECRET_KEY`                        | `stripe-secret-key`                        | web server (merchandise, currently unused)    | "Roll key" in the Stripe dashboard, or delete it                                   |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | `r2-access-key-id`, `r2-secret-access-key` | web server, ECS jobs                          | New Cloudflare R2 API token, then revoke the old one                               |
| `RECOMMENDER_SHARED_SECRET`                | _(new)_                                    | web server, recommender, bot-deckbuild Lambda | Generate; overlap with `RECOMMENDER_SHARED_SECRET_PREVIOUS`                        |
| `RECORD_TOKEN_SECRET`                      | _(new, optional)_                          | web server                                    | See the `SESSION` rotation step                                                    |

### Stay where they are (not secret)

These are read at deploy time, unchanged:

- `stripe-public-key`
- `patreon-client-id`
- `captcha-site-key`
- `ga-measurement-id`
- `r2-endpoint`
- `r2-bucket`
- `card-image-base-url`

### Retired

`session-secret` (`SESSION_SECRET`) and `jobs-token` (`JOBS_TOKEN`) were deployed, but nothing reads them. Delete them in Phase 6.

### Which service loads what

Set by CDK when `secretsFromSsm` is on:

- **Web server (EB):**
  - required: `SESSION`, `PATREON_CLIENT_SECRET`, `PATREON_HOOK_SECRET`, `CAPTCHA_SECRET_KEY`, `DRAFTMANCER_API_KEY`, `MANAMATRIX_API_KEY`;
  - required when R2 is configured: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`;
  - optional: `GA_API_SECRET`, `STRIPE_SECRET_KEY`, `RECOMMENDER_SHARED_SECRET`, `RECORD_TOKEN_SECRET`, and every `*_PREVIOUS`.
- **Recommender (EB):** `RECOMMENDER_SHARED_SECRET?`, `RECOMMENDER_SHARED_SECRET_PREVIOUS?`.
- **Daily-jobs Lambda:** `MANAMATRIX_API_KEY`.
- **Bot-deckbuild Lambda:** `RECOMMENDER_SHARED_SECRET?`.
- **Card-update-monitor Lambda:** none.
- **ECS jobs task:** `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, injected by ECS when R2 is configured.

## Before you start

- **Tools:** AWS CLI v2 configured for account `816705121310`, region `us-east-2`. You need:
  - `ssm:GetParameter`, `ssm:PutParameter`, `ssm:DeleteParameter` and `ssm:DescribeParameters` on `/cubecobra/*`;
  - `elasticbeanstalk:RestartAppServer` and `elasticbeanstalk:DescribeConfigurationSettings`;
  - `lambda:UpdateFunctionConfiguration`;
  - `cloudformation:GetTemplate`.
- **Keep values out of your terminal and shell history.** The commands below keep every secret in a shell variable and never echo it. Before starting, run:
  ```bash
  set +o history
  ```
- **Names you'll need:**
  ```bash
  aws elasticbeanstalk describe-environments --query 'Environments[].[EnvironmentName,CNAME]' --output table
  aws lambda list-functions --query 'Functions[].FunctionName' --output text | tr '\t' '\n' | grep -i -E 'daily|deckbuild|monitor'
  ```
- **The branch is deployed:** the `security-hardening` changes (runtime loader, `secretsFromSsm` flag, every flag `false`) have gone through the pipeline to beta and prod. With the flags off this changes nothing at runtime.
- **Helpers used throughout.** Paste these into the shell you'll use:
  ```bash
  # Copy an old parameter's value into the new SecureString path without printing it.
  copy_secret() { # copy_secret <seg> <ENV_NAME> <old-kebab-name>
    local value
    value=$(aws ssm get-parameter --name "/cubecobra/$1/$3" --with-decryption --query Parameter.Value --output text) || return 1
    aws ssm put-parameter --name "/cubecobra/$1/secrets/$2" --type SecureString --value "$value" --overwrite >/dev/null && echo "copied $2"
  }
  # Store a value (read silently from the terminal, or from $NEW_VALUE) as a SecureString.
  put_secret() { # put_secret <seg> <ENV_NAME>
    local value="${NEW_VALUE:-}"
    [ -n "$value" ] || { read -rsp "value for $2: " value; echo; }
    aws ssm put-parameter --name "/cubecobra/$1/secrets/$2" --type SecureString --value "$value" --overwrite >/dev/null && echo "stored $2"
  }
  new_random() { openssl rand -base64 48 | tr -d '\n/+=' ; }
  # Count occurrences of a secret value in a stack's deployed template (expect 0 after migration).
  template_contains() { # template_contains <stack> <seg> <ENV_NAME>
    local value; value=$(aws ssm get-parameter --name "/cubecobra/$2/secrets/$3" --with-decryption --query Parameter.Value --output text)
    aws cloudformation get-template --stack-name "$1" --query TemplateBody --output text | grep -c -F -- "$value"
  }
  ```

## Phase 1: Create the new parameters for beta

Copy the **current** values first. Rotation comes later (Phase 5). That keeps the migration and the rotation independently reversible.

```bash
SEG=beta
copy_secret $SEG SESSION                session-token
copy_secret $SEG PATREON_CLIENT_SECRET  patreon-client-secret
copy_secret $SEG PATREON_HOOK_SECRET    patreon-hook-secret
copy_secret $SEG CAPTCHA_SECRET_KEY     captcha-secret-key
copy_secret $SEG DRAFTMANCER_API_KEY    draftmancer-api-key
copy_secret $SEG MANAMATRIX_API_KEY     manamatrix-api-key
copy_secret $SEG STRIPE_SECRET_KEY      stripe-secret-key
copy_secret $SEG R2_ACCESS_KEY_ID       r2-access-key-id
copy_secret $SEG R2_SECRET_ACCESS_KEY   r2-secret-access-key
# prod only: copy_secret prod GA_API_SECRET ga-api-secret
```

Things to know:

- **Don't create `RECOMMENDER_SHARED_SECRET` yet.** It is introduced in Phase 5 in a specific restart order.
- **Required names must exist in every environment**, even where the feature is unused on beta: `SESSION`, `PATREON_CLIENT_SECRET`, `PATREON_HOOK_SECRET`, `CAPTCHA_SECRET_KEY`, `DRAFTMANCER_API_KEY`, `MANAMATRIX_API_KEY`, plus the R2 pair where R2 is configured. Copy whatever the old parameter holds; a placeholder is fine. A missing required name stops the service from starting.
- **Optional names** (`STRIPE_SECRET_KEY`, `GA_API_SECRET`): skip them where the old value is a placeholder.
- **Check what exists** (names and types only, no values):
  ```bash
  aws ssm describe-parameters --parameter-filters Key=Name,Option=BeginsWith,Values=/cubecobra/$SEG/secrets/ \
    --query 'Parameters[].[Name,Type]' --output table
  ```
  Every entry must be `SecureString`.

## Phase 2: Switch beta to runtime secrets

1. In `packages/cdk/config.ts`, set `secretsFromSsm: true` for `beta` only. Merge to `master`.
2. The pipeline deploys beta, runs the integration tests, then deploys prod. Prod is unaffected because its flag is still off.
3. **Verify on beta:**
   - **The web server and recommender started.** Each instance logs one line from `server.js`, for example `Loaded 9 secret(s) from SSM; optional and absent: …`. Check the EB environment's `web.stdout.log` or the CloudWatch log group.
   - **No secret values are left in the deployed configuration:**
     ```bash
     for name in SESSION PATREON_HOOK_SECRET CAPTCHA_SECRET_KEY DRAFTMANCER_API_KEY MANAMATRIX_API_KEY; do
       printf '%s in template: ' $name; template_contains CubeCobraBetaStack beta $name
     done
     aws elasticbeanstalk describe-configuration-settings --application-name <app> --environment-name <beta-web-env> \
       --query 'ConfigurationSettings[0].OptionSettings[?Namespace==`aws:elasticbeanstalk:application:environment`].OptionName' --output text
     ```
     Every count should be `0`, and the option names should show `SSM_SECRETS_PREFIX` and `SSM_SECRET_NAMES` instead of the secret names.
   - **Smoke test:**
     - Log in and out (`SESSION`).
     - Start a Patreon link if beta has a Patreon app (`PATREON_CLIENT_SECRET`).
     - Run a bot deckbuild (recommender path).
     - Upload a hosted image if R2 is configured.
   - **The daily-jobs Lambda can authenticate.** It rotates the beta daily puzzles, which is harmless on beta:
     ```bash
     aws lambda invoke --function-name <beta-daily-jobs-fn> --payload '{"skipWeekly":true}' --cli-binary-format raw-in-base64-out /dev/stdout
     ```
   - **The ECS jobs task starts**, if R2 is configured. Run one card-update task, or wait for the monitor's next run, and confirm it reaches RUNNING. A missing parameter fails before the container starts, with `ResourceInitializationError`.

**Rollback:** set the flag back to `false` and merge. The old parameters and the build-time flow are untouched.

## Phase 3: Production

Repeat Phases 1 and 2 with `SEG=prod`, including `GA_API_SECRET`, and with stack `CubeCobraProdStack`. Pick a quiet period. The deploy is immutable: if the new instances can't load their secrets they never pass health checks, and Elastic Beanstalk keeps the old ones.

**Rollback:** same as beta.

## Phase 4: Remove secrets from the build

Once both environments have `secretsFromSsm: true`, redeploy the pipeline stack. That stack isn't updated by the pipeline itself.

```bash
cd packages/cdk && npm run deploy:pipeline
```

For flagged stages, the build projects then:

- drop every secret environment variable;
- lose read access to anything except the non-secret parameters listed in the Inventory.

**Verify:**

- The next pipeline run deploys beta and prod normally.
- The build projects carry no secret variables:
  ```bash
  aws codebuild batch-get-projects --names <beta-deploy-project> <prod-deploy-project> \
    --query 'projects[].environment.environmentVariables[].name' --output text
  ```

**Rolling back a flag after this point.** The order matters:

1. Run `npm run deploy:pipeline` from a checkout where that environment's flag is `false`. This restores the secrets to its build.
2. Then merge the flag change.

Merged the other way round, the next deploy would synthesize empty secrets.

## Phase 5: Rotation

Every value has been stored in plaintext in CloudFormation templates, Elastic Beanstalk configuration and the CodeBuild environment. The Draftmancer and ManaMatrix keys were also written to request logs. Treat all of them as exposed. Rotate the Draftmancer and ManaMatrix keys first.

### How a running service picks up a new value

Secrets load once, at startup.

| Service                   | Command                                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web server or recommender | `aws elasticbeanstalk restart-app-server --environment-name <env>` restarts the app process, which reloads from SSM. It takes a few seconds per instance and doesn't replace instances.  |
| Lambda                    | Recycle its execution environments with any configuration change:<br>`aws lambda update-function-configuration --function-name <fn> --description "secrets reloaded $(date -u +%FT%TZ)"` |
| ECS jobs                  | Every task launch reads the current value; nothing to do.                                                                                                                                |

### The overlap pattern

For secrets that callers send to us, the server accepts `<NAME>` or `<NAME>_PREVIOUS`, so a key can change without rejecting requests:

1. `NEW_VALUE=$(new_random)`. Store the current value as `<NAME>_PREVIOUS`, then the new value as `<NAME>`.
2. Restart the side that **checks** the key, so it accepts both.
3. Move the **callers** to the new value.
4. Delete `<NAME>_PREVIOUS`, then restart the checking side again.

To copy the current value into `_PREVIOUS`, use the same "copy without printing" approach:

```bash
copy_current_to_previous() { # copy_current_to_previous <seg> <ENV_NAME>
  local value; value=$(aws ssm get-parameter --name "/cubecobra/$1/secrets/$2" --with-decryption --query Parameter.Value --output text) || return 1
  aws ssm put-parameter --name "/cubecobra/$1/secrets/$2_PREVIOUS" --type SecureString --value "$value" --overwrite >/dev/null && echo "saved $2_PREVIOUS"
}
```

### `MANAMATRIX_API_KEY`

The daily-jobs Lambda (caller) sends this key to the web server (checker).

```bash
copy_current_to_previous $SEG MANAMATRIX_API_KEY
NEW_VALUE=$(new_random) put_secret $SEG MANAMATRIX_API_KEY
aws elasticbeanstalk restart-app-server --environment-name <web-env>        # accepts old + new
aws lambda update-function-configuration --function-name <daily-jobs-fn> --description "secrets reloaded $(date -u +%FT%TZ)"
# verify: the next daily run (or a manual invoke on beta) gets 200 from /tool/api/*/rotate
aws ssm delete-parameter --name /cubecobra/$SEG/secrets/MANAMATRIX_API_KEY_PREVIOUS
aws elasticbeanstalk restart-app-server --environment-name <web-env>
```

### `DRAFTMANCER_API_KEY`

Draftmancer's server is the caller.

1. `copy_current_to_previous $SEG DRAFTMANCER_API_KEY`, then `NEW_VALUE=$(new_random) put_secret $SEG DRAFTMANCER_API_KEY`, then restart the web server.
2. Send the new key to the Draftmancer maintainer over a private channel (not GitHub or Discord in the clear). Retrieve it with `aws ssm get-parameter --with-decryption` in a terminal you're not sharing.
3. Once they've deployed it and a draft published from Draftmancer shows up on Cube Cobra, delete `DRAFTMANCER_API_KEY_PREVIOUS` and restart the web server.

### `RECOMMENDER_SHARED_SECRET` (first provisioning)

The recommender only enforces the secret once it has one, and callers only send it once they have it. So the callers must restart before the recommender:

```bash
NEW_VALUE=$(new_random) put_secret $SEG RECOMMENDER_SHARED_SECRET
aws elasticbeanstalk restart-app-server --environment-name <web-env>          # starts sending X-Internal-Token
aws lambda update-function-configuration --function-name <bot-deckbuild-fn> --description "secrets reloaded $(date -u +%FT%TZ)"
aws elasticbeanstalk restart-app-server --environment-name <recommender-env>  # starts requiring it
```

**Verify:**

- Draft bots pick and bot deckbuilds complete.
- The recommender logs show no `401`s.

**Rotating it later** reverses the order. The recommender checks; the web server and Lambda call.

1. `copy_current_to_previous`, store the new value, restart the **recommender** (accepts both).
2. Restart the web server and recycle the bot-deckbuild Lambda.
3. Delete `RECOMMENDER_SHARED_SECRET_PREVIOUS` and restart the recommender.

### `SESSION` and record share links

Express signs session cookies with `SESSION`. `SESSION_PREVIOUS` still verifies cookies signed before the rotation, so nobody is logged out.

1. **Decide what happens to record share links first.** Record "contribute" links are signed with `RECORD_TOKEN_SECRET`, or with `SESSION` when that isn't set.
   - **Recommended: revoke them.** The current `SESSION` value has been exposed, so links signed with it should be considered forgeable. `NEW_VALUE=$(new_random) put_secret $SEG RECORD_TOKEN_SECRET`. Record owners will need to copy a fresh link from the record page.
   - **Or keep them:** copy the current `SESSION` value into `RECORD_TOKEN_SECRET`, the same way `copy_current_to_previous` does.
2. Rotate `SESSION`:
   ```bash
   copy_current_to_previous $SEG SESSION
   NEW_VALUE=$(new_random) put_secret $SEG SESSION
   aws elasticbeanstalk restart-app-server --environment-name <web-env>
   ```
   Verify that an existing logged-in browser stays logged in and that a fresh login works.
3. **About 31 days later**, once session cookies signed with the old value have expired (cookie lifetime is 30 days), delete `SESSION_PREVIOUS` and restart.
   - Alternatively, skip `SESSION_PREVIOUS` entirely to sign everyone out immediately.
   - Keeping the old secret for the overlap is low risk: knowing it lets someone sign a cookie, but they still need a real session ID to use it.

### `PATREON_HOOK_SECRET`

Patreon signs webhooks with whatever secret its portal currently shows.

1. `copy_current_to_previous $SEG PATREON_HOOK_SECRET`.
2. In the Patreon developer portal → your client → Webhooks, regenerate the secret and copy it.
3. Store it with `put_secret $SEG PATREON_HOOK_SECRET` (paste at the silent prompt), then restart the web server.
   - Hooks delivered between steps 2 and 3 fail with 401. Check the portal's delivery log and resend them.
4. Delete `PATREON_HOOK_SECRET_PREVIOUS` and restart.

### `PATREON_CLIENT_SECRET`

1. Regenerate the client secret in the Patreon portal.
2. `put_secret $SEG PATREON_CLIENT_SECRET`, then restart the web server.
3. Patreon linking fails only for the minute in between.

### `CAPTCHA_SECRET_KEY` (and the site key)

reCAPTCHA secrets can't be regenerated, so you create a new key pair.

1. In the reCAPTCHA admin console, create a v2 "I'm not a robot" key for the same domains.
2. Update the non-secret site key at the old path:
   ```bash
   aws ssm put-parameter --name /cubecobra/$SEG/captcha-site-key --value <new-site-key> --overwrite
   ```
3. Store the secret with `put_secret $SEG CAPTCHA_SECRET_KEY`.
4. **Trigger a pipeline run** (re-run the latest execution). The site key is read at deploy time, so a restart alone would leave the old site key paired with the new secret.
5. Verify registration and cube creation on beta, then delete the old reCAPTCHA key.

### `GA_API_SECRET` (prod)

1. GA4 Admin → Data streams → your stream → Measurement Protocol API secrets → Create.
2. `put_secret prod GA_API_SECRET`, then restart the web server.
3. Delete the old API secret in GA.

### `STRIPE_SECRET_KEY`

The merchandise store is disabled (it has no products).

- **Simplest:** delete the key in Stripe and the parameter here. The name is optional, so the web server is fine without it.
- **If the key must stay:** in the Stripe dashboard → Developers → API keys → Roll key, with a short expiration on the old key. Then `put_secret`, then restart.

### `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`

Two copies exist. The runtime copy at `/secrets/R2_*` is used by the web server and ECS jobs. The deploy-time copy at the old `r2-access-key-id` / `r2-secret-access-key` path is used only by the pipeline's asset upload.

1. Cloudflare dashboard → R2 → Manage API tokens → create a token with the same permissions as the current one (Object Read & Write on the same buckets).
2. Store both values with `put_secret` under `/secrets/`, then restart the web server.
3. Update the asset-upload copy at the old path:
   - **Better:** create a second, upload-only token scoped to the asset bucket and store that at the old path.
   - **Or:** store the same new token there.
   ```bash
   read -rsp 'access key id: ' v; echo; aws ssm put-parameter --name /cubecobra/$SEG/r2-access-key-id --type SecureString --value "$v" --overwrite >/dev/null
   read -rsp 'secret access key: ' v; echo; aws ssm put-parameter --name /cubecobra/$SEG/r2-secret-access-key --type SecureString --value "$v" --overwrite >/dev/null; unset v
   ```
4. Confirm:
   - a hosted-image upload works;
   - the next ECS jobs run (for example `sync_card_images`) succeeds;
   - the next pipeline run's asset upload succeeds.
5. Revoke the old token in Cloudflare.

## Phase 6: Cleanup

Wait at least two weeks after Phase 4. Deleting the old parameters ends the possibility of rolling a flag back.

```bash
for SEG in beta prod; do
  for old in session-token session-secret jobs-token patreon-client-secret patreon-hook-secret captcha-secret-key \
             ga-api-secret draftmancer-api-key manamatrix-api-key stripe-secret-key \
             recommender-shared-secret; do
    aws ssm delete-parameter --name "/cubecobra/$SEG/$old" 2>/dev/null && echo "deleted /cubecobra/$SEG/$old"
  done
done
```

Keep:

- the non-secret parameters listed in the Inventory;
- `r2-access-key-id` and `r2-secret-access-key`. The pipeline's asset upload still reads these until it gets its own token or project.

**Old copies of the values outside SSM.** Phase 5 made them worthless, but you can tidy up:

- Old CloudFormation template versions and Elastic Beanstalk saved configurations: rotation already took care of these.
- Objects written to the pipeline artifact bucket before Phase 4: optional to delete.
- Request logs that recorded API keys before log redaction shipped: let retention expire them.

**Finally:**

- Remove the now-dead flag-off branches from the CDK code (the `secretsFromSsm: false` path, and the secret parameters in the pipeline).
- Delete the old-path `recommender-shared-secret` handling.

## Local development

Nothing changes. Without `SSM_SECRETS_PREFIX` the loader does nothing, and secrets come from `packages/server/.env` as before.

## Troubleshooting

| Symptom                                                                                             | Likely cause                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EB deploy rolls back; the log shows `Required secrets not found under /cubecobra/<seg>/secrets/: X` | A required parameter wasn't created (Phase 1), or its name is misspelled. Names are case-sensitive and must match the environment variable exactly.                                                                                               |
| `AccessDeniedException` from SSM at startup                                                         | The instance or Lambda role is missing the grant. This happens if the flag was flipped by hand rather than through CDK, or the parameter sits outside `/cubecobra/<seg>/secrets/`.                                                                |
| `ParameterNotFound` in a Lambda log                                                                 | Same as above, for the Lambda's own list.                                                                                                                                                                                                         |
| ECS task stops with `ResourceInitializationError: unable to pull secrets`                           | A missing R2 parameter, or the execution role lacks the grant.                                                                                                                                                                                    |
| Draft bots fail and the recommender returns 401                                                     | The recommender has a `RECOMMENDER_SHARED_SECRET` that the caller didn't load. Restart the web server and recycle the bot-deckbuild Lambda, or temporarily set the old value as `RECOMMENDER_SHARED_SECRET_PREVIOUS` and restart the recommender. |
| Everyone was logged out after a `SESSION` rotation                                                  | `SESSION_PREVIOUS` wasn't set before the restart. Nothing to fix; people sign in again.                                                                                                                                                           |
| "Refusing to start: required secret(s) not set: SESSION"                                            | The loader ran but `SESSION` is empty. Check that the parameter's value isn't blank.                                                                                                                                                              |
