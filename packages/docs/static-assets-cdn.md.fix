# Static Assets via S3 + CloudFront

Plan and reference pattern for serving CubeCobra's static assets (images, CSS, JS bundles) from S3 through CloudFront instead of from the Express server on Elastic Beanstalk.

## 1. Today's setup (what we're moving away from)

Everything we serve as a static asset is fronted by `express.static()` in `packages/server/src/index.ts`:

- `/js/*` → `packages/server/public/js/` — page bundles + `vendors` + `commons`. Webpack emits `[name].[contenthash:8].bundle.js` to `packages/client/dist/js/`, then `packages/client/generate-manifest.js` copies the JS into `packages/server/public/js/` and writes a name→hashed-path map to `packages/server/public/manifest.json`. Cache headers: `immutable, max-age=1y` in prod.
- `/css/*` → `packages/server/public/css/` — `stylesheet.css` (Tailwind output, written by `packages/client` build), plus three legacy hand-written sheets (`autocomplete.css`, `editcube.css`, `tags.css`). Cache: 1d, with cache-busting via `?v=${GIT_COMMIT}` in `main.pug`.
- `/content/*` → `packages/server/public/content/` — ~8.4 MB of PNGs/ICO/SVG plus a `symbols/` directory with ~100 mana/cost glyphs. Checked into git. Cache: 1d.

URL emission today:

- Server: `packages/server/src/views/main.pug` references `/css/...`, `/content/favicon.ico`, plus injects per-page `<script src="/js/...">` from `getBundlesForPage()` in `packages/server/src/serverutils/render.ts` (which reads `manifest.json`).
- Client: ~30 components hard-code `/content/...` paths (see `Markdown.tsx`, `ColorCheck.tsx`, `CardImage.tsx`, etc.).
- Email Pug templates (`packages/server/src/emails/*/html.pug`) also reference `/content/...` images.

Critical gotcha — **the `/content/` prefix is overloaded**. It's both static images (`/content/foo.png`) and a dynamic route namespace (`/content/articles`, `/content/podcast/:id`, `/content/browse`, ...). Putting CloudFront in front of `cubecobra.com/content/*` would either break the dynamic routes or require precise path-based rules. The cleanest fix is a **dedicated asset hostname**.

## 2. Target architecture

```
                           ┌──────────────────────┐
  cubecobra.com  ─ ALB ─▶  │ Elastic Beanstalk    │  (HTML, API, /content/* dynamic)
                           │   express server     │
                           └──────────────────────┘
                                      │
                                      │ render.ts injects <script src="https://assets.cubecobra.com/js/...">
                                      ▼
  assets.cubecobra.com ─ CloudFront ──▶ S3 bucket: cubecobra-assets-prod
                                            ├── js/<hash>.bundle.js   immutable
                                            ├── css/stylesheet.<hash>.css
                                            └── content/...           images
```

### Components

| Piece        | Choice                                                                                                                                                                                                     | Why                                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Bucket       | One per stage: `cubecobra-assets-{dev,beta,prod}`, private, OAC-only access from CloudFront.                                                                                                               | Per-stage isolation matches existing `dataBucket`/`appBucket` pattern in `packages/cdk/config.ts`.                            |
| Distribution | One per stage, custom domain `assets.cubecobra.com` (and `assets.cubecobradev.com`), ACM cert in us-east-1, HTTP/2+HTTP/3, Brotli + gzip.                                                                  | Distinct hostname avoids the `/content/*` namespace collision and lets us set permissive caching without touching app routes. |
| Origin       | S3 with Origin Access Control.                                                                                                                                                                             | Bucket stays private; only CloudFront can read.                                                                               |
| Cache policy | Hashed paths (`*.[hash].bundle.js`, `*.[hash].css`) → `Cache-Control: public, max-age=31536000, immutable`. Unhashed paths (`/content/*`, manifest, ico) → `max-age=86400, stale-while-revalidate=604800`. | Hashed = safe forever; unhashed = day-level staleness is fine, SWR keeps it warm.                                             |
| CORS         | Allow `cubecobra.com`/`cubecobradev.com` for fonts/JS modules.                                                                                                                                             | Otherwise font + module loading may fail under strict CORS.                                                                   |
| Layout       | Flat content-addressed: never overwrite a hashed filename, just put new ones alongside. Old replicas keep working during a rolling deploy. Lifecycle rule: expire objects untouched for 90 days.           | No coordination needed between deploy and EB rollover.                                                                        |

