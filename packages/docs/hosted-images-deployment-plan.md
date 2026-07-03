# Hosted Images — Deployment Plan (human steps)

> **Status: code implemented, awaiting rollout.** The steps below are still the human actions
> required. Note the server now has its **own** R2 client (`serverutils/r2.ts`), so step 1
> (server R2 credentials) is the critical prerequisite — without it, uploads silently fall back
> to writing on the instance's local disk instead of R2/CDN.

Concise checklist for rolling out the hosted-images feature. No DynamoDB migration and no new
Patreon tier are required. The only real infra concern is confirming the CDN serves the new
`userimages/` prefix and that the **server** has R2 credentials.

## Pre-deploy

1. **Confirm the server has R2 credentials.**
   The server (Elastic Beanstalk env) needs `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `CDN_BASE_URL` set. Card images already use these in
   the jobs/CodeBuild context; verify they are also present on the **server** environment.
   - CDK: `packages/cdk/lib/cubecobra-stack.ts` sets `R2_*` + `CARD_IMAGE_BASE_URL` on the server
     env for cut-over stages. Confirm `CDN_BASE_URL` (= `https://assets.<domain>`) is also set
     there (it is wired in the same file). If any are missing, add them before deploying.

2. **Cloudflare / R2 bucket check.**
   - The `userimages/` prefix lives in the **same** R2 bucket already served at
     `assets.<domain>`. No new bucket or custom domain needed.
   - Confirm no Cloudflare rule (WAF / redirect / cache) blocks or rewrites `/userimages/*`.
   - (Optional) Add a Cloudflare cache rule for `/userimages/*` → cache everything, long TTL
     (objects are written immutable with `max-age=31536000`).

3. **R2 write permissions.** Ensure the R2 API token used by the server has **write + delete**
   on the bucket (card-image sync only needs write; delete is new here for image removal).

## Deploy

4. **Merge & deploy the code** through the normal pipeline. The build runs `npm install`
   (pulls in `sharp` for the server package) and bundles the client.
   - No table changes: single-table `*_CUBECOBRA` and its GSI1 are reused.
   - No env var additions beyond confirming step 1.

## Post-deploy verification

5. **Smoke test as a Lotus Cobra account (or Admin):**
   - Card modal → custom image → Upload → confirm the image appears and the card renders it.
   - Account → **My Images** → image listed; Copy URL returns a working `${CDN_BASE_URL}/userimages/...`
     URL that loads in a browser.
   - Upload a custom **profile** image and a custom **cube** image; confirm they render and show
     up in **My Images**.
   - Delete an image → confirm the warning modal, then that the CDN URL 404s afterward.

6. **Smoke test as a non-patron:** confirm no upload buttons appear and a direct
   `POST /user/images/upload` returns **403**.

7. **Check the R2 bucket** for objects under `userimages/{userId}/` after a test upload.

8. **Support page:** verify `/help/donate` lists the three new Lotus Cobra perks.

## Rollback

9. Revert the deploy. Any images already uploaded remain in R2 and continue to serve (URLs are
   plain CDN paths), but the upload UI/endpoints disappear. No data cleanup required to roll back;
   orphaned `HostedImage` records are harmless.

## Notes / decisions baked in

- Storage: existing R2 bucket, prefix `userimages/{userId}/{imageId}.webp`, served via `CDN_BASE_URL`.
- Processing: re-encoded to WebP, ≤1600px, ≤10MB input, EXIF stripped.
- Quota: 100 images / 500MB per user (change `MAX_IMAGES_PER_USER` / `MAX_BYTES_PER_USER` in
  `packages/utils/src/hostedImagesUtil.ts` if you want different limits — code change, not env).
- Gating: Lotus Cobra tier (active) or Admin role.
- Local dev writes to `packages/server/public/userimages/` and needs no AWS/R2/LocalStack setup.
