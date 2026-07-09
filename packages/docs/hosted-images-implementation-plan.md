# Hosted Images — Implementation Plan

> **Status: implemented.** This document was the build plan and has been reconciled with the
> shipped code. Deviations from the original plan are called out inline as **[Built as]** notes.

Feature: let **Lotus Cobra** Patreon tier members (and **Admins**) upload images that
CubeCobra hosts in R2 and serves through the CDN. Uploaded images:

1. Can be attached as a card's custom image URL (front/back) from the card modal.
2. Can be used as an arbitrary **profile image** (avatar).
3. Can be used as an arbitrary **cube image**.

All uploads are tracked as **managed `HostedImage` records** so they appear in a new
account-settings "My Images" manager (delete / rename / copy URL / replace).

## Decisions (locked)

- **Storage:** existing R2 bucket (`R2_BUCKET`), new key prefix `userimages/{userId}/{imageId}.webp`.
- **Serving:** existing CDN domain via `CDN_BASE_URL` → `${CDN_BASE_URL}/userimages/...`
  (same-origin path in local dev where `CDN_BASE_URL` is empty).
- **Processing:** accept `jpg/png/webp/gif`, re-encode to WebP via `sharp`, strip metadata,
  cap max dimension **1600px**, reject inputs **> 10MB**. (Numbers centralized as constants.)
- **Quota:** soft per-user cap — **100 images** and **500MB** total. Enforced server-side.
- **Gating:** `patron.level >= PatronLevels['Lotus Cobra']` **and** `status === ACTIVE`, **or**
  `roles.includes(UserRoles.ADMIN)`.

---

## 1. Shared datatypes & gating util (`packages/utils`)

### 1.1 `packages/utils/src/datatypes/HostedImage.ts` (new)

Define the domain type. Extends `BaseObject` (so it carries `dateCreated`/`dateLastUpdated`).

```ts
export interface UnhydratedHostedImage extends BaseObject {
  id: string;
  owner: string; // user id
  key: string; // R2 key, e.g. userimages/{userId}/{id}.webp
  url: string; // resolved public URL (relative path; cdnUrl() applied on read)
  name?: string; // user-facing label
  bytes: number; // stored size, for quota accounting
  width?: number;
  height?: number;
  usage?: 'general' | 'profile' | 'cube'; // origin hint, optional
}
export type HostedImage = UnhydratedHostedImage;
```

Notes:

- Store `url` as the **relative path** (`/userimages/...`) and apply `cdnUrl()` when reading
  server-side / when handing to the client, mirroring how assets are handled. This keeps the
  record portable if the CDN domain changes.
- No sensitive fields → no strip step needed.

### 1.2 `packages/utils/src/hostedImagesUtil.ts` (new)

Follow the `featuredQueueUtil.ts` pattern so client and server share one gate.

```ts
export const IMAGE_HOSTING_TIER = PatronLevels['Lotus Cobra'];
export const MAX_IMAGES_PER_USER = 100;
export const MAX_BYTES_PER_USER = 500 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 1600;
export const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const canUseImageHosting = (patron: Patron | undefined | null, roles: UserRoles[] | undefined): boolean => {
  if (roles?.includes(UserRoles.ADMIN)) return true;
  return !!patron && patron.status === PatronStatuses.ACTIVE && patron.level >= IMAGE_HOSTING_TIER;
};
```

---

## 2. DynamoDB DAO (`packages/server/src/dynamo`)

### 2.1 `packages/server/src/dynamo/dao/HostedImageDynamoDao.ts` (new)

Extend `BaseDynamoDao<HostedImage, UnhydratedHostedImage>` (single-table; no CDK change).