### Server-side URL helper

Add a single helper that all server (Pug) and client (React) code goes through:

```ts
// packages/utils/src/cdnUrl.ts
const base = process.env.CDN_BASE_URL ?? '';
export const cdnUrl = (path: string) => `${base}${path.startsWith('/') ? path : `/${path}`}`;
```

- In dev `CDN_BASE_URL` is unset → `cdnUrl('/content/logo.png') === '/content/logo.png'` and Express serves it as today.
- In prod `CDN_BASE_URL=https://assets.cubecobra.com` → emits absolute CloudFront URLs.

For React, the value is injected via `reactProps.cdnBaseUrl` (already the pattern for `baseUrl` and `captchaSiteKey` in `render.ts`) and read from a tiny client wrapper. That avoids baking the URL into the bundle, which lets the same artifact be reused across environments.

`render.ts:getBundlesForPage()` keeps doing exactly what it does, just wrapped:

```ts
const vendors = cdnUrl(manifest['vendors'] || '/js/vendors.bundle.js');
const commons = cdnUrl(manifest['commons'] || '/js/commons.bundle.js');
const pageBundleName = cdnUrl(manifest[page] || `/js/${page}.bundle.js`);
```

`main.pug` becomes:

```pug
link(rel='icon', href=cdnUrl('/content/favicon.ico?v=1.1'), type='image/x-icon')
link(rel='stylesheet' href=cdnUrl('/css/autocomplete.css'))
link(rel='stylesheet' href=cdnUrl(`/css/stylesheet.css?v=${cssVersion}`))
```

`cdnUrl` gets exposed to Pug via `app.locals.cdnUrl = cdnUrl;` in `index.ts`.

## 3. Deploy flow

The current `npm run publish` just zips the server and uploads it to the app bucket as `builds/<version>.zip`. We add a sibling step that uploads static assets to the assets bucket _before_ the EB application version is activated. The sequence has to be: **assets first, then server** — so when the new server tries to reference a new hashed bundle, it's already on CloudFront.

### `npm run publish` becomes

