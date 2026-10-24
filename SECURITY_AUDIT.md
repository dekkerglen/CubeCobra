# CubeCobra Security Audit

| | |
|---|---|
| **Date** | 2026-10-22 |
| **Commit audited** | `486571bfc` (`master`) |
| **Scope** | Whole monorepo: `packages/server`, `client`, `utils`, `recommenderService`, the three Lambdas, `jobs`, `cdk`, `scripts`, the Python tooling (`annotator`, `archetypeAnnotater`), `.github/workflows`, plus full git history for secrets |
| **Method** | Manual static review split by attack surface; every Critical/High finding re-verified by hand against the source (two reproduced in Node). Dependency scanning: `npm audit` (full and `--omit=dev`) on the root workspace lockfile, CVE IDs resolved through the GitHub Advisory Database, Python packages checked against OSV. IaC review of the CDK source, cross-checked against synthesized templates in `packages/cdk/cdk.out`. Secret scan of the working tree and all 8,383 commits. |
| **Not covered** | Dynamic testing against beta or prod; cloud-console-only configuration (Cloudflare rules, the imported S3 buckets, GitHub branch protection and repo secrets, AWS account settings). Where a finding depends on one of these, it says so. |

> **Handling note:** CubeCobra is a public repository and this file describes unfixed, exploitable weaknesses. It is untracked. Don't commit or push it until the Critical and High items are fixed, or keep it somewhere private.

---

## Remediation status (branch `security-hardening`, 2026-10-22)

All fixes are uncommitted on `security-hardening`. They were verified with:
- `tsc` clean in server, client, utils, recommender, CDK, jobs and integration tests;
- jest: server 2,106 tests, client 367, CDK 36, recommender 8, jobs 21;
- prettier and oxlint;
- the three Lambda bundles and a client production build;
- an end-to-end browser and `curl` session against a local AWS mock with every production setting neutralized.

**CSRF approach.** CSRF is now blocked without tokens. A global guard (`serverutils/csrf.ts`) checks the `Sec-Fetch-Site` and `Origin` headers browsers already send, falling back to `Referer`. The session cookie is also `SameSite=Lax`. There is no per-session state and nothing rendered into pages, so the stale-token failure modes behind csurf's intermittent "invalid csrf token" errors can't happen. `CSRF_MODE=report` turns blocking into logging if something unexpected turns up in production.

| ID | Status | Notes |
|---|---|---|
| C-01 | Fixed | Format fields allowlisted server-side; legacy `html` sanitized on save and with DOMPurify at render |
| H-01 | Fixed | CSRF guard; cookie `HttpOnly`/`SameSite=Lax`/`Secure=auto`; email change needs the password plus confirmation from the new address, notifies the old one, and revokes other sessions |
| H-02 | Fixed | Board-key and index validation in commit; reserved board names rejected; JSON reviver drops `__proto__`/`constructor`/`prototype` |
| H-03 | Fixed | `submitdraft` deleted; grid/Housman submit is owner-only, rejects completed drafts, copies only validated deck fields |
| H-04 | Fixed | `safeFetch` allows only public IPs (checked per hop, connection pinned) on standard ports, with size and time caps; sharp pixel limit and format allowlist; tile cap; evicting LRU cache; rate limits; write-side URL validation |
| H-05 | Fixed | Count ≤ 4 digits, clamped to 100 per line; 10,000-card import cap; decklist parser anchored |
| H-06 | Fixed | Podcast description sanitized at ingest and render |
| H-07 | Fixed (rollout pending) | `npm ci`; deploy role scoped to the CDK bootstrap roles and specific S3/ECR/CloudFormation resources; stale grants removed. Once an environment's `secretsFromSsm` flag is on, its build receives no application secrets and can read only the non-secret parameters; R2 upload keys are read only inside the asset-upload step. Not done: splitting build and deploy into separate projects. **Takes effect only after `npm run deploy:pipeline`.** |
| H-08 | Fixed | DailyJobs Lambda scoped to its stage table/indexes and data bucket |
| H-09 | Fixed | compression 1.8.2, sharp 0.35.5; tfjs-node and csurf removed from the server; production advisories 56 → 42, none of the remaining ones internet-reachable |
| H-10 | Fixed | Grammar no longer ambiguous (1,001-char worst case: 92.6 s → 34 ms); 4,000-char parser cap, 1,000 on anonymous endpoints; rate limits |
| H-11 | Fixed | http(s) only, enforced on server and client |
| M-01 | Fixed | Token and verification fields stripped from public user objects; `getByUsername` returns `{id, username}`; tokens are random, single-use, compared in constant time |
| M-02 | Fixed | 28 state-changing GET routes now POST (new `PostButton`); Markdown drops same-origin and relative images |
| M-03 | Fixed | Viewability guards on all listed endpoints and the 8 deck-download routes; `api/private.ts` deleted |
| M-04 | Fixed | Ban middleware logs the user out without processing the request; banned users can't log in |
| M-05 | Fixed | Limits on login, lost-password, verification, reset, change password, delete account, register, email change |
| M-06 | **Partial** | helmet headers; enforced `frame-ancestors`/`object-src`/`base-uri`; nonce-based script CSP in report-only mode with sampled reports. The ad network needs `eval` and WebAssembly, so review reports before enforcing. HSTS `includeSubDomains` not added (check every subdomain is HTTPS first). |
| M-07 | Fixed | |
| M-08 | Fixed | |
| M-09 | Fixed | Deep key-based redaction, query strings dropped, secret path segments masked. **Rotate the Draftmancer and ManaMatrix keys.** |
| M-10 | Fixed | Production refuses to boot without `SESSION` (or `CAPTCHA_SECRET_KEY` when bot security is on); Patreon hook fails closed; record tokens use `RECORD_TOKEN_SECRET`, falling back to `SESSION` |
| M-11 | Fixed in app / opt-in in IaC | `CF-Connecting-IP` trusted only from Cloudflare ranges; ALB-to-Cloudflare lockdown behind `restrictAlbToCloudflare` (off) |
| M-12 | Fixed (rollout pending) | Services load secrets from SSM SecureStrings at startup (`packages/utils/src/ssmSecrets.ts`); templates and service configuration carry only parameter names. Gated per environment by `secretsFromSsm`; `*_PREVIOUS` values allow zero-downtime rotation. Deployer keys and the unused artifact export removed; artifact bucket enforces TLS and is versioned. **Migration and rotation: [packages/docs/maintenance/secrets-migration.md](packages/docs/maintenance/secrets-migration.md).** |
| M-13 | **Partial** | `ignore-scripts=true` for EB's on-instance install. Still to do: ship a lockfile or `node_modules`. |
| M-14 | Fixed | OIDC role deleted; scan-on-push. Follow-ups: immutable tags, delete the bootstrap stack after both stacks deploy. |
| M-15 – M-19 | Fixed | Recommender shared secret is opt-in until the SSM parameter exists |
| L-01 – L-22 | Fixed, except as noted | L-05 has no reconciliation job. L-12 body limit is 10 MB, not 1 MB. L-15: recommender still shares the web role, dev bucket only commented. L-16: base images not digest-pinned. L-18: small cross-instance race remains (needs an atomic usage counter). |
| Info | I-05, I-07, I-08 (exact pins, no hashes), I-11 fixed | Others are operator, structural or no-op items |

### Operator actions required (cannot be done from the repo)

Already confirmed: `SESSION` is set in beta and prod, and IMDSv1 is already disabled, so the `DisableIMDSv1` setting changes nothing.

1. Run `cd packages/cdk && npm run deploy:pipeline` so the CodeBuild/IAM changes take effect.
2. Follow [the secrets migration runbook](packages/docs/maintenance/secrets-migration.md). It covers:
   - creating the `/cubecobra/<seg>/secrets/*` SecureStrings;
   - switching beta, then prod;
   - removing secrets from the build;
   - rotating every secret, the Draftmancer and ManaMatrix keys first;
   - provisioning `RECOMMENDER_SHARED_SECRET` in the right restart order;
   - cleanup.

   Turning the flag on adds an SSM interface endpoint for the bot-deckbuild Lambda, about $22/month per environment.
3. Delete unused legacy GitHub repo secrets and deactivate the old IAM user keys (I-01).
4. After beta and prod have both deployed this branch, tear down the `BootstrapStack` OIDC provider (see the M-14 note in the CDK README).
5. Optional:
   - enable `restrictAlbToCloudflare` (beta first);
   - scan stored cubes and podcasts for legacy `html` and descriptions (now inert, but worth cleaning);
   - give the pipeline's asset upload its own R2 token.

---

## Contents