- `itemType() => 'HOSTED_IMAGE'`
- `partitionKey(item) => this.typedKey(item.id)`; `sortKey` → default constant.
- `GSIKeys(item)` → owner index, date-sortable:
  ```ts
  GSI1PK: `HOSTED_IMAGE#OWNER#${item.owner}`,
  GSI1SK: `DATE#${item.dateCreated}`,
  ```
- `hydrateItem` → apply `cdnUrl(item.url)` onto a derived `url` field returned to callers
  (keep stored `url` as the relative path).
- Methods:
  - `createImage(fields) => HostedImage` (generates `uuidv4()` id, sets timestamps).
  - `queryByOwner(ownerId, lastKey?)` → query `IndexName: 'GSI1'`, `ScanIndexForward: false`.
  - `getUsageForOwner(ownerId)` → returns `{ count, bytes }` for quota checks (sum over
    `queryByOwner`, paginating). Keep it simple; counts are small (<=100).
  - Reuse base `get` / `delete` / `update`.

Model this file on `packages/server/src/dynamo/dao/ArticleDynamoDao.ts` (its `queryByOwner`
on GSI2 is the closest template).

### 2.2 `packages/server/src/dynamo/daos.ts`

Register:

```ts
export const hostedImageDao = new HostedImageDynamoDao(documentClient, tableName);
```

---

## 3. Server R2 client + image pipeline (`packages/server`)

The server currently has **no** R2 client (only `packages/jobs/src/utils/r2.ts` does). Add one.

### 3.1 `packages/server/src/serverutils/r2.ts` (new)

Mirror `jobs/src/utils/r2.ts`: `S3Client` (`@aws-sdk/client-s3`, region `auto`,
`forcePathStyle`, R2 creds), `r2Configured()`, `putObject(key, body, contentType, cacheControl)`,
`deleteObject(key)`. Uses the same env vars (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`).

### 3.2 `packages/server/src/serverutils/hostedImageStorage.ts` (new)

The storage abstraction that picks R2 vs local folder:

- `processImage(buffer): { body: Buffer, width, height, bytes }` — via `sharp`: auto-orient,
  `resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })`,
  `.webp()`, `.rotate()` and metadata-strip (sharp strips by default on re-encode).
- `storeImage(userId, imageId, body)`:
  - If `r2Configured()` → `putObject('userimages/${userId}/${imageId}.webp', body, 'image/webp',
'public, max-age=31536000, immutable')`.
  - Else (local dev) → write to `packages/server/public/userimages/${userId}/${imageId}.webp`
    (served by the existing `express.static(public)` handler).
  - Returns the **relative** url path `/userimages/${userId}/${imageId}.webp`.
- `deleteStoredImage(key)` → `deleteObject` in R2, or `fs.unlink` locally.

Add `sharp` to `packages/server` dependencies (already a `jobs` dep).

### 3.3 Multipart intake

`express-fileupload` is already mounted globally in `packages/server/src/index.ts`
(`app.use(fileUpload())`), but with no limits. Tighten it:

```ts
app.use(fileUpload({ limits: { fileSize: MAX_UPLOAD_BYTES }, abortOnLimit: true }));
```

(Verify no other consumer depends on the current unlimited config — grep found none.)

---

## 4. Server routes (`packages/server/src/router/routes/user/images/`)

New route folder. All handlers use `ensureAuthJson` + a tier check. Add a small reusable
middleware:

```ts
// serverutils/middleware or inline
const ensureImageHosting = async (req, res, next) => {
  const patron = await patronDao.getById(req.user!.id);
  if (!canUseImageHosting(patron, req.user!.roles)) {
    return res.status(403).json({ success: 'false', message: 'Image hosting requires Lotus Cobra tier.' });
  }
  return next();
};
```

Routes (register in `packages/server/src/router/routes/user/index.ts` or wherever user routes
are wired — follow existing `queuefeatured.ts` registration):

1. **`POST /user/images/upload`** (`ensureAuthJson`, csrf, `ensureImageHosting`)
   - Read `req.files.image`. Validate mime ∈ `ACCEPTED_MIME` and size.
   - Enforce quota: `getUsageForOwner` → reject if `count >= MAX_IMAGES_PER_USER` or
     `bytes + newBytes > MAX_BYTES_PER_USER`.
   - `processImage` → `storeImage` → `hostedImageDao.createImage(...)`.
   - Return the hydrated record (with `cdnUrl`-resolved url).

2. **`GET /user/images`** (`ensureAuthJson`) → `queryByOwner(req.user.id, lastKey)` for the
   settings manager. Paginated.

3. **`POST /user/images/:id/rename`** (`ensureAuthJson`) → owner-or-admin check, update `name`.