1. `npm run build` — same as today (`packages/client` produces hashed bundles + `manifest.json`; `packages/server` `copy-public` mirrors `public/` into `dist/server/public`).
2. **New**: `packages/scripts/src/uploadAssets.ts` — `aws s3 sync` of `dist/server/public/` → `s3://cubecobra-assets-<stage>/`, with:
   - `--cache-control` rules per content type (immutable for `js/` and any file matching `\.[a-f0-9]{8}\.(js|css)$`, otherwise 1d).
   - `--exclude` for unhashed JS leftovers from previous builds (we never delete; just don't re-upload ambiguous duplicates).
   - `--metadata-directive REPLACE` so cache-control gets re-applied on re-uploads.
   - `manifest.json` uploaded **last** with `no-cache`, so the cutover from old → new bundle URLs is atomic from the server's POV.
3. Upload the EB zip — `packages/scripts/src/publish.ts` exactly as today.
4. EB picks up the new zip and rolls instances. Old instances keep referencing the previous hashed filenames (still on S3, still cached on CloudFront edges); new instances reference the new ones.

### Where the manifest lives in prod

Two viable options:

- **A. Server still ships `manifest.json` inside the zip** (status quo) — `render.ts` reads from disk. Lowest change. Each EB version bundle is internally consistent.
- **B. Server fetches `manifest.json` from CloudFront on boot** (or via SSM parameter). Lets the manifest be deploy-decoupled, but adds a runtime dependency.

Recommend **A**. It's already working, and option B doesn't buy us anything that immutable filenames don't already give.

### CDK changes

`AssetsStack` lives in **us-east-1** (CloudFront's required region for ACM certs on custom domains). It contains the cert, bucket, distribution, and Route53 alias for `assets.<domain>`. The main `CubeCobraStack` continues to live in `us-east-2`; it just sets `CDN_BASE_URL = https://assets.<domain>` on the EB env by convention. No cross-region references are needed because the hostname is conventionally derived from `domain`.

`packages/cdk/lib/assets-distribution.ts` (construct):

- `s3.Bucket` (private, blockPublicAccess all, encryption SSE-S3, retain on stack delete, lifecycle 90d on `js/` keys).
- ACM `Certificate` for `assets.<domain>` validated via DNS against the apex hosted zone.
- `cloudfront.Distribution` with `S3BucketOrigin.withOriginAccessControl(bucket)`, custom cache behaviors for `js/*` and `css/*`, response headers policy for HSTS + CORS.
- Route53 A and AAAA aliases pointing at the distribution (`Z2FDTNDATAQYW2` is the canonical CloudFront zone ID).
- CloudFormation outputs (`CubeCobra-<env>-AssetsBucketName`, `CubeCobra-<env>-AssetsDistributionId`, `CubeCobra-<env>-AssetsBaseUrl`) for the pipeline to read.

`packages/cdk/lib/assets-stack.ts` (new): thin Stack wrapper around the construct, deployed independently in `us-east-1`.

`packages/cdk/lib/cubecobra-stack.ts`: just sets `serverEnvVars.CDN_BASE_URL = https://assets.${params.domain}`. No cross-region machinery.

`packages/cdk/app/infra.ts`: instantiates `AssetsStack` (us-east-1) before `CubeCobraStack` (us-east-2) for non-local environments.

`packages/cdk/lib/deployment-pipeline.ts`: each CodeBuild buildSpec orchestrates:

1. `cdk deploy CubeCobraAssets<Env>Stack` (creates/updates assets infra in us-east-1).
2. `aws cloudformation describe-stacks` to read the bucket name and distribution ID exports into env vars.
3. `npm run upload-assets` (now the bucket is guaranteed to exist).
4. `cdk deploy CubeCobra<Env>Stack` (rolls EB; new instances find their hashed bundles already on CloudFront).
5. `npm run invalidate-cdn` (busts the unhashed paths — manifest, /content/\*, css/stylesheet.css).

The CodeBuild role gets `acm:*`, `cloudfront:*`, `route53:*` on top of the existing CDK deploy permissions.

## 4. Dev (local) flow

**Goal: zero CloudFront, zero S3, zero LocalStack involvement for asset serving in dev.** The webpack-dev-server + Express setup we have today keeps working as-is.

How:

1. `CDN_BASE_URL` is unset locally (it's not in `.env_EXAMPLE`). `cdnUrl()` returns same-origin paths. Pug emits `/css/stylesheet.css`, React emits `/content/logo.png` — exactly as today.
2. Express keeps `express.static('/js', '...')` and `express.static('../public', ...)`. No change.
3. `npm run dev` keeps running webpack-dev-server on `:8080`, proxying everything except `/js/*.bundle.js` to the server on `:5000`. JS bundles come from webpack-dev-server in-memory; everything else (CSS, content/, manifest) comes from the Express static handler.
4. To smoke-test the CDN path locally without deploying:
   ```sh
   CDN_BASE_URL=http://localhost:5000 npm run dev:server
   ```
   The server emits absolute URLs back to itself. Useful for catching templating bugs but not needed day-to-day.

The PNG/ICO source-of-truth stays in `packages/server/public/content/` checked into git. Editing an icon = commit the file = next deploy `s3 sync` picks it up.

## 5. CI flow

CI (LocalStack-backed) should exercise the upload step so we don't break the deploy on green builds:

1. `localstack-init.sh` already creates `s3://local`. Add `awslocal s3 mb s3://local-assets`.
2. CI test stage runs `BUILD_VERSION=ci CDN_BASE_URL=http://localstack:4566/local-assets npm run upload-assets` against LocalStack and asserts the expected key set is present (a tiny `assertObjects.ts` that lists the bucket and checks for `manifest.json` + at least one `js/*.bundle.js`).
3. Existing integration tests run unchanged against same-origin URLs (CDN_BASE_URL unset).

This keeps the dev loop simple while validating the production code path on every PR.

## 6. Code touch list

Concrete files to change:

- `packages/utils/src/cdnUrl.ts` — new helper.
- `packages/server/src/index.ts` — register `app.locals.cdnUrl`; in prod, drop the `/js` and `/css` static handlers (only keep them for dev, behind `NODE_ENV !== 'production'`); keep `/content` static as a fallback in case CloudFront is misconfigured (or remove once stable).
- `packages/server/src/views/main.pug` — wrap every `href`/`src` for `/css`, `/content`, `/js` with `cdnUrl(...)`.
- `packages/server/src/emails/**/html.pug` — wrap `/content/...` references; emails go to clients that won't have a baseUrl, so use absolute `https://assets.cubecobra.com/...`.
- `packages/server/src/serverutils/render.ts` — wrap `getBundlesForPage` results; pass `cdnBaseUrl` into `reactProps`.
- `packages/client/src/**` — replace each `'/content/...'` literal with `cdnUrl('/content/...')` (use a small client-side wrapper that reads `window.reactProps.cdnBaseUrl`). ~30 components.
- `packages/scripts/src/uploadAssets.ts` — new.
- `packages/scripts/src/docker/localstack-init.sh` — add the local-assets bucket.
- `packages/cdk/lib/assets-distribution.ts` — new construct.
- `packages/cdk/lib/cubecobra-stack.ts` — instantiate it; set `CDN_BASE_URL` env var.
- `packages/cdk/lib/certificates.ts` — extend to cover `assets.<domain>`.
- `packages/cdk/lib/route53.ts` — A/AAAA alias for `assets.<domain>`.
- `packages/docs/setup/environment-variables.md` — document `CDN_BASE_URL`.
- `package.json` (root) — add `upload-assets` workspace script wired into `publish`.

## 7. Rollout

1. **Land the helper + dual-serve**. Ship `cdnUrl()` everywhere, but don't set `CDN_BASE_URL` in any env yet. Effectively a no-op refactor — verifies the URL emission path without changing serving behavior.
2. **Provision infra in dev account**. Deploy the CDK changes to `cubecobradev.com`, get `assets.cubecobradev.com` returning files via CloudFront. Manual upload one-shot to confirm.
3. **Wire upload into deploy for dev only**. Add the upload step to the dev deploy pipeline. Set `CDN_BASE_URL` for the dev EB env. Verify the dev site loads bundles + images from CloudFront. Watch CloudWatch + Real User Monitoring for errors for a week.
4. **Promote to prod**. Same CDK + pipeline changes, set `CDN_BASE_URL` for prod EB env. Keep the Express static handlers as fallback for one release, then remove.
5. **Trim the EB deployment artifact**. Once prod is stable on CloudFront, stop copying `public/` into the server zip in `packages/server/package.json` (`copy-public` script) — saves on EB deploy size.

## 8. Risks and edge cases

- **Hot-link breakage**: third parties that hot-link `https://cubecobra.com/content/banner.png` (the patron banner string in `main.pug` already does this) will keep working as long as the Express `/content` fallback stays. After we remove it, set up a CloudFront behavior on the apex domain that 301s `/content/*.{png,jpg,ico,svg}` to `assets.cubecobra.com` so old links don't 404.
- **Email images**: emails are read days/weeks after they're sent. Use absolute URLs (`https://assets.cubecobra.com/content/banner.png`) — never relative — or you'll break in clients like Gmail's image proxy.
- **Hashed-CSS problem**: today `stylesheet.css` is _not_ hashed; it's invalidated via `?v=${GIT_COMMIT}` query string. CloudFront default caches by path only — make sure the cache policy includes the query string in the cache key, or move stylesheet.css to be content-hashed by Tailwind/PostCSS like the JS bundles. The latter is cleaner.
- **NitroPay banner**: the inlined ad-block detector in `main.pug` references `https://cubecobradev.com/content/banner.png` literally. That string survives the CDN move (it's an absolute URL on the apex), and we cover it via the redirect mentioned above. Worth searching for other absolute hardcoded asset URLs.
- **Deploy ordering**: assets must reach S3 before the EB version is promoted. If we ever do an emergency rollback by re-promoting an old EB version, the old hashed filenames must still be in S3 — that's why we never delete on sync, only via the 90d lifecycle.
- **Bundle externals**: webpack `externals` already pulls React/ReactDOM from `cdn.jsdelivr.net`. No change needed; just noting that we're already CDN-dependent and CloudFront just adds our own origin.
- **CSP**: if/when CSP is added, `assets.cubecobra.com` needs to be in `script-src` and `img-src`.

## 9. Open questions to confirm before implementing

- Do we want one CloudFront distribution per stage, or share one with multiple origins keyed by host header? (Recommend per-stage; cheaper to reason about.)
- Are we OK introducing `assets.cubecobra.com` (yes/no/different name)?
- Do we want to start moving images out of git (S3 source-of-truth, fetched in dev) as a follow-up? Out of scope for this migration but worth flagging — the `content/` folder is 8.4 MB and growing.