1. [Executive summary](#1-executive-summary)
2. [Ranked findings](#2-ranked-findings)
3. [Critical and High findings](#3-critical-and-high-findings)
4. [Medium findings](#4-medium-findings)
5. [Low and informational findings](#5-low-and-informational-findings)
6. [Dependency vulnerabilities (SCA)](#6-dependency-vulnerabilities-sca)
7. [What was checked and found sound](#7-what-was-checked-and-found-sound)
8. [Remediation roadmap](#8-remediation-roadmap)
9. [Appendix: advisory to CVE mapping](#9-appendix-advisory-to-cve-mapping)

### Severity scale

| Severity | Meaning |
|---|---|
| **Critical** | Easy to exploit with a free account or no account, and leads to compromise of other users' accounts (including admins) or the whole service. Fix immediately. |
| **High** | Serious confidentiality, integrity or availability impact that needs only modest preconditions, or a Critical-class impact behind a meaningful precondition. Fix within days. |
| **Medium** | Real weakness with limited impact, a significant precondition, or one that mainly amplifies other bugs. Fix within weeks. |
| **Low** | Hardening, defense in depth, or narrow impact. |
| **Info** | Observation; no direct vulnerability. |

---

## 1. Executive summary

The application has sound foundations in several places, listed in [§7](#7-what-was-checked-and-found-sound):
- Admin routes are consistently role-gated, and roles are re-read from the database on every request.
- Hosted-image uploads are re-encoded and stored under keys that users can't control.
- Passport regenerates the session on login.
- Webhook HMACs use constant-time comparison.
- No live secrets exist anywhere in the tree or its history.

The serious problems fall into five themes:

1. **Nothing contains a successful XSS or cross-site request.** CSRF protection is a no-op stub (`csurf` is commented out). The session cookie sets neither `SameSite` nor `Secure`. There is no Content-Security-Policy. The account email can be changed without the current password, and password reset goes to whatever email is stored. Taken together, **any XSS, and any cross-site form POST, becomes full account takeover**. That includes admin accounts. The most serious instance is a stored XSS that any free account can plant ([C-01](#c-01-stored-xss-via-the-custom-draft-format-html-field)).
2. **Some JSON APIs skip authorization.** Three draft-submit endpoints let any logged-in user overwrite other users' drafts. Records import writes into other cubes. About ten read endpoints return private-cube data without the `isCubeViewable` check that the rest of the code uses.
3. **Unbounded input lets a single request take the service down.**
   - **With no account at all**, a search filter of under 150 characters makes the card-filter parser exhaust the V8 heap and kill the process (H-10). Inputs of a few hundred characters block the event loop for seconds.
   - Any logged-in user can also:
     - pollute `Object.prototype` for the whole Node process, which turns every later request on that instance into a 500 (verified);
     - crash the process with an enormous import quantity;
     - make the server fetch and decode arbitrary remote "images" with no size, time or host limits, through an **unauthenticated** route.
4. **CI and IAM privileges are far too broad in a shared AWS account.** The deploy job runs third-party `npm install` scripts while holding admin-equivalent AWS permissions and every production secret. A beta Lambda has `dynamodb:*` and S3 read/write on every resource in an account that dev, beta and prod share. All application secrets sit in plaintext in CloudFormation and Elastic Beanstalk configuration.
5. **Dependency debt is large but mostly not reachable.** `npm audit` reports 135 advisories (10 critical, 72 high), 56 of them in production dependency trees. Only two are clearly reachable from the internet: `compression` (memory-leak DoS) and `sharp`/libvips (decoding attacker-supplied images). Most of the rest sit in dev or build tooling, or in code paths this app doesn't use. The two runtime ones are cheap to fix.

### Fix this week

| # | Action | Closes |
|---|---|---|
| 1 | Stop rendering `format.html`, strip unknown keys from submitted formats, sanitize the podcast description, and allow only `http(s)` in `/leave?url=` | C-01, H-06, H-11 |
| 2 | Cap filter length at 500 characters in `makeFilter`, and exclude `(` and `)` from bare words in the grammar | H-10 |
| 3 | Require the current password for email changes and verify the new address. Set the cookie to `sameSite: 'lax', secure: true`. Add an Origin check on unsafe methods until real CSRF tokens land | H-01 |
| 4 | Allowlist board keys and integer indexes in `/cube/api/commit`; add a JSON reviver that drops `__proto__` | H-02 |
| 5 | Add owner checks to `submitdraft`, `submitgriddraft` and `submithousmandraft`, or delete the dead route | H-03 |
| 6 | Cap the import count per line and in total | H-05 |
| 7 | Restrict pack-image fetches to an allowlist of image hosts, with a timeout, a byte cap and a pixel limit; rate-limit those routes | H-04 |
| 8 | Upgrade `compression` to 1.8.2 and `sharp` to 0.35.5; delete the unused `@tensorflow/tfjs-node` from the server | H-09 |
| 9 | Scope the DailyJobs Lambda IAM policy; split the deploy CodeBuild job so third-party code never runs with deploy credentials | H-07, H-08 |
| 10 | Strip `token` from public user objects | M-01 |

---

## 2. Ranked findings

Rank orders findings by real-world risk: likelihood multiplied by impact, given the current deployment. The Medium and Low tiers are coarser than the top ten.

| Rank | ID | Title | Severity | Who can exploit | Area |
|---|---|---|---|---|---|
| 1 | C-01 | Stored XSS through the custom draft format `html` field | **Critical** | Any registered user | Client / server |
| 2 | H-01 | CSRF protection disabled, plus email change without re-authentication, allows account takeover | **High** | Anyone (victim visits a page) | Server |
| 3 | H-10 | Card-filter parser complexity DoS: under 150 characters kills the process | **High** | Anyone, unauthenticated | Utils / server |
| 4 | H-02 | Process-wide prototype pollution in `/cube/api/commit` | **High** | Any registered user | Server |
| 5 | H-11 | Reflected XSS through a `javascript:` URL on `/leave` | **High** | Anyone (victim clicks twice) | Server / client |
| 6 | H-04 | Unauthenticated SSRF and resource exhaustion through card `imgUrl` in pack-image rendering | **High** | Anyone (setup needs a free account) | Server |
| 7 | H-05 | Unbounded import quantity crashes the server process | **High** | Any registered user | Server |
| 8 | H-03 | Draft-submit endpoints let any user overwrite other users' drafts | **High** | Any registered user | Server |
| 9 | H-07 | Deploy CodeBuild runs third-party install scripts with admin-equivalent AWS access and every production secret | **High** | Supply-chain attacker | CI/CD |
| 10 | H-09 | Internet-reachable vulnerable dependencies (`compression` CVE-2026-87776, `sharp`/libvips) | **High** | Anyone | Dependencies |
| 11 | H-06 | Stored XSS through the podcast RSS description | **High** | Content-creator role | Client / server |
| 12 | H-08 | DailyJobs Lambda has `dynamodb:*` and S3 access on `*` in the shared account | **High** | Anyone who compromises the Lambda | IaC |
| 13 | M-01 | Email-verification token exposed on public pages and APIs, so verification can be bypassed | Medium | Anyone | Server |
| 14 | M-02 | State-changing GET routes can be triggered same-origin through Markdown images (admin actions included) | Medium | Any registered user | Server / client |
| 15 | M-03 | About ten endpoints leak private-cube data (missing `isCubeViewable`) | Medium | Anyone with the ID | Server |
| 16 | M-04 | Ban enforcement can be bypassed | Medium | Banned users | Server |
| 17 | M-05 | No brute-force or abuse limits on login, password reset or verification | Medium | Anyone | Server |
| 18 | M-06 | Missing security headers (no CSP, no framing protection, no `nosniff`) | Medium | n/a (amplifier) | Server |
| 19 | M-07 | Open redirect after login through a `//host` referrer | Medium | Anyone | Server |
| 20 | M-08 | Records import writes to records in other cubes | Medium | Any registered user | Server |
| 21 | M-19 | Unvalidated custom-format index causes CPU and memory exhaustion | Medium | Any registered user | Server |
| 22 | M-09 | Passwords, API keys and tokens written to CloudWatch logs | Medium | Anyone with log access | Server |
| 23 | M-10 | Insecure fallbacks for missing secrets (`'default-secret'`, empty Patreon HMAC key) | Medium | Conditional | Server / IaC |
| 24 | M-11 | Client IP trusted from `CF-Connecting-IP`, but nothing in IaC restricts the origin to Cloudflare | Medium | Anyone (if the origin is reachable) | Server / IaC |
| 25 | M-12 | All application secrets stored in plaintext in CloudFormation, EB and Lambda configuration; deployer AWS keys copied into runtime | Medium | Anyone with AWS read access | IaC |
| 26 | M-13 | Production EB instances install npm dependencies at deploy time without a lockfile | Medium | Supply-chain attacker | Deploy |
| 27 | M-14 | GitHub OIDC role trusts any ref and can push the `latest` production jobs image | Medium | Anyone with repo push access | IaC / CI |
| 28 | M-15 | Integration-test CodeBuild role has `ecr:*` on `*` | Medium | Supply-chain attacker | IaC |
| 29 | M-16 | Unthrottled public ML endpoints in front of an unauthenticated recommender | Medium | Anyone | Server / recommender |
| 30 | M-17 | `coverage-comment` workflow trusts artifacts from untrusted PR runs | Medium | Fork PR author | CI |
| 31 | M-18 | reCAPTCHA verification request built without encoding the user-supplied token | Medium (low confidence) | Anyone | Server |
| 32+ | L-01 to L-22 | Low-severity items | Low | various | various |
| — | I-01 to I-11 | Informational items | Info | — | — |

**Totals:** 1 Critical, 11 High, 19 Medium, 22 Low, 11 Informational, plus the dependency advisories in §6.

---

## 3. Critical and High findings

### C-01 Stored XSS via the custom draft format `html` field

| Severity | CWE | Exploitable by | Confidence |
|---|---|---|---|
| **Critical** | CWE-79 | Any registered user, using their own cube | High (verified) |

**Where**
- Source: `packages/server/src/router/routes/cube/format/update.ts:24-87`. The handler `JSON.parse`s `req.body.formats` and checks only `title` and `packs`. It then saves each format object as-is: `cube.formats = formats`. Any extra key is persisted, including `html`.
- `packages/utils/src/datatypes/Draft.ts:40` still declares `html?: string` on `DraftFormat`.
- Sink: `packages/client/src/components/CustomDraftCard.tsx:49` renders `<div dangerouslySetInnerHTML={{ __html: format.html ?? '' }} />` whenever `format.markdown` is empty.
- This is reached from the public playtest page, `GET /cube/playtest/:id` (`routes/cube/playtest.ts`), which is the default practice-draft view and is viewable anonymously for public cubes.

**Impact**

A free account creates a cube and saves a custom format whose `html` field contains script. That script runs on `cubecobra.com` for every visitor to the cube's playtest page. Admins are among those visitors when they review reported cubes. Nothing contains the payload:
- there is no CSP;
- requests from the injected script are same-origin, so they carry the victim's session;
- `POST /user/updateemail` needs no password (H-01).

The script can therefore change the victim's email and trigger a password reset, taking over the account. Taking over an admin account gives full site compromise.

**Fix**

1. Remove the raw-HTML branch from the client; `html` is a legacy field. If old formats still need it, render it through a sanitizer:
   ```tsx
   // CustomDraftCard.tsx
   {format.markdown ? <Markdown markdown={format.markdown} /> : null}
   ```
2. Whitelist and type-check format fields on the server so unknown keys can never be stored:
   ```ts
   // format/update.ts, after JSON.parse
   formats = formats.map((f: any) => ({
     title: String(f.title).slice(0, 200),
     markdown: typeof f.markdown === 'string' ? f.markdown.slice(0, 20_000) : undefined,
     multiples: !!f.multiples,
     defaultSeats: Number.isInteger(f.defaultSeats) ? Math.min(Math.max(f.defaultSeats, 2), 16) : 8,
     basicsBoard: typeof f.basicsBoard === 'string' ? f.basicsBoard : undefined,
     packs: f.packs, // and validate pack/slot shape and maximum counts here (see H-04)
   }));
   ```
3. Remove `html` from the `DraftFormat` type.
4. Run a one-off scan of stored cubes for formats that have a non-empty `html` and either migrate it to `markdown` or delete it. A payload may already be stored.
5. The defense-in-depth measures in H-01 and M-06 (CSP, re-authentication for email changes) would turn the next XSS from an account takeover into a nuisance.

---

### H-01 CSRF protection disabled, plus email change without re-authentication, allows account takeover

| Severity | CWE | Exploitable by | Confidence |
|---|---|---|---|
| **High** | CWE-352, CWE-620, CWE-1275 | Anyone who can get a logged-in user to visit a web page | High |

**Where**
- `packages/server/src/router/middleware.ts:61-75`: `csrfProtection` has `csurf()` commented out. The only remaining check is a `nickname` honeypot, which a forged request simply leaves out. It sets `res.locals.csrfToken = ''`.
- `packages/server/src/index.ts:208-231` (session config): `cookie: { maxAge }` only. There is no `sameSite`, no `secure`, and the secret falls back to `'default-secret'` (see M-10).
- `packages/server/src/index.ts:128-133`: urlencoded bodies are parsed globally, so a cross-site HTML form post reaches every handler.
- `packages/server/src/router/routes/user/updateemail.ts:7-33`: sets `user.email = req.body.email` with:
  - no current-password check;
  - no email-format validation;
  - no re-verification (the `emailVerified` flag is left as is);
  - no notice to the old address.
- `packages/server/src/router/routes/user/lostpassword.ts:13-46`: mails the reset link to the stored email.

**Impact**

A cookie with no `SameSite` attribute is sent on cross-site POSTs in Firefox and Safari, which do not default to Lax. Chrome also sends it for two minutes after login (the "Lax+POST" window). A malicious page can therefore submit a hidden form that changes a logged-in victim's email. The attacker then requests a password reset to their own address. This works against any user, including admins.

Other POST routes that can be forged the same way:
- `updateuserinfo` (rename, profile Markdown)
- `changedisplay`
- `queuefeatured` / `unqueuefeatured`
- `clearnotifications`
- `login` (login-CSRF)
- cube settings and format updates

`deleteaccount` and change-password are not forgeable because they require the password. JSON-only routes are protected only incidentally, because the CORS preflight blocks them.

**Fix**

1. **Email change:** require the current password. Store a `pendingEmail` with a random token and swap it in only once the user clicks the link sent to the new address. Notify the old address.
   ```ts
   handler: [ensureAuth, body('email').isEmail().isLength({ max: 254 }), body('password').notEmpty(), flashValidationErrors, handler]
   // handler: bcrypt.compare(password, user.passwordHash) → set pendingEmail/pendingEmailToken (crypto.randomBytes(32)) → email both addresses
   ```
2. **Cookie:**
   ```ts
   cookie: { maxAge: 30 * 864e5, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
   ```
3. **Immediate CSRF backstop:** reject unsafe methods whose `Origin` (or, failing that, `Referer`) is not the site, for cookie-authenticated requests:
   ```ts
   app.use((req, res, next) => {
     if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || isWebhookPath(req.path)) return next();
     const src = req.get('origin') ?? req.get('referer');
     try { if (src && [process.env.DOMAIN, `www.${process.env.DOMAIN}`].includes(new URL(src).host)) return next(); } catch {}
     return res.status(403).send('Cross-site request blocked');
   });
   ```
4. **Proper fix:** put real synchronizer or double-submit tokens back. `csurf` is deprecated and archived; use `csrf-csrf` (4.x) or `csrf-sync`. Wire the token into `csrfFetch` and every form, and remove the `csurf` dependency.
5. Move every state-changing GET to POST (see M-02).

---

### H-02 Process-wide prototype pollution in `/cube/api/commit`

| Severity | CWE | Exploitable by | Confidence |
|---|---|---|---|
| **High** | CWE-1321 | Any registered user, using their own cube | High (reproduced) |

**Where**

`packages/server/src/router/routes/cube/api/commit.ts:71-101`. The handler iterates `Object.entries(changes)`, where `changes` comes from the JSON body, and uses each key as a board name with no allowlist:
- `(cards as any)[board][swap.index] = swap.card` (line 83)
- the `edits` spread (line 89)

`JSON.parse` keeps `"__proto__"` as an ordinary own key. So `cards["__proto__"]` resolves to `Object.prototype`, and the write goes onto the global prototype with an attacker-chosen property name and value. The only gates are `isCubeEditable` and the version check, and both pass on the attacker's own cube.

**Impact**
- **Process-wide denial of service.** Overwriting a built-in such as `toString` makes every later request on that Node instance fail, including `/healthcheck`. Load-balancer health checks then fail and instances get recycled. Repeating the request takes the site down. One reviewer verified this end to end with the repo's own express, body-parser and qs.
- **Logic corruption.** Any `if (obj.someFlag)` check on an object that lacks its own `someFlag` now sees the polluted value.
- **Privilege escalation:** checked, and not currently possible through `roles`, because `UserDynamoDao` always sets `roles` as an own property (`UserDynamoDao.ts:144`). Third-party gadgets in libraries loaded by the server (template engines, HTTP clients) were not exhaustively ruled out.

**Fix**
```ts
// commit.ts — before applying anything
const validBoards = new Set(getBoardDefinitions(cube, cards).map((b) => boardNameToKey(b.name)));
for (const board of Object.keys(changes)) {
  if (board === 'version') continue;
  if (!validBoards.has(board)) return res.status(400).send({ success: 'false', message: 'Invalid board' });
  const list = cards[board] ?? [];
  for (const op of [...(changes[board].swaps ?? []), ...(changes[board].edits ?? []), ...(changes[board].removes ?? [])]) {
    if (!Number.isInteger(op.index) || op.index < 0 || op.index >= list.length) {
      return res.status(400).send({ success: 'false', message: 'Invalid index' });
    }
  }
}
```
Defense in depth, applied globally:
```ts
// index.ts
const dropProto = (k: string, v: unknown) => (k === '__proto__' || k === 'constructor' || k === 'prototype' ? undefined : v);
app.use(bodyParser.json({ limit: '1mb', reviver: dropProto, verify: ... }));
```
Also start Node with `--disable-proto=delete` (in `server.js`'s `forever` command and the recommender).

**Related:** board names are user-defined, and `boardNameToKey`/`validateBoardDefinitions` (`packages/utils/src/datatypes/Cube.ts:101-142`) accept reserved keys such as `__proto__`, `constructor` and `prototype`. Those keys reach bracket assignment in:
- `updateboardsandviews.ts:90`
- `updateboards.ts:64`
- `api/addtocube.ts:149-152`

No global pollution was found through these paths, but they corrupt the owner's own cube. Reject reserved names in `validateBoardDefinitions`, or keep card containers in `Object.create(null)` objects or a `Map`.

---

### H-03 Draft-submit endpoints let any user overwrite other users' drafts

| Severity | CWE | Exploitable by | Confidence |
|---|---|---|---|
| **High** | CWE-639, CWE-862, CWE-915 | Any registered user | High (verified) |

**Where**
- `packages/server/src/router/routes/cube/api/submitdraft.ts:26`: the seat to update is found with `owner.id === req.body.owner`. The owner ID is supplied by the client and never compared with `req.user.id`. The handler then overwrites the seat's mainboard, sideboard, pick order and trash order, and sets `draft.complete = true`. The client no longer calls this route, but it is still registered.
- `packages/server/src/router/routes/cube/api/submitgriddraft.ts:32-38` and `submithousmandraft.ts:32-40`: these sit behind `ensureAuth` only. They load any draft by ID, check its type, then run `draft.seats = req.body.seats; draft.complete = true` and save. The client therefore controls the whole seats array, including seat `owner`, `name` and decks.

**Impact**

Draft IDs and owner IDs are public (deck pages, `/user/decks/:id`, cube deck lists). Any logged-in user can:
- rewrite anyone's deck;
- attribute decks to other users;
- mark in-progress drafts complete;
- corrupt Housman logs.

That destroys the integrity of the deck and draft history the site shows publicly.

**Fix**
- Delete `submitdraft.ts` (dead code).
- In the grid and Housman handlers:
  ```ts
  const ownerId = typeof draft.owner === 'string' ? draft.owner : draft.owner?.id;
  if (ownerId !== req.user!.id) return res.status(403).send({ success: 'false', message: 'Unauthorized' });
  if (draft.complete) return res.status(409).send({ success: 'false', message: 'Draft already submitted' });
  if (!Array.isArray(req.body.seats) || req.body.seats.length !== draft.seats.length) return res.status(400).send(...);
  draft.seats = draft.seats.map((seat, i) => ({
    ...seat,                                   // keep server-side owner, bot, name
    mainboard: validateBoard(req.body.seats[i].mainboard),
    sideboard: validateBoard(req.body.seats[i].sideboard),
    pickorder: validateIndexList(req.body.seats[i].pickorder),
  }));
  ```

---

### H-04 Unauthenticated SSRF and resource exhaustion through card `imgUrl` in pack-image rendering

| Severity | CWE | Exploitable by | Confidence |
|---|---|---|---|
| **High** | CWE-918, CWE-400, CWE-409 | Anyone can trigger it; setup needs a free account | High (verified) |

**Where**
- `packages/server/src/serverutils/imageUtils.ts:53`: the tile source is `card.imgUrl || details.image_normal`.
- `imageUtils.ts:95-101`: `fetch(source.src)` runs with:
  - no scheme, host or IP restriction;
  - redirects followed;
  - no timeout;
  - `res.arrayBuffer()` with no size cap, and undici transparently decompresses gzip;
  - `sharp(buf)` with no format allowlist (SVG goes through librsvg) and the default pixel limit.
- `imgUrl` can be set to anything by a cube editor: `cube/api/addtocube.ts:97-98` and CSV import at `serverutils/cubefn.ts:335`.
- Unauthenticated triggers:
  - `GET /cube/samplepackimage/:id/:seed` (`routes/cube.ts:444-481`, route `:652-655`). There is no rate limit, and a fresh `seed` defeats the cache.
  - `GET /cube/p1p1packimage/:packId` (`cube.ts:538-566`).
- Pack size is not capped: `cube/format/update.ts:37-47` only checks that packs exist. A huge custom pack means hundreds of parallel fetches and a very large composite image.
- `serverutils/cubefn.ts:538` uses `new NodeCache({ maxKeys: 10000 })`. Once full, `set()` throws `ECACHEFULL`, so pack images break site-wide.

**Impact**
- **Memory and CPU exhaustion.** Decompression bombs, enormous images and slow endpoints, each multiplied by the pack size, will OOM-kill the single Node process on each web instance. `forever` then restarts it with a full card-catalog reload.
- **Internal network probing.** The server will fetch internal addresses: VPC hosts, the recommender's internal ALB, localhost. Error-versus-blank-tile behavior and timing reveal what is listening there.
- Cloud-credential theft through instance metadata is mitigated, because AL2023 EB platforms disable IMDSv1 by default and non-image responses become blank tiles. Confirm IMDSv2 is enforced (`HttpTokens=required`) on the launch template.
- Because untrusted bytes go straight to libvips, this is also the network-reachable path for the `sharp` CVEs (H-09).

**Fix**
```ts
const ALLOWED_HOSTS = new Set(['cards.scryfall.io', 'i.imgur.com', hostOf(process.env.CDN_BASE_URL), /* … */]);
const MAX_BYTES = 5 * 1024 * 1024;

async function fetchTile(src: string, width: number, height: number) {
  const url = new URL(src);
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.host)) throw new Error('host not allowed');
  const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { 'User-Agent': UA } });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const chunks: Uint8Array[] = []; let total = 0;
  for await (const chunk of res.body as any) { total += chunk.length; if (total > MAX_BYTES) throw new Error('too large'); chunks.push(chunk); }
  const img = sharp(Buffer.concat(chunks), { limitInputPixels: 25_000_000 });
  const { format } = await img.metadata();
  if (!['jpeg', 'png', 'webp', 'gif'].includes(format ?? '')) throw new Error('unsupported format');
  return img.resize({ width, height }).toBuffer();
}
```
- If arbitrary hosts must stay allowed, resolve DNS first, reject private, loopback, link-local and CGNAT ranges, and pin the resolved IP through an undici `Agent` `connect.lookup` hook so DNS rebinding can't swap it.
- Validate `imgUrl` on write as an `https:` URL with a maximum length.
- Cap the cards per rendered pack (e.g. 30) and the slots per custom format.
- Put an IP rate limiter on both image routes.
- Replace the `NodeCache` promise cache with a byte-bounded LRU that evicts instead of throwing.

---

### H-05 Unbounded import quantity crashes the server process

| Severity | CWE | Exploitable by | Confidence |
|---|---|---|---|
| **High** | CWE-770, CWE-400 | Any registered user | High (verified) |

**Where**
- `packages/server/src/serverutils/importParsing.ts:35,45-48`: the count group `(\d+)` has no length limit, and `count` is only checked to be at least 1.
- `packages/server/src/serverutils/cube.ts:219`: `for (let i = 0; i < count; i++) { added.push(details); … }`.
- Reached through `POST /cube/bulkupload/:id` and `POST /cube/bulkuploadfile/:id`, which need only edit rights on the attacker's own cube.
- `packages/server/src/router/routes/cube/deck.ts:739-746` (`uploaddecklist`) has the same pattern. Its regex is also unanchored and re-queues the remainder of a line, so expansion compounds.

**Impact**

A single line with a huge count makes the server allocate billions of array slots synchronously. The event loop blocks, the process hits the 6 GB heap limit and crashes, and every user on that instance is affected. A few requests in a row cause a site-wide outage.

**Fix**
```ts
// importParsing.ts
const match = line.match(/^(?:(\d{1,4})[xX]?\s+)?(.+?)(?:…)?$/);
let count = Math.min(parseInt(match[1] || '1', 10) || 1, 100);
// cube.ts: keep a running total and abort once it exceeds the cube card limit
if (added.length + count > MAX_CARDS_PER_IMPORT) throw new UserError('Import too large');
```
In `deck.ts`, anchor the regex (`/^(\d{1,3})x?\s+(.*)$/`) and don't feed expansions back into the list being parsed.

---

### H-06 Stored XSS through the podcast RSS description

| Severity | CWE | Exploitable by | Confidence |
|---|---|---|---|
| **High** | CWE-79 | A user with the CONTENT_CREATOR role, which needs admin approval | High (verified) |

**Where**
- `packages/server/src/router/routes/content.ts:554-556` (edit) and `:670-672` (submit) store `fields.description` from `getFeedData(rss)` (`serverutils/rss.ts`) without sanitizing it. It is persisted as `short` (`PodcastDynamoDao.ts:75,99`).
- `packages/client/src/components/content/Podcast.tsx:40` renders it with `dangerouslySetInnerHTML`. Episode bodies, by contrast, do go through `sanitize-html` (`serverutils/podcast.ts:8-11`).
- `content.ts:260-293` (`podcastHandler`) renders podcasts in any status to anyone (see L-10). A draft can therefore be shared, and admins open it during review.

**Impact**

The impact is the same as C-01: script runs on the main origin, which means account takeover, including of the reviewing admin. The precondition is a content-creator account, which lowers the likelihood.

**Fix**

Sanitize at ingest in both handlers, or better, render the description as plain text:
```ts
description: sanitizeHtml(fields.description ?? '', {
  allowedTags: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['https', 'http', 'mailto'],
}),
```
Also sanitize again at render time. Restrict non-published podcasts to the owner and admins (L-10). Re-sanitize the existing stored descriptions.

---

### H-07 Deploy CodeBuild runs third-party install scripts with admin-equivalent AWS access and every production secret

| Severity | CWE | Exploitable by | Confidence |
|---|---|---|---|
| **High** | CWE-829, CWE-250, CWE-1357 | Anyone who compromises any package in the dependency tree | High (verified in source and `cdk.out`) |

**Where** (`packages/cdk/lib/deployment-pipeline.ts`)
- `:90` and `:362`: `npm install`, not `npm ci`, with lifecycle scripts enabled. The lockfile has 27 packages with install scripts.
- `:236-252` and `:508-524`: `sts:AssumeRole`, `iam:PassRole`, `cloudformation:*`, `ec2:*`, `elasticbeanstalk:*`, `s3:*`, `acm:*`, `cloudfront:*`, `route53:*`, all on `Resource: *`. The `acm`, `cloudfront` and `route53` grants are stale: the CloudFront assets stack was removed.
- `:159-231` and `:426-503`: every production secret (Stripe, session, Patreon, R2, captcha) is injected into the build environment from SSM.
- `:76` and `:348`: `privileged: true`.

**Impact**

A malicious `preinstall` or `postinstall` in any dependency, whether direct or transitive, runs in the same process tree as the deploy step. This is exactly how the 2025 "Shai-Hulud" npm worm harvested CI cloud credentials. From there it can:
- read the container credentials;
- use `sts:AssumeRole *` to assume the CDK deploy role (CloudFormation with an admin execution role), which amounts to account takeover;
- separately use `iam:PassRole *` plus `ec2:*` to launch an instance with any role;
- read every production secret straight from the environment.

**Fix**
1. Split into an **unprivileged build project** (no secrets, minimal role, scripts allowed if needed) that emits artifacts, and a **deploy project** that runs only `cdk deploy` and the S3 uploads from those artifacts.
2. In anything privileged, use `npm ci --ignore-scripts`, then `npm rebuild <vetted-native-pkgs>`.
3. Scope the role:
   ```ts
   new iam.PolicyStatement({ actions: ['sts:AssumeRole'], resources: [`arn:aws:iam::${account}:role/cdk-hnb659fds-*-${account}-*`] }),
   new iam.PolicyStatement({ actions: ['s3:PutObject'], resources: ['arn:aws:s3:::cubecobra/builds/*', 'arn:aws:s3:::cubecobra/*Lambda/*'] }),
   // drop iam:PassRole *, ec2:*, cloudfront:*, acm:*, route53:*  — cdk deploy does these through the bootstrap roles
   ```
4. Fetch secrets at runtime instead (M-12), so the build never holds them.

---

### H-08 DailyJobs Lambda has `dynamodb:*` and S3 access on `*` in the shared account

| Severity | CWE | Exploitable by | Confidence |
|---|---|---|---|
| **High** | CWE-250, CWE-732 | Anyone who compromises the Lambda (it parses third-party RSS), or a bug in it | High (verified) |

**Where**

`packages/cdk/lib/daily-jobs-lambda.ts:44-57`: `actions: ['dynamodb:*'], resources: ['*']` and `['s3:GetObject','s3:PutObject','s3:ListBucket'], resources: ['*']`. The same appears in `cdk.out/CubeCobraBetaStack.template.json`.

**Impact**

Dev, beta and prod share one AWS account. The **beta** Lambda can therefore:
- call `DeleteTable` on the production table (`RETAIN` protects only against CloudFormation deletes);
- read the CDK asset and pipeline artifact buckets, which contain plaintext secrets (M-12);
- overwrite `s3://cubecobra/builds/*.zip`, which may poison later EB instance launches.

The table also has no point-in-time recovery or deletion protection defined in IaC (L-15), so the damage could be unrecoverable.

**Fix**
```ts
props.table.grantReadWriteData(executionRole);   // pass the stage's Table construct in
executionRole.addToPolicy(new iam.PolicyStatement({
  actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
  resources: [`arn:aws:s3:::${env.DATA_BUCKET}`, `arn:aws:s3:::${env.DATA_BUCKET}/*`],
}));
```
Longer term, move prod into its own AWS account (Organizations) so a beta compromise can't reach prod at all.

---

### H-09 Internet-reachable vulnerable dependencies

| Severity | Exploitable by | Confidence |
|---|---|---|
| **High** | Anyone | High |

Only two of the 56 production-tree advisories are clearly reachable from the internet in the current code. Both are cheap to fix. The full analysis is in [§6](#6-dependency-vulnerabilities-sca).

| Package | Installed | Advisory | Reachable via | Fix |
|---|---|---|---|---|
| `compression` | 1.8.1 | **CVE-2026-87776** (GHSA-vc2v-76pw-4v95): the zlib stream leaks when a client aborts a compressed response | `app.use(compression())` in `server/src/index.ts:73` and in the recommender; every response | `compression@^1.8.2` |
| `sharp` | 0.34.5 | GHSA-f88m-g3jw-g9cj (libvips **CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591**), GHSA-rgj7-g3m4-5g8c (libheif), GHSA-wq5f-xc86-pv6w (librsvg **CVE-2026-96889**) | Attacker-chosen bytes decoded in `imageUtils.ts` (H-04, any format including SVG) and in hosted-image upload (patrons) | `sharp@^0.35.5` (0.x minor bump, so check the API changelog) |

Also remove `@tensorflow/tfjs-node` from `packages/server/package.json`. Nothing in `packages/server/src` imports it (ML moved to the recommender). It is what pulls `tar` (12 advisories, including path-traversal file overwrite), `adm-zip` (8) and `@mapbox/node-pre-gyp` into **every production EB instance's `npm install`, which runs as root** (M-13).

---

### H-10 Card-filter parser: algorithmic-complexity DoS, unauthenticated and able to crash the process

| Severity | CWE | Exploitable by | Confidence |
|---|---|---|---|
| **High** | CWE-400, CWE-1333 | Anyone, unauthenticated | High (measured) |

**Root cause**
- `packages/utils/nearley/values.ne:493-501`: the `noQuoteStringValue` character classes don't exclude `(` and `)`. A bare word can therefore absorb a parenthesis, so the grouping rules in `filterBase.ne:31-37` become ambiguous. The number of parse trees grows like the Catalan numbers with the count of parenthesized bare-word groups.
- The `[...]:*` repetition with a `concat().join()` postprocessor makes every token quadratic in its length.
- `packages/utils/src/filtering/FilterCards.ts:55-70` (`makeFilter`) has no length cap. Nearley materializes **every** parse tree before the `results.length === 1` check.

**Measured** (the reviewer's figures, partially re-run for this report)

| Input shape | Size | Result |
|---|---|---|
| Parenthesized bare-word groups | 10 groups (66 chars) | 58,786 parses, 0.87 s, 251 MB heap |
| Parenthesized bare-word groups | 20 groups (~140 chars) | **Fatal V8 OOM** (uncatchable, kills the process) |
| Same groups, inner terms quoted | 356 chars | 1 parse in 25 ms (confirms the root cause) |
| Nested balanced parentheses | 101 / 201 / 401 / 1,001 chars | 0.08 s / 0.49 s / 3.7 s / 92.6 s of blocked event loop |
| Single quoted token | 10k / 20k / 30k chars | 0.95 s and 422 MB / 3.5 s and 1.6 GB / OOM |

**Where untrusted filter strings enter** (no auth, no length limit):
- `GET /tool/searchcards/csv?f=` (`routes/tool/searchcards.ts:52`)
- `GET /tool/api/searchcards?f=` (`tool/api/searchcards.ts:12`)
- `tool/api/topcards.ts:33` (its Joi schema at `:12` has no `.max()`)
- `?filter=` on any public cube download (`cube/download.ts:38`)
- `POST /cube/api/adds` (`cube/api/adds.ts:53`), where parsing runs before any lookup and the body may be up to 50 MB
- `POST /cube/api/cuts` (`cube/api/cuts.ts:29`)

The client runs the same parser on the `?f=` URL parameter, so a crafted link can also freeze a victim's tab (Low).

**Impact:** a single anonymous request of under 150 characters kills a web server process. A handful of them, sent in a loop across instances, takes the site down. This is the cheapest denial of service in the codebase.

**Fix**
1. Exclude `(` and `)` from the `noQuoteStringValue` character classes, so names containing parentheses must be quoted. Add a regression test asserting `parser.results.length <= 1` for parenthesized inputs. As the reviewer noted, this ambiguity probably also breaks some legitimate parenthesized queries today.
2. Move tokenization to a `moo` lexer, so strings become single tokens instead of per-character parses.
3. Hard cap in `makeFilter` (and a matching `.max(500)` in every Joi or validator schema that accepts a filter):
   ```ts
   if (filterText.length > 500) return { err: 'Filter too long', filter: null };
   ```
4. Defense in depth: run server-side parses in a `worker_threads` pool with `resourceLimits` and a timeout, and put an IP rate limit on the search endpoints.
5. Lower the global body limit (L-12).

---

### H-11 Reflected XSS through a `javascript:` URL on the leave-warning page

| Severity | CWE | Exploitable by | Confidence |
|---|---|---|---|
| **High** | CWE-79, CWE-601 | Anyone, unauthenticated; the victim must follow a link and click "Yes, continue" | High (verified) |

**Where**
- `packages/server/src/router/routes/leave.ts:5-8` passes `req.query.url` unvalidated to the `LeaveWarningPage`.
- `packages/client/src/pages/LeaveWarningPage.tsx:34` renders it as `<Button href={url}>` (an `<a href>`). React 18.3.1 still renders `javascript:` hrefs (it only warns). There's no CSP (M-06).

**Impact:** a crafted `cubecobra.com/leave?url=…` link shows a genuine CubeCobra page. If the victim clicks the button, script runs on the main origin, with the same account-takeover chain as C-01 (email change without a password). It also works as a plain open redirect.

**Fix**

Validate on both server and client:
```ts
// leave.ts
let safe: string | null = null;
try { const u = new URL(String(req.query.url)); if (u.protocol === 'http:' || u.protocol === 'https:') safe = u.href; } catch {}
if (!safe) return render(req, res, 'ErrorPage', { title: 'Invalid link' });
return render(req, res, 'LeaveWarningPage', { url: safe });
```
In the client, also refuse to render the button unless `/^https?:\/\//i.test(url)`. Consider a shared `safeHref()` helper in the `Button`/`Link` components for every user-derived `href`.

---

## 4. Medium findings

### M-01 Email-verification token exposed on public pages and APIs, so verification can be bypassed
- **CWE:** CWE-200 → CWE-287/CWE-640. **Exploitable by:** anyone. **Confidence:** High (verified).
- **Where:**
  - `packages/server/src/dynamo/dao/UserDynamoDao.ts:154` stores `token`. `stripSensitiveData` (`:177-186`) removes only `passwordHash` and `email`, so `token` and `emailVerified` stay in every hydrated user object.
  - Those objects are serialized into page props (`user/view.ts:43-44` → `render.ts`), into cube and comment owners, and returned in full by the unauthenticated `GET /api/user/getByUsername/:username` (`routes/api/user/getByUsername.ts:15-22`).
  - `register.ts:138` checks `user.token !== req.params.token`. The token is a uuid that is never rotated or cleared.
- **Impact:** anyone can register with an email address they don't own, read their own token from a public endpoint and "verify" it. This allows:
  - impersonating addresses (staff, publishers);
  - squatting a real person's email, since registration rejects duplicates;
  - mass sign-ups past the email gate.
- **Fix:**
  - Add `delete sanitized.token; delete sanitized.emailVerified;` to `stripSensitiveData`.
  - Read the token only through `getByIdWithSensitiveData` (`resendverification.ts:36`).
  - Generate it with `crypto.randomBytes(32)`, give it an expiry, clear it on use, and compare with `timingSafeEqual`.
  - `getByUsername` should return `{ id, username, image }` only.
  - Longer term, define one explicit **public user projection** for every response that embeds another user. `roles`, `patron`, `consentToHashedEmail` and `dateCreated` leak the same way today.

### M-02 State-changing GET routes can be triggered same-origin through Markdown images (admin actions included)
- **CWE:** CWE-352, CWE-650. **Exploitable by:** any user who can post Markdown (comments, blog posts, profile about text, cube primers). **Confidence:** High.
- **Where:** `packages/client/src/components/Markdown.tsx:50-52` renders `<img src={node.src}>` with no URL filtering, in both full and `limited` modes. The browser loads the image as a same-origin request with the viewer's cookies, so SameSite doesn't help, and there's no CSP `img-src`.
- **State-changing GET routes** (non-exhaustive):

  | Route | Location | Effect on a viewer |
  |---|---|---|
  | `/patreon/unlink` | `patreon.ts:379` | Removes the viewer's Patreon link and PATRON role |
  | `/cube/blog/remove/:id` | `cube/blog.ts:325` | Deletes the viewer's own blog post when they look at a comment on it |
  | `/cube/format/remove/:cubeid/:i`, `/cube/:id/defaultdraftformat/:n` | `format.ts:101`, `cube.ts:588` | Changes the owner's formats |
  | `/cube/feature/:id`, `/cube/unfeature/:id` | `cube.ts:643,648` | Admin-only: features a cube when an admin views it |
  | `/admin/publish/:id` | `admin/publish.ts:75` | Admin-only: publishes in-review content when an admin previews it |
  | `/user/follow/:id`, `/user/unfollow/:id` | `user/follow.ts:50`, `user/unfollow.ts` | Follower farming |
  | `/user/report/:id`, `/cube/report/:id` | | Report flooding, or framing a user for a ban |
  | `/packages/upvote/:id`, `/packages/downvote/:id` | `packages.ts:688` | Vote stuffing |
  | `/cube/clone/:id` | `cube/clone.ts:95` | Mass cloning |
  | `/user/logout` | | Forced logout |
  | `/admin/{banuser,application/approve,…}/:id` | | Keyed by random notice IDs, so only exploitable if an ID leaks |

- **Fix:**
  1. Make every one of these POST (or DELETE), called through `csrfFetch` behind the H-01 CSRF controls.
  2. In `renderImage`, drop relative and same-origin `src` values, or route user images through `/tool/imageproxy`:
     ```tsx
     const safeImgSrc = (src?: string) => {
       try { const u = new URL(src ?? '', window.location.origin);
             if (!/^https?:$/.test(u.protocol) || u.origin === window.location.origin) return undefined;
             return u.href; } catch { return undefined; }
     };
     ```
  3. Add a CSP `img-src` allowlist (M-06).

### M-03 About ten endpoints leak private-cube data (missing `isCubeViewable`)
- **CWE:** CWE-862, CWE-639. **Exploitable by:** anyone who has the cube, draft or pack ID. IDs leak through L-07, and former collaborators keep them. **Confidence:** High.

  | Endpoint | Location | What leaks |
  |---|---|---|
  | `POST /cube/getmorechangelogs` | `routes/cube.ts:215-231` | Full changelog of any cube |
  | `POST /api/private/changelog` | `routes/api/private.ts:9,27` | Any changelog body (no callers, so delete it) |
  | `POST /cube/api/cuts` | `routes/cube/api/cuts.ts:20-46` | Effectively the whole mainboard |
  | `POST /cube/getmoredecks/:id` | `routes/cube.ts:233-250` | Deck IDs, seat names, owners |
  | `GET /cube/deck/download/*/:id/:seat` (8 formats) | `routes/cube/deck.ts:19,89,161,198,221,290,358,434` | Full decklists |
  | `POST /cube/records/list/:id` | `routes/cube/records/list.ts:17,34` | All records (players, matches) |
  | `POST /tool/api/getmorep1p1s/:cubeId` → `GET /tool/api/getp1p1/:packId` | `getmorep1p1s.ts:14`, `getp1p1.ts:31` | Pack contents |
  | `GET /cube/p1p1/:packId` | `routes/cube.ts:485-531` | Renders the whole private cube object |
  | `GET /tool/cardimageforcube/:card/:cubeId` | `routes/tool/cardimageforcube.ts:16` | Card-membership oracle |
  | `POST /cube/api/adds` | `routes/cube/api/adds.ts:66` | Weak membership signal |

- **Fix:** apply one guard to all of these, using the loaded `cube.id` and never the raw parameter. For deck, P1P1 and record routes, load the parent cube first.
  ```ts
  const cube = await cubeDao.getById(id);
  if (!cube || !isCubeViewable(cube, req.user)) return res.status(404).send({ success: 'false' });
  ```
  Add a lint rule or a route-registration helper so every new `/cube/**` read route has to declare its visibility check.
- In `cuts` and `adds`, the raw body `cubeID` is also used directly as an S3 key (`CubeDynamoDao.ts:648`, `cube/${id}.json`). After the guard, pass the loaded `cube.id` instead, and validate IDs as UUIDs or short IDs at the route boundary.

### M-04 Ban enforcement can be bypassed
- **CWE:** CWE-285, CWE-613, CWE-696. **Exploitable by:** banned users. **Confidence:** High.
- **Where:**
  - `packages/server/src/index.ts:289-301` calls `req.session.destroy(cb)` and then calls `next()` straight away. `req.user` is still set, so the banned user's request is processed in full.
  - The callback then calls `req.flash` on a destroyed session, which throws. The redirect never happens, and an unhandled rejection is logged.
  - `config/passport.ts:10-47` and `user/login.ts` never check `UserRoles.BANNED`, so a banned user can just log in again for each request.
- **Fix:**
  ```ts
  app.use((req, res, next) => {
    if (!req.user?.roles?.includes(UserRoles.BANNED)) return next();
    return req.logout((err) => {                          // passport 0.7 regenerates the session
      if (err) return next(err);
      if (req.accepts(['html', 'json']) === 'json') return res.status(403).json({ error: 'Account banned' });
      req.flash('danger', 'Your account has been banned, …');
      return res.redirect('/');
    });                                                   // no next()
  });
  // passport.ts LocalStrategy, after loading the user:
  if (user.roles?.includes(UserRoles.BANNED)) return done(null, false, { message: 'This account has been banned.' });
  ```
- Separately, `admin/banuser.ts` doesn't delete the first page of the banned user's blog posts. Only pages fetched inside the `while (lastKey)` loop are deleted.

### M-05 No brute-force or abuse limits on login, password reset or verification
- **CWE:** CWE-307, CWE-770, CWE-400. **Exploitable by:** anyone. **Confidence:** High.
- **Where:**
  - `express-rate-limit` is used only on 12 cube, tool and api routes.
  - `user/login.ts`, `lostpassword.ts`, `passwordreset.ts`, `resendverification.ts`, `resetpassword.ts` and `deleteaccount.ts` have no limiter, lockout or captcha.
  - Hashing uses pure-JS `bcryptjs` at cost 10 (about 150 ms of main-thread CPU per attempt), so login attempts also make cheap CPU denial of service.
- **Impact:**
  - unlimited credential stuffing against known usernames;
  - unlimited reset and verification emails to any address (mail bombing, SES reputation damage);
  - event-loop stalls at roughly 10 requests per second per core.
- **Fix:** key limiters on IP plus the normalized identifier, after M-11 is fixed (otherwise the IP is spoofable):
  ```ts
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(clientIp(req))}:${String(req.body?.username ?? '').toLowerCase()}`,
    handler: (req, res) => { req.flash('danger', 'Too many attempts, try again later.'); redirect(req, res, '/user/login'); },
  });
  ```
  Apply limiters to lostpassword (keyed on email), resendverification and passwordreset as well. Consider native `bcrypt` or `argon2`, which run off the main thread.

### M-06 Missing security headers (no CSP, no framing protection, no `nosniff`)
- **CWE:** CWE-693, CWE-1021. **Exploitable by:** n/a, but it amplifies C-01, H-06 and M-02. **Confidence:** High.
- **Where:**
  - `packages/server/src/index.ts` sends only HSTS, and that without `includeSubDomains` (`:102`).
  - There's no `helmet`, no CSP, no `X-Frame-Options`/`frame-ancestors`, no `X-Content-Type-Options`, and no `Referrer-Policy`, and `X-Powered-By: Express` is left on.
  - The nginx config (`server/.platform/nginx/conf.d/`) only sets the body size.
  - No CloudFront or Cloudflare response-headers policy is defined in IaC.
- **Fix:**
  ```ts
  import helmet from 'helmet';
  app.disable('x-powered-by');
  app.use(helmet({
    frameguard: { action: 'sameorigin' },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    contentSecurityPolicy: { reportOnly: true, directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'", CDN, 'https://www.googletagmanager.com', 'https://www.google.com/recaptcha/', "'nonce-…'"],
      imgSrc: ["'self'", 'data:', CDN, 'https://cards.scryfall.io', 'https://i.imgur.com'], objectSrc: ["'none'"], baseUri: ["'self'"],
      frameAncestors: ["'self'"], formAction: ["'self'"] } },
  }));
  ```
  Start the CSP in report-only mode. The server-rendered props script in `render.ts` needs a nonce. Enforce the policy once violations stop.

### M-07 Open redirect after login through a `//host` referrer
- **CWE:** CWE-601. **Exploitable by:** anyone. **Confidence:** Medium. It depends on Cloudflare and nginx passing `//` paths through unchanged, which is the default for both.
- **Where:**
  - `packages/server/src/serverutils/util.ts:413-436`: `getSafeReferrer` checks `url.host` and then returns `url.pathname`. For a same-site URL whose path begins with `//` (or `/\`), the pathname is itself a protocol-relative URL (verified with Node's WHATWG URL parser).
  - `user/login.ts:8-17,49` uses it as passport's `successRedirect`, and so does `cube/blog.ts:25`.
- **Impact:** after a real login on cubecobra.com, the user can be bounced to a look-alike phishing page.
- **Fix:**
  ```ts
  const p = url.pathname;
  if (!p.startsWith('/') || p.startsWith('//') || p.startsWith('/\\')) return null;
  return p;
  ```

### M-08 Records import writes to records in other cubes
- **CWE:** CWE-639. **Exploitable by:** any registered user (on any cube they can edit, including one they just created). It needs the target record ID, which public record pages show. **Confidence:** High.
- **Where:** `packages/server/src/router/routes/cube/records/import.ts`.
  - Edit rights are checked against `req.params.id`, the caller's cube (`:89-109`).
  - The `recordId` comes from the body (`:112-113`) and is loaded at `:146` with no `record.cube === cube.id` check.
  - `associateNewDraft` and `associateWithExistingDraft` then re-point or fill the victim's record and draft (`:158`, `:168`, `:184`).
- **Fix:**
  ```ts
  const record = await recordDao.getById(recordId!);
  if (!record || record.cube !== cube.id) { req.flash('danger', 'Record not found'); return redirect(req, res, '/404'); }
  ```
  The sibling routes (`uploaddeck.ts`, `edit/*`, `remove.ts`) already derive the cube from `record.cube` correctly.

### M-09 Passwords, API keys and tokens written to CloudWatch logs
- **CWE:** CWE-532. **Exploitable by:** anyone with CloudWatch read access, which with the shared account and the broad roles in L-15 is a lot of principals. **Confidence:** High.
- **Where:** `packages/server/src/serverutils/logging.ts:1` redacts only the top-level `password` and `password2`. `router/router.ts:34` logs `sanitizeHttpBody(req.body)` and `originalUrl` for every request. Still logged:
  - `password3`, the new password on change-password;
  - `apiKey` for Draftmancer publish and for the ManaMatrix, crossword and synergyconnect rotations (several times a day from the daily-jobs Lambda);
  - the record-contribute `token`, from both body and query string;
  - the password-reset `code`;
  - email addresses.
- `index.ts:76` logs the **unsanitized** `JSON.stringify(req.body)` whenever a header is set after the response has been sent. The ban middleware (M-04) triggers exactly that.
- **Fix:**
  ```ts
  const SENSITIVE = /pass(word)?\d*|secret|token|api[-_]?key|^code$|captcha|authorization|email/i;
  export const sanitizeHttpBody = (b: any, depth = 0): any =>
    !b || typeof b !== 'object' || depth > 4 ? b
    : Array.isArray(b) ? b.map((v) => sanitizeHttpBody(v, depth + 1))
    : Object.fromEntries(Object.entries(b).map(([k, v]) => [k, SENSITIVE.test(k) ? '[REDACTED]' : sanitizeHttpBody(v, depth + 1)]));
  ```
  - Log `req.path` instead of `originalUrl`.
  - Make `index.ts:76` log the path only.
  - Move machine API keys into an `Authorization` header.
  - Then **rotate the Draftmancer and ManaMatrix keys** and set a retention period on the affected log groups.

### M-10 Insecure fallbacks for missing secrets
- **CWE:** CWE-1188, CWE-321. **Exploitable by:** conditional, only when an environment variable is missing. **Confidence:** High.
- **Where:**
  - `index.ts:210` uses `secret: process.env.SESSION || 'default-secret'`. If `SESSION` is unset, sessions for any user, admins included, can be forged.
  - `serverutils/recordShareToken.ts:6-9` reuses the **session** secret (with the same fallback) as the HMAC key for permanent record-contribute tokens. Those tokens can't be revoked without logging everyone out.
  - `routes/patreon.ts:28` uses `createHmac('md5', process.env.PATREON_HOOK_SECRET || '')`. With the variable unset, webhooks can be forged to grant any patron tier.
  - `packages/cdk/app/infra.ts:61,63` deploys `''` whenever the deploying shell lacks these variables, so the fallbacks are reachable through an ordinary deploy mistake.
- **Fix:**
  - Fail closed at startup in production:
    ```ts
    for (const k of ['SESSION', 'PATREON_HOOK_SECRET', 'CAPTCHA_SECRET_KEY', 'RECORD_TOKEN_SECRET']) {
      if (process.env.NODE_ENV === 'production' && !process.env[k]) throw new Error(`${k} must be set`);
    }
    ```
  - Make CDK throw at synth time on empty values.
  - Give record tokens their own secret plus a per-record random nonce, so links can be revoked.
  - Move the Patreon HMAC from MD5 to whatever Patreon supports now, if anything better is available.

### M-11 Client IP trusted from `CF-Connecting-IP`, but nothing in IaC restricts the origin to Cloudflare
- **CWE:** CWE-348, CWE-290. **Exploitable by:** anyone who can reach the ALB directly. **Confidence:** Medium. The restriction may exist out of band.
- **Where:**
  - `packages/server/src/serverutils/clientIp.ts:26-37` returns the `cf-connecting-ip` header whenever it's present. Its own comment says this is safe only because the ALB accepts traffic from Cloudflare alone.
  - `packages/cdk/lib/elastic-beanstalk.ts` creates a public application ALB with no custom security group and no Cloudflare ranges. EB's default ALB security group is open to 0.0.0.0/0.
  - `req.ip` itself is safe: `trust proxy` is set to `['loopback','uniquelocal']`.
- **Impact:** if the ALB or EB hostname answers directly, every IP-keyed rate limit can be bypassed, logs can be filled with forged IPs, and Cloudflare's WAF and DDoS protection is skipped.
- **Fix:**
  - Codify an ALB security group that allows only Cloudflare's published IPv4 and IPv6 ranges on 443, or enable Cloudflare Authenticated Origin Pulls (mTLS), or check a secret header added by a Cloudflare Transform Rule.
  - In code, trust the header only when `req.ip` falls inside a Cloudflare range.

### M-12 All application secrets stored in plaintext in CloudFormation, EB and Lambda configuration; deployer AWS keys copied into runtime
- **CWE:** CWE-312, CWE-526, CWE-522. **Exploitable by:** any principal with read-type access (`ReadOnlyAccess`, or H-08's `s3:GetObject *`). **Confidence:** High.
- **Where:**
  - `packages/cdk/app/infra.ts:45-76` reads `process.env.*` at synth time.
  - `lib/cubecobra-stack.ts:345-400` (EB `OptionSettings`), `:481-502` (ECS task environment) and `:410-438` (Lambda environment) hold the values.
  - `deployment-pipeline.ts:148-150` exports `artifacts: files: ['**/*']`, which copies resolved templates into the artifact bucket. That bucket has no `enforceSSL` and no versioning, and the artifact is never consumed.
  - `infra.ts:45-46` and `cubecobra-stack.ts:346-347` copy the **deployer's** `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` into the web server environment. They are empty today under CodeBuild, but a deploy run from a laptop with environment-variable credentials would make an admin key the server's runtime identity, ahead of the instance role.
- **Fix:**
  - Keep secrets in SSM SecureString or Secrets Manager and fetch them at boot, granting `param.grantRead(role)`. For ECS use `secrets: { X: ecs.Secret.fromSsmParameter(p) }`.
  - Delete the `AWS_ACCESS_KEY_ID`/`SECRET` plumbing.
  - Remove the `**/*` artifact export.
  - Add `enforceSSL: true, versioned: true` to the artifact bucket.
  - Rotate the secrets once they've moved.

### M-13 Production EB instances install npm dependencies at deploy time without a lockfile
- **CWE:** CWE-1357, CWE-494. **Exploitable by:** a supply-chain attacker. **Confidence:** High.
- **Where:**
  - `packages/scripts/src/publish.ts:71-98` zips `packages/server` without `node_modules` or a lockfile.
  - `packages/server/.npmrc` documents that EB runs `npm install --omit=dev` with `legacy-peer-deps=true`.
  - All 55 server dependencies use `^`/`~` ranges.
  - Managed instance refresh is enabled (`elastic-beanstalk.ts:179-204`).
- **Impact:** production runs dependency versions CI never tested. Any malicious release within range reaches prod on the next scale-out or weekly refresh, and its install scripts run as root on a host holding the instance role.
- **Fix:** ship `node_modules` in the bundle (EB skips the install when it's present), or ship a server-scoped lockfile and run `npm ci --omit=dev --ignore-scripts` from a `.platform` prebuild hook. Remove dead dependencies first (`@tensorflow/tfjs-node`, `csurf`, `supertest`, `tsx` in `dependencies`).

### M-14 GitHub OIDC role trusts any ref and can push the `latest` production jobs image
- **CWE:** CWE-863, CWE-284, CWE-494. **Exploitable by:** anyone with push access to any branch, or a leaked contributor token. **Confidence:** High.
- **Where:**
  - `packages/cdk/lib/pipeline.ts:36-38` trusts `token.actions.githubusercontent.com:sub` = `repo:dekkerglen/CubeCobra:*`.
  - `cubecobra-stack.ts:215-225` grants that role `ecr:PutImage` on `Ecr` and `JobsEcr`.
  - `jobs-ecs-task.ts:140` runs tag `latest`, and the ECR tags are mutable with no scan-on-push (`ecr.ts:15-17`).
  - No current workflow uses `id-token: write`, so the role is unused. Its last user, `cdk_deploy.yml`, was deleted in `4b54d0d14`.
- **Impact:** a workflow pushed to any branch can assume the role and replace the production jobs image. That bypasses review, branch protection and the pipeline's test gate, and the job then runs with production data access.
- **Fix:**
  - Delete the role and its ECR grants.
  - If it's still needed, restrict `sub` to a protected environment (`repo:dekkerglen/CubeCobra:environment:production`) and add an `aud` condition.
  - Set ECR repositories to `IMMUTABLE` with scan-on-push, and pin tasks to a commit tag or digest.

### M-15 Integration-test CodeBuild role has `ecr:*` on `*`
- **CWE:** CWE-250. **Confidence:** High.
- **Where:** `packages/cdk/lib/deployment-pipeline.ts:335-340` grants `ecr:*` and `ecr-public:*` on `*` to the stage that runs `npm install` and `playwright install --with-deps`.
- **Impact:** the lower-trust test stage could overwrite or delete the production jobs image, or make repositories public.
- **Fix:** remove the statement. LocalStack doesn't need ECR. If public ECR pulls are needed, grant only `ecr-public:GetAuthorizationToken` and `sts:GetServiceBearerToken`.

### M-16 Unthrottled public ML endpoints in front of an unauthenticated recommender
- **CWE:** CWE-770, CWE-306. **Exploitable by:** anyone. **Confidence:** High.
- **Where:**
  - `packages/server/src/router/routes/api/draftbots/predict.ts` and `batchpredict.ts` have no auth, no rate limit, and no `.max()` on the `pack`/`picks` arrays. A batch accepts up to 20 inputs.
  - The recommender (`packages/recommenderService/src/index.ts:69-70`) accepts 50 MB bodies with no service authentication.
  - Production runs 3× t3.medium recommender instances, which are CPU-credit throttled.
- **Impact:** sustained anonymous traffic exhausts the recommender's CPU credits. Bot picks, bot deckbuilding and recommendations then degrade for everyone.
- **Fix:**
  - Rate-limit both routes, e.g. `rateLimit({ windowMs: 60_000, limit: 120, keyGenerator: userOrIpKey })`.
  - Add `Joi.array().max(100)` on the inputs.
  - Cut the recommender body limit to about 2 MB.
  - Require a shared-secret header (from SSM) on recommender requests.
  - Fix the recommender's error handler, which has 3 parameters and so is never invoked by Express (`index.ts:90`).

### M-17 `coverage-comment` workflow trusts artifacts from untrusted PR runs
- **CWE:** CWE-345, CWE-829. **Exploitable by:** the author of a fork PR. **Confidence:** High.
- **Where:**
  - `.github/workflows/coverage-comment.yml:21-46` is a `workflow_run` job with `pull-requests: write`.
  - It reads `pr-number.txt` and a Markdown report from artifacts produced by the PR's own copy of `actions.yml` (`:201-219`).
  - It writes the PR number unvalidated into `$GITHUB_OUTPUT`.
  - It posts with the tag-pinned `marocchino/sticky-pull-request-comment@v2`.
- **Impact:** an attacker can post or overwrite arbitrary Markdown comments on any PR or issue: phishing links, tracking pixels, fake "maintainer" instructions. If the `@v2` tag were ever moved to malicious code, that code would run with this write token.
- **Fix:**
  - Pin actions to commit SHAs.
  - Validate `^[0-9]+$`.
  - Check through `gh api repos/$REPO/pulls/$N --jq .head.sha` that it equals `github.event.workflow_run.head_sha`.
  - Build the comment inside the privileged job from numeric coverage values only, instead of posting uploaded Markdown.

### M-18 reCAPTCHA verification request built without encoding the user-supplied token
- **CWE:** CWE-88, CWE-74. **Exploitable by:** anyone. **Confidence:** Low. Whether Google honors injected duplicate parameters is unverified.
- **Where:** `packages/server/src/router/middleware.ts:139-145` builds the body as `` `secret=${CAPTCHA_SECRET_KEY}&response=${captcha}` ``. The client controls `captcha`, so it can add parameters to the server-to-Google request. The fixed set of 12 "security questions" (`:78-133`) adds no real protection.
- **Fix:**
  ```ts
  body: new URLSearchParams({ secret: process.env.CAPTCHA_SECRET_KEY!, response: String(captcha), remoteip: clientIp(req) }),
  // and after parsing:
  if (!data.success || data.hostname !== process.env.DOMAIN) { … }
  ```

### M-19 Unvalidated custom-format index causes CPU and memory exhaustion
- **CWE:** CWE-1284, CWE-400. **Exploitable by:** any registered user, on their own cube. **Confidence:** Medium. The reviewer measured the array behavior locally but didn't trace the DynamoDB marshaller end to end.
- **Where:** `packages/server/src/router/routes/cube/format.ts:39` runs `cube.formats[req.body.id] = format`. `id` is any client value other than `'-1'`. It is followed by `cubeDao.update(cube)`.
- **Impact:**
  - A very large numeric index creates a huge sparse array, which is then walked during serialization. Locally, an index of 1e8 took 6.4 s to map and 11.8 s to `JSON.stringify` (a 500 MB string). The maximum array index is far worse.
  - Non-numeric keys such as `length` mutate the array object itself.
  - The corrupted cube document also breaks later reads of that cube.
- **Fix:**
  ```ts
  const idx = Number.parseInt(String(req.body.id), 10);
  if (!Number.isInteger(idx) || idx < 0 || idx >= (cube.formats?.length ?? 0)) { req.flash('danger', 'Invalid format'); return redirect(...); }
  cube.formats[idx] = sanitizeFormat(format);   // same whitelist as C-01
  ```

---

## 5. Low and informational findings

### Low

| ID | Finding | Where | Fix |
|---|---|---|---|
| L-01 | **User enumeration.** Login, lost-password and resend-verification return different messages for unknown versus known accounts. Login also skips bcrypt for unknown users, so known users take about 150 ms longer (timing oracle). CWE-204, CWE-208 | `user/login.ts:37-51`, `lostpassword.ts:22-25`, `resendverification.ts:28-31`, `config/passport.ts:17-21` | One generic message ("If an account exists, we sent an email"); compare against a fixed dummy hash when the user isn't found |
| L-02 | **Inconsistent, weak password policy.** Register allows 8–1024 characters but reset allows 8–24. Change-password never validates the *new* password (a 1-character or empty password is accepted, and an empty one locks the user out). Missing fields leave the request hanging until timeout. bcrypt silently truncates at 72 bytes. CWE-521, CWE-20 | `register.ts:171-174`, `passwordreset.ts:23`, `resetpassword.ts:31-61` | One shared validator (minimum 10, maximum 72 bytes, or SHA-256 pre-hash), applied to the new password everywhere; always respond on hash errors; cost 12 with rehash on login |
| L-03 | **Password reset or change doesn't revoke other sessions or other outstanding reset links.** Sessions roll for 30 days with no absolute lifetime. CWE-613, CWE-640 | `passwordreset.ts:64-69`, `resetpassword.ts:35-41`, `index.ts:208-231` | Store a `sessionVersion` on the user and in the session; reject mismatches in `deserializeUser`; delete all of the owner's reset rows on success; add an absolute session lifetime |
| L-04 | **Patreon OAuth has no `state`.** An attacker can bind their Patreon grant to a victim's account (perk transfer or nuisance; Patreon is not a login method). CWE-352 | `client/src/pages/UserAccountPage.tsx:101-103`, `routes/patreon.ts:290-375` | Random `state` stored in the session and compared on redirect; make `/patreon/unlink` a POST |
| L-05 | **Patron revocation keyed on the mutable Patreon email.** After an email change on Patreon, the cancellation webhook matches nobody and perks stay active. CWE-840 | `routes/patreon.ts:195,310-348` | Persist the Patreon user ID; match webhooks on `relationships.user.data.id`; add a periodic reconciliation job |
| L-06 | **Notification IDOR.** Any logged-in user can mark any notification read and is redirected to its URL. IDs are uuid v4, so impact is limited. CWE-639 | `user/notification.ts:15-27` | `if (notification.to !== req.user.id) return 404` |
| L-07 | **Private cube and deck IDs exposed on `/user/decks/:userid`.** This supplies the IDs M-03 needs. CWE-200 | `user/decks.ts:18,36` | Filter drafts with `isCubeViewable` (as `recentdrafts.ts:33` already does) |
| L-08 | **Unlisted cubes can be enumerated** through `/cube/api/usercubes/:userId` and `/cube/liked/:userid`. CWE-200 | `cube/api/usercubes.ts:14-18`, `cube/liked.ts:23` | Use `isCubeListed` (as `user/view.ts:31-32` does) |
| L-09 | **Comments ignore parent visibility.** Comments on blog posts or decks of private cubes can be read and posted by anyone with the parent ID. CWE-862 | `comment.ts:146-159` | Resolve the parent and check `isCubeViewable` |
| L-10 | **Unpublished podcasts, episodes and videos can be viewed** by anyone with the ID (articles are gated correctly). CWE-284 | `content.ts:260,296,328` | Mirror the article gate: published, or owner, or admin |
| L-11 | **Podcast RSS fetch is SSRF-capable.** Content-creator-only. Follows redirects, has no size cap, and its error text becomes a status-code oracle. For XML responses it is a partial-read SSRF, because parsed fields are stored and displayed. The daily Lambda re-fetches the same URLs outside a VPC. CWE-918 | `content.ts:534/554, 650/670`, `serverutils/rss.ts:43,75`, `serverutils/podcast.ts:20-21`, `dailyJobsLambda/src/jobs/syncPodcasts.ts` | `https:` only, private ranges blocked, timeout and byte cap; fetch the body yourself and use `parser.parseString`; generic error message |
| L-12 | **Oversized global body handling.** 50 MB JSON and urlencoded limits on every route (this amplifies H-10 through `POST /cube/api/adds`); `express-fileupload` applies to every route (including unauthenticated ones) with no limit on file, part or field count; nginx allows 200 MB. CWE-770 | `index.ts:125-147`, `.platform/nginx/conf.d/` | 1 MB global limit, raised per route for bulk import; mount `fileUpload({ limits: { files: 1, fields: 10, parts: 12 } })` only on the upload route; lower nginx to match |
| L-13 | **Image proxy reflects the upstream `Content-Type` on the main origin** (an SVG from an allowlisted host would be served as `image/svg+xml` from cubecobra.com); follows redirects; no timeout or size cap. CWE-79 (defense in depth) | `routes/tool/imageproxy.ts` | Pass through only `image/(jpeg\|png\|webp\|gif)`; add `nosniff` and `CSP: default-src 'none'; sandbox`; `redirect: 'error'`, timeout, byte cap |
| L-14 | **Raw `err.message` shown to users.** AWS SDK and DynamoDB errors can expose role ARNs, table names and account IDs. CWE-209 | `index.ts:385`, `serverutils/render.ts:394`, `client/src/pages/ErrorPage.tsx:35-38` | Generic message plus request ID; allowlist user-facing error classes |
| L-15 | **IaC hardening gaps.** CWE-250, CWE-693, CWE-326, CWE-668 | `cdk/lib/*` | (a) `dynamodb-tables.ts:23-29`: add PITR and `deletionProtection: true`. (b) `config.ts:47`: the dev environment points at the **prod** data bucket. (c) `cubecobra-stack.ts:77-182`: the recommender shares the web server's broad instance role. (d) `:145-159`: Logs Insights on `log-group:*`. (e) `elastic-beanstalk.ts:123-137`: no explicit ALB `SSLPolicy`; set `ELBSecurityPolicy-TLS13-1-2-2021-06`. (f) Confirm IMDSv2 is required on the EB launch template |
| L-16 | **Jobs container image hygiene.** Runs as root (no `USER`); `node:22`/`node:22-slim` aren't digest-pinned; `npm install` instead of `npm ci`; `packages/jobs/.dockerignore` is ignored because the build context is the repo root. CWE-250, CWE-1357 | `packages/jobs/Dockerfile:4,17,31,52` | `USER node`; pin by digest; `npm ci`; move the ignore file to `packages/jobs/Dockerfile.dockerignore` |
| L-17 | **GitHub Actions hygiene.** Actions are tag-pinned, not SHA-pinned; the workflow-wide `pull-requests: write` reaches jobs that run PR code; `npm install` instead of `npm ci`; default `persist-credentials`; `${{ github.base_ref }}` interpolated in `run:` (not exploitable, but pass it through `env:`); no `dependabot.yml` and no `CODEOWNERS`; the unused `.github/actions/{eslint,prettier}` reference unpinned `reviewdog/*@v1`. CWE-829 | `.github/workflows/actions.yml:11-13,22-219`, `coverage-comment.yml` | Pin to SHAs; per-job `permissions`; `npm ci`; `persist-credentials: false`; add Dependabot (npm and github-actions) and CODEOWNERS for `packages/cdk/**` and `.github/**`; delete the dead actions |
| L-18 | **Hosted-image quota race (TOCTOU).** Parallel uploads can exceed the 1000-image / 1 GB patron quota. CWE-367 | `user/images/upload.ts:47-70` | Atomic DynamoDB `ADD` with a `ConditionExpression` before storing |
| L-19 | **Deckbuild session deleted before the ownership check.** Anyone who knows the draft ID can cancel someone else's in-progress bot deckbuild. CWE-696 | `routes/draft/deckbuild.ts:134,142` | Move `sessions.delete` after the owner check |
| L-20 | **Non-constant-time secret comparisons.** The email-verification token and the Draftmancer and ManaMatrix API keys are compared with `!==`. Negligible over the network. CWE-208 | `register.ts:138`, `api/draftmancer/publish.ts`, `tool/api/*/rotate.ts` | `crypto.timingSafeEqual` with a length check |
| L-21 | **CSV exports: formula injection and unescaped quotes.** Tags, notes, custom names, type lines, set codes and image URLs, all user-editable, are written inside `"…"` without doubling inner quotes. No cell is neutralized against a leading `= + - @`. The name and artist columns are quote-escaped but not neutralized. A victim opening a cube or deck export in a spreadsheet can trigger formulas. CWE-1236, CWE-116 | `serverutils/cube.ts:243-288` (`writeCard`, used by `cube/download.ts:127`, `cube/changelog.ts:89`, `cube/deck.ts:454`), `cube/deck.ts:401,425` | `const csvCell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };` for every cell, or use `papaparse.unparse` with `escapeFormulae: true` |
| L-22 | **`Content-Disposition` built from raw route parameters.** The `seat` parameter only has to pass `parseInt`, so trailing `;` or `"` characters survive into the filename. Node rejects CR/LF, so there is no response splitting. CWE-116 | `cube/deck.ts:370,376` | `res.attachment(\`${deck.id}_${seatIndex}.csv\`)` using the parsed integer (other download routes already slugify) |

### Informational

| ID | Observation |
|---|---|
| I-01 | **Legacy GitHub repo secrets probably still exist.** Workflows deleted in `5c1b7cd81`, `1533491c6` and `4b54d0d14` used long-lived `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` and every app secret, alongside `@master`-pinned third-party actions. Delete the unused repo secrets and deactivate the old IAM user keys. |
| I-02 | **dev, beta and prod share one AWS account and the default VPC with public subnets.** Beta compute can reach prod's internal recommender ALB (plain HTTP). Separate accounts are the long-term fix for H-08, M-12 and M-15. |
| I-03 | **No manual approval before production** in the pipeline. Branch protection on `master` is the only human gate (not verifiable from the repo). |
| I-04 | **Recommender** `server.listen(PORT)` binds all interfaces, which exposes it to the LAN on dev machines. In prod the internal ALB and security group keep it private. |
| I-05 | **Stripe merchandise flow is dead code** (`products = []`). If it's revived: build URLs from `DOMAIN`, not `Host`; validate the quantity; fulfill only from a webhook verified with `stripe.webhooks.constructEvent` over the raw body. |
| I-06 | **Deleted hosted images stay cached** at the CDN and in browsers for up to a year (`immutable`, `hostedImageStorage.ts:16`). Purge on delete, or use a shorter TTL. |
| I-07 | **Internal dev tools.** The annotator's Vite middleware path checks use `startsWith(dir)` without a trailing separator (sibling-directory traversal, local dev only). `routes/model.ts` sanitizes `..` but not double-encoded dots (the target bucket is public anyway). |
| I-08 | **Python tooling (local only, not deployed).** `ultralytics>=8.3.0` and the other requirements are unpinned and unhashed; that range admitted the compromised ultralytics 8.3.41 and 8.3.42 (Dec 2024). `YOLO(weights)` uses torch pickle loading, so only load trusted `.pt` files. A static `pickletools` scan of the committed `yolo26n.pt` found only benign globals, and nothing references it, so consider deleting it. See §6.4 for the venv CVEs. |
| I-09 | **`ENABLE_BOT_SECURITY=false` in non-prod stages** also skips email verification, so public beta accepts unverified sign-ups with any email. Production fails closed. |
| I-10 | **`userDao.update` merges every defined key** of the object passed in. All current callers whitelist fields, but a future `update({ ...req.body })` would make `roles`, `patron` and `emailVerified` user-writable. Enforce an allowlist inside the DAO. |
| I-11 | **Third-party stylesheet without Subresource Integrity.** `views/main.pug` loads `katex@0.16.11` CSS from jsDelivr with no `integrity` attribute (the installed JS is 0.16.45). Self-host it from the asset CDN, or add SRI and `crossorigin`. |

---

## 6. Dependency vulnerabilities (SCA)

### 6.1 Summary

`npm audit` on the root workspace lockfile (`package-lock.json`, 3,853 packages), run 2026-10-22:

| Scope | Critical | High | Moderate | Low | Total |
|---|---|---|---|---|---|
| All dependencies | 10 | 72 | 36 | 17 | **135** |
| Production trees only (`--omit=dev`) | 5 | 24 | 20 | 7 | **56** |
| **Reachable from the internet in current code** | 0 | 2 | 1–2 | — | see H-09 and 6.2 |

Most of the volume comes from a few heavy roots:
- `jest` 29 → `micromatch`/`braces`: about 25 high entries, test-only;
- `clinic`: `request`, `form-data`, `tough-cookie`, `tmp`, profiling only;
- `lerna`/`nx`: `axios` ×20, `js-yaml`, `tar`;
- `@tensorflow/tfjs-node`: `tar`, `adm-zip`, install-time;
- `tailwindcss` 3 and `forever-monitor`: old `chokidar`/`braces`.

Upgrading or removing those five roots clears more than two-thirds of the report.

> **Stale lockfiles:** `packages/client/package-lock.json` and `packages/cdk/package-lock.json` are tracked but unused (workspaces resolve through the root lockfile; last touched 2026-08-18). They mislead scanners and Dependabot. Delete them.

### 6.2 Production-tree advisories, triaged for reachability

| Package (installed) | Pulled in by | Advisories (CVE) | npm severity | Reachable? | Action |
|---|---|---|---|---|---|
| **compression** 1.8.1 | server, recommender | CVE-2026-87776 | High | **Yes**: every response, any client | → **1.8.2** |
| **sharp** 0.34.5 | server | GHSA-f88m-g3jw-g9cj (CVE-2026-33327, -33328, -35590, -35591), GHSA-rgj7-g3m4-5g8c, GHSA-wq5f-xc86-pv6w (CVE-2026-96889) | High | **Yes**: decodes attacker-chosen images (H-04) and patron uploads | → **0.35.5** |
| **nodemailer** 9.0.1 (server); 6.10.1 nested in `email-templates` | server email | 15 advisories, incl. CVE-2025-13033, CVE-2025-14874, CVE-2026-82659, CVE-2026-82662, plus GHSA-2x7j-588g-ccc2, -v53p-9fqp-m79j, -8vvx-rff5-p5rq (address-parser DoS), GHSA-cc9r-2j5m-2m83 (recipient-domain confusion) | High | **Partly.** Recipient addresses come from users, and `updateemail` doesn't validate format (H-01), so address-parser DoS is reachable when mail is sent. SMTP-specific items don't apply to the SES transport | → nodemailer **10.2.1**. Even `email-templates` 13.0.1 still pins `nodemailer ^7`, so force the nested copy with a root `overrides` entry (§6.5) and smoke-test email sending. Validate emails with `isEmail()` everywhere |
| **sanitize-html** 2.17.6 | server | CVE-2026-84371, CVE-2026-113654, CVE-2026-113661 | Moderate | **No.** Both configs in the repo (`serverutils/podcast.ts:9`, defaults minus `span`; `cubefn.ts:723`, a fixed inline list in dead code) allow no SVG or animation elements, `meta`, `style` or `noscript`, and don't use `allowVulnerableTags` | → **2.18.1** (routine) |
| **qs** 6.15.3 | express 4.22.2 | CVE-2026-82562, CVE-2026-82417 (and CVE-2025-15284 in the dev tree) | Moderate | Not with Express defaults (needs `comma: true` or `plainObjects`) | express → **4.22.3** (qs ~6.16) |
| **proxy-addr** 2.0.7 | express | CVE-2026-90711 | Critical | **No.** Requires an IPv4-mapped IPv6 trust subnet; this app uses the named presets `loopback`/`uniquelocal` | `npm update proxy-addr` → 2.0.8 |
| **joi** 18.2.1 | server | CVE-2026-84368, CVE-2026-84367, CVE-2026-90771, CVE-2026-92599 | High | **No.** Needs attacker-controlled schema *messages*; `isoDate()` isn't used | → **18.3.0** |
| **ip-address** 10.4.0 | express-rate-limit 8.5.1 | CVE-2026-101910 to -101913 | Moderate | Marginal (IPv6 subnet math in rate-limit keys) | express-rate-limit → **8.7.1** |
| **body-parser** 1.20.5 (express-internal) / 1.20.6 (server direct) | | CVE-2026-12590 | Moderate | **No.** The server's own copy is patched, and every `limit` is a valid literal | Comes with express 4.22.3 |
| **katex** 0.16.45 | client (`rehype-katex`, `remark-math`) | CVE-2026-103923 | Low | Only together with an existing client-side prototype pollution | → **0.19.0** via rehype-katex / remark-math |
| **dompurify** 3.4.11 | client `jspdf` 4.2.1 | GHSA-55q2-fjhq-7xh7, GHSA-6688-9rhm-gjv2 | Moderate | **No.** `jspdf.html()` isn't used (only in `IN_PLACE` mode) | override `dompurify` ≥ **3.4.17** |
| **handlebars** 4.7.9 | `email-templates` → `@ladjs/consolidate` | CVE-2026-106444, -106445, -106446 | Critical | **No.** Email templates are Pug | override → **4.7.10** |
| **tar** 6.2.1, **adm-zip** 0.5.17, **@mapbox/node-pre-gyp** | `@tensorflow/tfjs-node` 4.22.0 (server, recommender) | 12 tar CVEs (CVE-2026-24842, -23745, -26960, -29786, -31802, -23950, -53655, -59871, -59873, -59874, -59875, -73566); adm-zip CVE-2026-39244, -76845, -77301, -102282 and 4 GHSAs | Critical/High | **Install time only.** Extraction of the downloaded TF binary during `npm install`, which runs as root on EB instances (M-13) and in privileged CI (H-07) | **Remove tfjs-node from the server** (unused there). In the recommender, override `adm-zip` → 0.6.1 and track the upstream fix |
| **maplibre-gl** 4.7.1 / **plotly.js** 2.35.3, **probe-image-size** | `archetypeAnnotater` (internal tool) | CVE-2026-85061, CVE-2026-104861 | Critical/High | **No.** Not deployed | plotly.js → 4.1.2 |
| **fast-uri** 3.1.3 | ajv (webpack, aws-cdk-lib) | 9 CVEs (CVE-2026-16221 …) | High | **No.** Build time | Comes with webpack/cdk updates |
| **forever-monitor** 3.0.3 → chokidar/braces/micromatch | `server.js`, recommender | CVE-2024-4068, CVE-2024-4067, CVE-2026-93687 | High | **No.** Only processes static watch configuration | Replace `forever-monitor` (unmaintained) with EB's process manager, systemd or pm2 |
| **csurf** 1.11.0 → cookie 0.6 | server | CVE-2024-47764 | Low | **No.** Only imported in commented-out code | Remove `csurf`; adopt `csrf-csrf` (H-01) |
| tailwindcss 3, postcss-selector-parser, browserslist, source-map-js, decode-uri-component, fflate, sprintf-js, deepmerge-ts, uuid (preview-email) | build toolchain or email preview | various | Moderate/High | **No.** Build time or developer only | Routine upgrades |

### 6.3 Developer and CI-only advisories that still matter

These never reach production, but they run on developer machines and in CI, which hold real credentials (H-07).

| Package | Advisory | Risk | Action |
|---|---|---|---|
| `storybook` / `@storybook/core` 8.6.18 (client) | **CVE-2026-114125** (Critical): the preview server doesn't validate origin, so a malicious website can inject code while Storybook is running | Developer workstation compromise | → ≥ 8.6.19 |
| `vite` 8.1.4 (client), 6.4.3 (annotator) | CVE-2026-112942 to -112946: cross-origin script execution through custom middleware, `server.fs.allow` bypass, launch-editor command execution | Developer workstation | → latest 8.x / 6.x patch |
| `shell-quote` 1.10.0 (via `npm-run-all`) | CVE-2026-102422 (Critical): command injection in `quote()` | Low (static arguments) | Switch to `npm-run-all2`, or override shell-quote ≥ 1.11 |
| `@faker-js/faker` 10.4.0 (integrationTests) | CVE-2026-73231 | Test only | Upgrade |
| `nx` (via lerna 9) | CVE-2026-71476, CVE-2026-104853/4, GHSA-w2vw-w76x-qr89 (command injection through git refs, zip-slip, daemon sockets) | CI and developer | Upgrade lerna/nx, or drop lerna (npm workspaces already cover the build) |
| `axios` (via nx) | 20 advisories (CVE-2026-67312 … -101909) | CI | Comes with the nx upgrade |
| `clinic` 13 → `request`, `form-data`, `tough-cookie`, `tmp` | CVE-2023-28155, CVE-2025-7783, CVE-2026-12143, CVE-2023-26136, CVE-2025-54798 | Developer | Remove `clinic` from the server's devDependencies, or run it through `npx` when needed |
| `jest`/`babel-jest` 29 | micromatch ReDoS chain | Test only | → jest 30.5 |
| `serialize-javascript` 6.0.2 (root, via mocha/webpack) | GHSA-5c6j-r48x-rmvq, CVE-2026-34043 | Build only (the server uses 7.0.7, which is patched) | Comes with the toolchain upgrade |

### 6.4 Python (local ML tooling, not deployed)

`packages/annotator/training/requirements.txt` and `packages/archetypeAnnotater/requirements.txt` are unpinned. The installed `packages/annotator/.venv` (untracked) has known advisories (OSV):

| Package | Version | Advisories |
|---|---|---|
| pillow | 12.2.0 | ~60 GHSA/PYSEC entries (image-decoder memory safety) |
| pip | 24.0 | 6 (incl. GHSA-4xh5-x5gv-qwph tarfile extraction) |
| urllib3 | 2.7.0 | 3 |
| onnx | 1.21.0 | 2 |
| torch | 2.12.0 | CVE-2025-3000 (`torch.jit.script` memory corruption) |
| setuptools 81.0.0, certifi 2026.5.20, fsspec 2026.4.0 | | 1–2 each |

**Action:** pin with hashes (`pip-compile --generate-hashes`), upgrade the venv, and load model weights only from trusted sources (I-08).

### 6.5 Recommended dependency commands

```bash
npm install --workspace=packages/server compression@^1.8.2 sharp@^0.35.5 sanitize-html@^2.18.1 joi@^18.3.0 nodemailer@^10.2.1 express@^4.22.3 express-rate-limit@^8.7.1
```
```bash
npm uninstall --workspace=packages/server @tensorflow/tfjs-node csurf @types/csurf
```
```bash
npm install --workspace=packages/recommenderService compression@^1.8.2 express@^4.22.3
```
```bash
npm update proxy-addr qs
```
```bash
git rm packages/client/package-lock.json packages/cdk/package-lock.json
```

Merge these into the existing root `package.json` `overrides` block. They clear transitive packages that aren't (or are barely) reachable but should still be patched:
```json
"overrides": {
  "nodemailer": "^10.2.1",
  "handlebars": "^4.7.10",
  "dompurify": "^3.4.17",
  "adm-zip": "^0.6.1",
  "shell-quote": "^1.11.0"
}
```
Add `.github/dependabot.yml` covering the `npm` ecosystem (root) and `github-actions`, and run `npm audit --omit=dev --audit-level=high` as a CI gate.

---

## 7. What was checked and found sound

So the next audit can skip them, these areas were reviewed and found sound:

- **Admin authorization.** All 30 routes under `routes/admin/**` use `ensureRole(UserRoles.ADMIN)`. `ensureRole` re-reads roles from DynamoDB. Admin actions outside `/admin` (cube feature/unfeature, package remove, dev blog post) are gated too. `dev.ts` is the public dev blog, and no routes depend on `NODE_ENV`.
- **Cube permission helpers.** `isCubeViewable`, `isCubeEditable`, `isCubeListed` and `isCubeOwner` compare database-loaded owner IDs. They are used correctly on cube pages, downloads, history, playtest, analysis, settings, card data APIs and all editor actions, except the routes listed in M-03 and M-08.
- **Mass assignment.** `updatesettings`, `editoverview`, `changedisplay` and `updateuserinfo` copy whitelisted fields only. Users can't set `roles`, `patron` or `emailVerified`.
- **Sessions.**
  - Passport 0.7 regenerates the session on login (no fixation).
  - Logout deletes the session row.
  - Session IDs come from uid-safe (24 bytes).
  - The cookie is `httpOnly` by default.
  - Expired sessions are rejected on read.
  - `deserializeUser` reloads the user on every request.
- **Password reset tokens** are uuid v4, single-use, expire after 6 hours, are owner-bound, and are emailed to the stored address. Links are built from `DOMAIN`, not `Host`.
- **Patreon webhook.** HMAC over the raw bytes (captured only for the hook path), length check, then `timingSafeEqual`.
- **Hosted image upload.** Format is sniffed by sharp (not the client MIME type); SVG is excluded; images are re-encoded to WebP with EXIF stripped; `limitInputPixels` is 100M; keys are `userimages/<owner>/<uuid>.webp`; delete and rename check ownership.
- **Image proxy** uses a strict origin allowlist (residual issues in L-13).
- **Internal service URLs** (`ML_SERVICE_URL`) come only from the environment and have timeouts.
- **Shell execution.** No `child_process` call with string interpolation anywhere; scripts use argv arrays or constant commands.
- **HTTPS redirect** uses `DOMAIN`, not the `Host` header; HSTS is set; the server binds `127.0.0.1` behind nginx.
- **CORS.** `Access-Control-Allow-Origin: *` appears only on public read endpoints, never with credentials.
- **Secrets.** No AWS keys, private keys, Stripe or Patreon secrets, Google API keys, webhooks, GitHub tokens or JWTs in the tree or in any of the 8,383 commits (history scan verified with a positive control). `.env_EXAMPLE` files hold placeholders only. `cdk.out` is untracked.
- **TLS.** No `NODE_TLS_REJECT_UNAUTHORIZED`, `rejectUnauthorized: false` or `curl | bash` anywhere.
- **CI.**
  - No `pull_request_target`; no self-hosted runners.
  - Every workflow has a `permissions:` block.
  - Fork PRs receive no secrets.
- **IAM done right.** The bot-deckbuild Lambda, the card-update-monitor Lambda and the jobs task role are least-privilege. `iam:PassRole` grants use `iam:PassedToService`. CodeBuild SSM reads are scoped to `/cubecobra/<stage>/*`. The recommender ALB is internal. The pipeline artifact bucket blocks public access and is encrypted.
- **Python.** No `pickle.load`, `yaml.load`, `eval` or `shell=True`. `np.load` uses `allow_pickle=False`. `namebar.onnx` is protobuf, so loading it can't execute code.
- **Markdown rendering.**
  - No `rehype-raw`; react-markdown 10 renders raw HTML as text.
  - `defaultUrlTransform` restricts `href`/`src` to http(s), mailto, irc(s) and xmpp, so `javascript:` and `data:` are blocked. The image problem in M-02 is about same-origin URLs, not schemes.
  - The custom plugins (user links, card links, symbols) are restricted to safe character sets or use `encodeURIComponent`.
  - KaTeX runs with the defaults (`trust: false`).
- **Server-side render.** `render.ts` serializes props with serialize-javascript 7.0.7 in its escaping mode (`<`, `>`, `/` and U+2028/2029 are escaped). The only unescaped Pug outputs are the serialized props. Email templates escape every interpolation, and template names are constants.
- **Other HTML sinks.**
  - `PrintAndPlayExportModal.tsx:171` (`document.write`) escapes all values.
  - Podcast episode bodies are sanitized at ingest.
  - There is no `eval` or `new Function` in source.
- **RSS output** (`cube/rss.ts`) uses CDATA with `]]>` splitting and escaped attributes.
- **DynamoDB.** Every expression uses `:value`/`#name` placeholders; no PartiQL, and no user input is concatenated into expressions.
- **Filesystem.** No request-derived path reaches `fs`; wiki slugs resolve through an in-memory map.
- **Regex.** Every dynamic `RegExp` escapes metacharacters. The filter-parser DoS (H-10) comes from grammar ambiguity, not regex backtracking.
- **Prototype pollution elsewhere.** No lodash `merge`/`set`/`defaultsDeep`/`zipObjectDeep`; `qs` runs with `allowPrototypes: false`. `big-json` reads only local catalog files.

---

## 8. Remediation roadmap

### Phase 0: now (1–3 days)
- [ ] **C-01**: remove the `format.html` render path; whitelist format fields on the server; scan stored cubes for `html`.
- [ ] **H-06**: sanitize podcast descriptions (new and stored).
- [ ] **H-10**: filter length cap; fix the grammar ambiguity; add a regression test for single parses.
- [ ] **H-11**: `http(s)`-only validation of `/leave?url=` on the server and the client.
- [ ] **H-01**: password plus verify-new-address flow for email changes; cookie `sameSite: 'lax', secure: true`; Origin-check middleware.
- [ ] **H-02**: board allowlist and index validation in `commit.ts`; JSON reviver; `--disable-proto=delete`.
- [ ] **H-03**: owner checks in the grid and Housman submit routes; delete `submitdraft.ts`.
- [ ] **H-05**: cap the import count per line and in total.
- [ ] **H-09**: upgrade `compression` and `sharp`; remove `@tensorflow/tfjs-node` and `csurf` from the server.
- [ ] **M-01**: strip `token` from public user objects.
- [ ] **M-09**: fix log redaction, **then rotate the Draftmancer and ManaMatrix API keys**.

### Phase 1: this sprint (1–2 weeks)
- [ ] **H-04**: image-host allowlist, timeout, byte and pixel caps, pack-size cap, rate limits, a non-throwing cache.
- [ ] **H-07 / H-08 / M-15**: split the build and deploy CodeBuild projects, `npm ci --ignore-scripts`, scope every `Resource: *` grant.
- [ ] **M-02**: convert state-changing GETs to POST; drop same-origin `<img>` sources in Markdown.
- [ ] **M-03 / M-08 / L-07 / L-08 / L-09 / L-10**: visibility and ownership guards.
- [ ] **M-04**: ban enforcement in middleware and in the login strategy.
- [ ] **M-05**: rate limits on the auth endpoints.
- [ ] **M-07**: reject `//` and `/\` in `getSafeReferrer`.
- [ ] **M-10**: fail closed on missing secrets in both the app and CDK.
- [ ] **M-11**: lock the ALB down to Cloudflare, or use Authenticated Origin Pulls.
- [ ] **M-16**: rate-limit ML endpoints; shared secret on the recommender.
- [ ] **M-18**: `URLSearchParams` for siteverify.
- [ ] **M-19**: validate the format index; reuse the C-01 format whitelist.

### Phase 2: next 30–60 days
- [ ] Real CSRF tokens (`csrf-csrf`) across forms and `csrfFetch`.
- [ ] **M-06**: helmet, then a CSP in report-only mode, then enforced.
- [ ] **M-12**: secrets in SSM or Secrets Manager fetched at runtime; remove deployer key plumbing; rotate everything.
- [ ] **M-13**: ship a lockfile or `node_modules` to EB.
- [ ] **M-14**: delete or restrict the GitHub OIDC role; immutable ECR tags.
- [ ] **M-17 / L-17**: SHA-pin actions; harden `coverage-comment`; add Dependabot and CODEOWNERS.
- [ ] **L-01 … L-20**: the Low items.
- [ ] Dependency cleanup (§6.5): clear the dev-tree criticals (storybook, vite, nx, shell-quote); remove `clinic` and `forever-monitor`; jest 30; delete the stale lockfiles.

### Phase 3: structural
- [ ] Separate AWS accounts per environment (I-02).
- [ ] A shared **public user projection** type that every response embedding another user must go through (prevents the M-01 class).
- [ ] A route-registration convention or lint rule that makes each route declare its auth, ownership and visibility guard explicitly (prevents the H-03 and M-03 classes).
- [ ] A manual approval gate before the production deploy (I-03).
- [ ] Periodic automated scanning in CI: `npm audit --omit=dev`, Semgrep (`p/javascript`, `p/typescript`, `p/react`, `p/express`), and gitleaks on PRs.

---

## 9. Appendix: advisory to CVE mapping

All advisories reported by `npm audit` on 2026-10-22. CVE IDs were resolved through the GitHub Advisory Database. Where no CVE has been assigned, the GHSA ID is listed.

| Package | npm severity | Advisories |
|---|---|---|
| @storybook/core, storybook | critical | CVE-2026-114125 |
| form-data | critical | CVE-2025-7783, CVE-2026-12143 |
| handlebars | critical | CVE-2026-106444, CVE-2026-106445, CVE-2026-106446 |
| maplibre-gl (→ plotly.js) | critical | CVE-2026-85061 |
| proxy-addr | critical | CVE-2026-90711 |
| request | critical | CVE-2023-28155 |
| shell-quote | critical | CVE-2026-102422 |
| tar | critical | CVE-2026-24842, CVE-2026-23745, CVE-2026-26960, CVE-2026-29786, CVE-2026-31802, CVE-2026-23950, CVE-2026-53655, CVE-2026-59871, CVE-2026-59873, CVE-2026-59874, CVE-2026-59875, CVE-2026-73566 |
| @faker-js/faker | high | CVE-2026-73231 |
| adm-zip | high | CVE-2026-39244, CVE-2026-76845, CVE-2026-77301, CVE-2026-102282, GHSA-rcw4-f5rp-g42v, GHSA-p634-w6r4-rjp2, GHSA-c6fg-446q-cg94, GHSA-8238-w5pm-2374 |
| axios | high | CVE-2026-67312 – CVE-2026-67321, CVE-2026-101898 – CVE-2026-101909 (20 advisories) |
| brace-expansion | high | CVE-2026-13149, CVE-2026-14257, CVE-2026-69152, CVE-2026-102276, CVE-2026-102277, CVE-2026-102278 |
| braces | high | CVE-2024-4068, CVE-2026-93687 |
| browserslist | high | CVE-2026-73088, CVE-2026-73089 |
| compression | high | CVE-2026-87776 |
| d3-color | high | GHSA-36jr-mh4h-2g58 |
| deepmerge-ts | high | CVE-2026-40345 |
| fast-uri | high | CVE-2026-13676, CVE-2026-16221, CVE-2026-18446, CVE-2026-75899, CVE-2026-75931, CVE-2026-75975, CVE-2026-76172, CVE-2026-84292, CVE-2026-86472 |
| follow-redirects | high | CVE-2026-111755, CVE-2026-111756 |
| http-cache-semantics | high | CVE-2026-93748 |
| joi | high | CVE-2026-84367, CVE-2026-84368, CVE-2026-90771, CVE-2026-92599 |
| js-yaml | high | CVE-2026-53550, CVE-2026-59869, CVE-2026-84375, GHSA-5p4m-2wfm-xmqj |
| micromatch | high | CVE-2024-4067 |
| nodemailer | high | CVE-2025-13033, CVE-2025-14874, CVE-2026-82659, CVE-2026-82662, GHSA-c7w3-x93f-qmm8, GHSA-vvjj-xcjg-gr5g, GHSA-268h-hp4c-crq3, GHSA-wqvq-jvpq-h66f, GHSA-8m3c-c648-2xjj, GHSA-wmmp-3585-3rmp, GHSA-2x7j-588g-ccc2, GHSA-cc9r-2j5m-2m83, GHSA-6vj9-mwq6-2f5v, GHSA-8vvx-rff5-p5rq, GHSA-v53p-9fqp-m79j |
| nx | high | CVE-2026-71476, CVE-2026-104853, CVE-2026-104854, GHSA-w2vw-w76x-qr89 |
| pacote | high | CVE-2026-9496 |
| postcss | high | CVE-2026-69153, CVE-2026-73646 |
| probe-image-size | high | CVE-2026-104861 |
| serialize-javascript (root, dev) | high | CVE-2026-34043, GHSA-5c6j-r48x-rmvq |
| sharp | high | GHSA-f88m-g3jw-g9cj (libvips CVE-2026-33327/-33328/-35590/-35591), GHSA-rgj7-g3m4-5g8c, GHSA-wq5f-xc86-pv6w (librsvg CVE-2026-96889) |
| smol-toml | high | CVE-2026-85730, GHSA-r4xh-jqrq-34v2 |
| source-map-js | high | CVE-2026-93749 |
| tmp | high | CVE-2025-54798, CVE-2026-44705 |
| undici | high | CVE-2026-18540, CVE-2026-19534, CVE-2026-85024 |
| vite | high | CVE-2026-112942 – CVE-2026-112946 |
| aws-sdk (v2, dev) | moderate | GHSA-j965-2qgj-vjmq |
| baseline-browser-mapping | moderate | CVE-2026-45819 |
| body-parser | moderate | CVE-2026-12590 |
| decode-uri-component | moderate | CVE-2026-45822 |
| dompurify | moderate | GHSA-55q2-fjhq-7xh7, GHSA-6688-9rhm-gjv2 |
| esbuild | moderate | GHSA-67mh-4wv8-2f99, GHSA-g7r4-m6w7-qqqr |
| fflate | moderate | CVE-2026-45820 |
| got | moderate | CVE-2022-33987 |
| ip-address | moderate | CVE-2026-101910, CVE-2026-101911, CVE-2026-101912, CVE-2026-101913 |
| pbkdf2 | moderate | CVE-2026-102414 |
| postcss-selector-parser | moderate | CVE-2026-104844 |
| qs | moderate | CVE-2025-15284, CVE-2026-82417, CVE-2026-82562 |
| sanitize-html | moderate | CVE-2026-84371, CVE-2026-113654, CVE-2026-113661 |
| showdown (clinic) | moderate | CVE-2024-1899, CVE-2026-59710, CVE-2026-59711 |
| sprintf-js | moderate | CVE-2026-97058 |
| tough-cookie | moderate | CVE-2023-26136 |
| uuid (nested) | moderate | CVE-2026-41907 |
| yargs-parser | moderate | CVE-2020-7608 |
| cookie (csurf) | low | CVE-2024-47764 |
| elliptic | low | CVE-2025-14505 |
| katex | low | CVE-2026-103923 |
| toggle-array | low | CVE-2025-57328 |

The remaining npm audit entries (`@jest/*`, `jest-*`, `chokidar`, `anymatch`, `readdirp`, `globby`, `fast-glob`, `tailwindcss`, `lerna`, `clinic`, `forever-monitor`, `tsc-alias`, `patch-package`, `email-templates`, `mailparser`, `preview-email`, `@tensorflow/tfjs*`, `rehype-katex`, `remark-math`, `tspath`, …) have no advisory of their own. They are flagged only because they depend on a package listed above.