4. **`POST /user/images/:id/delete`** (`ensureAuthJson`) → owner-or-admin check,
   `deleteStoredImage` + `hostedImageDao.delete`. (Client shows the "may break links" warning.)

> **[Built as]** Route paths are flat files under `router/routes/user/images/` (auto-registered),
> so the endpoints are `/user/images/upload`, `/user/images/list`, `/user/images/rename`,
> `/user/images/delete` — not the `/:id/...` form above. The **replace** endpoint was dropped:
> re-uploading simply creates a new managed image (simpler, and avoids mutating a key other
> records may point at). All routes use `success: 'true' | 'false'` + `message` JSON envelopes.
> A `hostedImageToClient(image)` helper (in `hostedImagesUtil.ts`) applies `cdnUrl()` to the stored
> relative `url` before any route returns a record to the browser.

Ownership checks use `image.owner === req.user.id || isAdmin(req.user)`.

### 4.1 Profile & cube image wiring

- **Profile:** add `profileHostedImageId?: string` and derived `profileImageUrl?: string` to
  `User`/`UnhydratedUser` (`packages/utils/src/datatypes/User.ts`). Existing card-art
  `imageName`/`image` stays as the fallback. On profile-image upload, create a `HostedImage`
  (`usage: 'profile'`), set `user.profileHostedImageId`. Update the profile-save handler
  (`/user/updateuserinfo` in `packages/server/src/router/routes/user/...`) to accept/clear it.
  Rendering (avatar) prefers `profileImageUrl` when set, else falls back to card art.
- **Cube:** add `imgHostedImageId?: string` (+ derived url) to `Cube`
  (`packages/utils/src/datatypes/Cube.ts`). Cube already has `imageName`/`image` (card art) and
  an `imgUrl` string field — reuse the upload to populate a hosted image and set the reference.
  Update `/cube/api/editoverview` (`packages/server/src/router/routes/cube/...`) to accept it.
  Cube image resolution prefers the hosted image when present.

Both go through the **same** upload endpoint pattern so they land in the manager. Simplest:
`POST /user/images/upload` accepts an optional `usage` param; profile/cube pages call it, get the
record back, then save the id via their existing save endpoints.

> **[Built as]** This is exactly how it shipped. The client uploads (getting back a full record),
> then saves only the **hosted image id** — `profileHostedImageId` via `/user/updateuserinfo`
> (a hidden field on the existing `CSRFForm`), and `cube.imgHostedImageId` via
> `/cube/api/editoverview`. The server resolves the id → owns-check → stores the record's relative
> `url` onto `user.profileImageUrl` / `cube.imgHostedImageUrl` (so a stale/absolute URL can never
> be injected by the client). Sending an empty id clears the custom image back to card art.
> Hydration (`UserDynamoDao` / `CubeDynamoDao`) applies `cdnUrl()` to that relative url when
> building the display `image`.

---

## 5. Client: expose patron tier to the UI (`packages/server` render + `packages/client`)

The client `UserContext` today knows `roles` but **not** patron level. To gate the card-modal
button (which is deep in the tree) we need the level client-side.

- In `packages/server/src/config/passport.ts` `deserializeUser`, after loading the user, attach
  an ephemeral `patronLevel`/`patronStatus` (from `patronDao.getById`) — OR fetch it in
  `render.ts`.
- In `packages/server/src/serverutils/render.ts`, add `patronLevel` + `patronStatus` to the
  `reactProps.user` whitelist (currently omits patron).
- Add a client helper `useCanUploadImages()` (reads `UserContext`, calls
  `canUseImageHosting({ level, status }, roles)`).

> **[Built as]** Fetched in `render.ts` (added `patronDao.getById` to the existing `Promise.all`),
> **not** in `deserializeUser` — this keeps the extra query on the page-render path rather than
> every request. `patronLevel`/`patronStatus` are added to the `reactProps.user` whitelist and to
> the `User` type as ephemeral (non-persisted) fields. The client hook `useCanUploadImages()`
> (`hooks/useCanUploadImages.ts`) reads `UserContext` and calls `canUseImageHostingClient(level,
status, roles)`. The `UserAccountPage` "My Images" section is gated with the full
> `canUseImageHosting(patron, roles)` using the `patron` page prop it already receives.

---

## 6. Client: reusable upload widget

`packages/client/src/components/ImageUploadWidget.tsx` (new)

- Base components: `Input type="file"`, `Button`, `Collapse`, `Card`, plus `@primer/octicons-react`
  (e.g. `UploadIcon`, `CopyIcon`, `TrashIcon` — **no emoji**, per project convention).
- Uses `csrfFetch` from `CSRFContext` with a `FormData` body (do **not** set `Content-Type`;
  let the browser add the multipart boundary; `csrfFetch` still adds the `CSRF-Token` header).
- Props: `onUploaded(image: HostedImage)`, optional `usage`.
- Shows client-side validation (type/size) before upload, progress, and error messages.

---

## 7. Client: card modal integration

`packages/client/src/components/card/CardModal.tsx` (and `VoucherCardModal.tsx`)

- Next to the "Image URL" / "Image Back URL" inputs, add an **Upload** button — rendered only
  when `useCanUploadImages()` is true.
- Clicking toggles a `Collapse` containing `ImageUploadWidget`.
- `onUploaded(image)` → `updateField('imgUrl', image.url)` (or `imgBackUrl`). Reuses the existing
  `updateField` → `editCard` staging path (no new save mechanism).

---

## 8. Client: account settings "My Images" section

- `packages/client/src/pages/UserAccountPage.tsx`: add a `SECTIONS` entry
  `{ key: 'images', label: 'My Images', Icon: ImageIcon, render: () => <UserHostedImages /> }`.
- `packages/client/src/components/user/UserHostedImages.tsx` (new):
  - `GET /user/images` on mount (paginated), grid of thumbnails.
  - Per image: **Copy URL** (`navigator.clipboard`, `CopyIcon`), **Rename**, **Replace**
    (`ImageUploadWidget` in replace mode), **Delete**.
  - Delete opens a confirm modal with the warning: _"Deleting this image may break any cards,
    cubes, or profiles that link to it. This cannot be undone."_
  - Show quota usage (`count / 100`, `MB / 500MB`).

---

## 9. Client: profile & cube image upload

- `packages/client/src/components/user/UserProfile.tsx`: add an "Upload image" option (gated)
  alongside the existing card-art autocomplete. On upload, save `profileHostedImageId` via the
  existing `/user/updateuserinfo` `CSRFForm` (add a hidden field) or a small `csrfFetch`.
- `packages/client/src/components/settings/OverviewSettings.tsx`: same, gated; save
  `imgHostedImageId` via the existing `/cube/api/editoverview` `csrfFetch` call.
- Both preview the uploaded image and allow clearing it (revert to card art).

---

## 10. Support / donate page perks

`packages/client/src/pages/DonatePage.tsx` — the `PERKS` array is currently a flat list. Add the
three Lotus-Cobra perks. Recommended: restructure into a small tiered list so it's clear these
are top-tier, e.g.:

```
Lotus Cobra tier also includes:
- Host your own images on CubeCobra and use them as custom card art
- Upload a custom profile picture
- Upload a custom cube image
```

(If you prefer minimal change, just append three strings to `PERKS` with a "(Lotus Cobra)"
suffix.) Keep copy user-facing — no file paths / bucket names.

> **[Built as]** Added a separate `LOTUS_COBRA_PERKS` array rendered under a "Lotus Cobra tier
> also includes:" subheading in the existing Supporter perks card.

---

## 11. Local development

- Create `packages/server/public/userimages/.gitkeep` so the folder exists; ensure it's
  git-ignored for actual uploads (`packages/server/public/userimages/*` in `.gitignore`, keep
  `.gitkeep`).
- With R2 unconfigured locally, `storeImage` writes there and `cdnUrl('')` is empty, so images
  serve same-origin at `/userimages/...` via the existing `express.static(public)` handler.
- No LocalStack changes required (this path bypasses S3/LocalStack entirely).

---

## 12. Files touched — quick index

New:

- `packages/utils/src/datatypes/HostedImage.ts`
- `packages/utils/src/hostedImagesUtil.ts`
- `packages/server/src/dynamo/dao/HostedImageDynamoDao.ts`
- `packages/server/src/serverutils/r2.ts`
- `packages/server/src/serverutils/hostedImageStorage.ts`
- `packages/server/src/router/routes/user/images/{upload,list,rename,delete}.ts`
- `packages/client/src/components/ImageUploadWidget.tsx`
- `packages/client/src/components/user/UserHostedImages.tsx`
- `packages/client/src/hooks/useCanUploadImages.ts`
- `packages/server/public/userimages/.gitkeep` (local dev fallback dir)

Edited:

- `packages/server/src/dynamo/daos.ts` (register dao)
- `packages/server/src/index.ts` (fileUpload limits)
- `packages/server/src/serverutils/render.ts` (expose patron level via existing Promise.all)
- `packages/server/src/router/middleware.ts` (`ensureImageHosting` gate)
- `packages/utils/src/datatypes/User.ts`, `Cube.ts` (hosted-image reference + ephemeral patron fields)
- `packages/server/src/dynamo/dao/UserDynamoDao.ts`, `CubeDynamoDao.ts` (hydration prefers hosted image)
- profile save (`/user/updateuserinfo`) + cube overview (`/cube/api/editoverview`) handlers
- `packages/client/src/pages/UserAccountPage.tsx` (new gated section)
- `packages/client/src/components/card/CardModal.tsx`
- `packages/client/src/components/user/UserProfile.tsx`
- `packages/client/src/components/settings/OverviewSettings.tsx`
- `packages/client/src/pages/DonatePage.tsx`
- `.gitignore` (ignore local `public/userimages/*` except `.gitkeep`)

> **[Built as]** `deserializeUser`/passport was **not** touched (patron level is fetched in
> `render.ts`). `VoucherCardModal.tsx` was **not** touched — only the primary `CardModal.tsx`
> got the upload button. A `ensureImageHosting` middleware was added to `router/middleware.ts`.
> `packages/server/package.json` was **not** touched — `sharp` and `express-fileupload` were
> already dependencies.

## 13. Testing checklist

- Non-patron: no upload button anywhere; upload endpoint returns 403.
- Lotus Cobra + Admin: full flow works.
- Upload jpg/png/gif → served as webp; oversized (>10MB) rejected; >1600px downscaled.
- Quota: blocked at 100 images / 500MB.
- Delete removes R2 object + record; warning shown.
- Local dev writes to `public/userimages` and serves same-origin.
- Card modal front/back, profile, and cube all set images and they appear in the manager.
- Edit an unrelated profile field with a custom avatar set → avatar is preserved (not wiped).
- Delete a custom avatar → owner's profile falls back to card art, not a broken image.

## 14. Post-review hardening (applied)

A multi-agent code review ran after the initial build. Fixes applied:

- **Avatar data-loss:** `render.ts` now serializes `profileHostedImageId`/`profileImageUrl` into
  `reactProps.user`, so the profile form round-trips a custom avatar instead of clearing it on
  any unrelated edit.
- **Render resilience:** the added `patronDao.getById` in the render `Promise.all` is now
  `.catch(() => undefined)` — a Patron-table hiccup degrades to "no patron" instead of failing
  every authenticated page render.
- **SVG-spoof / format validation:** `processImage` validates sharp's content-sniffed format
  against a raster allowlist (excludes SVG) and sets `limitInputPixels`, rather than trusting the
  client-declared MIME type.
- **Delete ordering + dangling refs:** `delete.ts` removes the DynamoDB record first (best-effort
  storage delete after) and clears the owner's avatar reference so a deleted image can't leave a
  broken 404 avatar.
- **Robustness:** `list.ts` validates the `lastKey` shape before passing it to DynamoDB; the
  upload widget handles a plain-text `413` gracefully.
- **Reuse:** a single `hostedImageToImageData(uri, id)` helper replaces the synthetic-Image
  literal previously duplicated across both DAOs and both client upload handlers.

Accepted (not fixed), by design:

- **Quota race under concurrent uploads** (GSI is eventually consistent): the cap is soft and the
  window is small; a strongly-consistent counter/transaction wasn't warranted.
- **`getUsageForOwner` full-partition scan:** bounded by the 100-image cap, so O(images) reads are
  acceptable; a denormalized counter can be added later if the cap grows.
