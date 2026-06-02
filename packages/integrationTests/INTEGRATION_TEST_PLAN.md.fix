# CubeCobra Integration Test Plan

## Current Coverage

The integration test suite currently contains only two spec files:

| File               | Tests                                | Coverage        |
| ------------------ | ------------------------------------ | --------------- |
| `auth.spec.ts`     | Register, login, session persistence | Basic auth flow |
| `homepage.spec.ts` | Page title check                     | Smoke only      |

This document outlines every critical workflow that should be covered, organized by priority tier.

---

## Priority Tiers

- **P0 — Critical Path**: Core flows that, if broken, make the application unusable. Must pass before any deployment.
- **P1 — High Value**: Major feature areas exercised by most users. Should pass before deployment.
- **P2 — Important**: Secondary features and edge cases. Run on full regression.
- **P3 — Nice to Have**: Admin, content creator, and uncommon flows. Run as capacity allows.

---

## P0 — Critical Path

### 1. Cube Lifecycle (`cube-lifecycle.spec.ts`)

The core entity of the application. Every user journey depends on cubes existing and functioning.

| #   | Test Case                                                        | Route(s) Exercised                                         |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| 1.1 | Create a new cube with a name and default settings               | `POST /cube/add`                                           |
| 1.2 | Verify the new cube appears on the owner's dashboard             | `GET /dashboard`                                           |
| 1.3 | Navigate to the cube overview page and verify name/metadata      | `GET /cube/overview/:id`                                   |
| 1.4 | Navigate to the cube list page and verify it loads (empty state) | `GET /cube/list/:id`                                       |
| 1.5 | Update cube settings (name, visibility, description)             | `POST /cube/updatesettings/:id`                            |
| 1.6 | Edit the cube overview/primer text                               | `POST /cube/api/editoverview`, `POST /cube/api/editprimer` |
| 1.7 | Delete the cube and verify it no longer appears                  | `POST /cube/remove/:id`                                    |

**Preconditions**: Authenticated user (use auth setup from existing helpers).

### 2. Card Management (`card-management.spec.ts`)

Adding and removing cards is the primary cube-building action.

| #   | Test Case                                                         | Route(s) Exercised             |
| --- | ----------------------------------------------------------------- | ------------------------------ |
| 2.1 | Add a card to the cube mainboard                                  | `POST /cube/api/addtocube/:id` |
| 2.2 | Verify the card appears in the cube list view                     | `GET /cube/list/:id`           |
| 2.3 | Bulk upload cards via text input                                  | `POST /cube/bulkupload/:id`    |
| 2.4 | Switch between list display modes (Table, Visual Spoiler, Curve)  | Client-side UI                 |
| 2.5 | Switch between boards (Mainboard, Maybeboard)                     | Client-side UI                 |
| 2.6 | Update boards (move/remove cards) and verify changelog is created | `POST /cube/updateboards/:id`  |
| 2.7 | View the changelog and verify card additions/removals appear      | `GET /cube/changelog/:id`      |

**Preconditions**: Authenticated user with a cube containing at least one card.

### 3. Draft Workflow (`draft-workflow.spec.ts`)

Drafting is the primary interactive feature and the reason most users visit the platform.

| #   | Test Case                                                  | Route(s) Exercised                                     |
| --- | ---------------------------------------------------------- | ------------------------------------------------------ |
| 3.1 | Navigate to the playtest page for a cube                   | `GET /cube/playtest/:id`                               |
| 3.2 | Start a new draft with default settings                    | `POST /draft/start/:id`                                |
| 3.3 | Verify the draft page loads with a pack of cards           | `GET /draft/:id`                                       |
| 3.4 | Pick a card from the pack                                  | Client-side UI (DnD / click)                           |
| 3.5 | Complete all picks in the draft (automated fast-pick loop) | Client-side UI                                         |
| 3.6 | Finish the draft and land on the deckbuilder               | `POST /draft/finish/:id`, `GET /draft/deckbuilder/:id` |
| 3.7 | Submit the deck                                            | `POST /cube/deck/submitdeck/:id`                       |
| 3.8 | Verify the completed deck appears on the cube's deck list  | `GET /cube/playtest/:id` (Decks tab)                   |

**Preconditions**: Authenticated user with a cube containing ≥45 cards (minimum for a 3-pack, 15-card draft).

### 4. Explore & Discovery (`explore-discovery.spec.ts`)

The primary entry point for unauthenticated users and the main discovery mechanism.

| #   | Test Case                                                                             | Route(s) Exercised                |
| --- | ------------------------------------------------------------------------------------- | --------------------------------- |
| 4.1 | Load the landing page and verify key sections render                                  | `GET /landing`                    |
| 4.2 | Load the explore page and verify Featured, Recent, Popular, Recently Drafted sections | `GET /explore`                    |
| 4.3 | Click on a cube from explore and verify the cube page loads                           | `GET /cube/overview/:id`          |
| 4.4 | Search for cubes by name and verify results appear                                    | `GET /search?q=...`               |
| 4.5 | Paginate search results                                                               | `POST /search/getmoresearchitems` |
| 4.6 | Sort search results by popularity, date, alphabetical                                 | `GET /search?order=...`           |

**Preconditions**: None (unauthenticated).

---

## P1 — High Value

### 5. Authentication Extended (`auth-extended.spec.ts`)

Extending the existing auth tests with additional flows.

| #   | Test Case                                                       | Route(s) Exercised         |
| --- | --------------------------------------------------------------- | -------------------------- |
| 5.1 | Login with invalid credentials → error message                  | `POST /user/login`         |
| 5.2 | Register with duplicate username → error message                | `POST /user/register`      |
| 5.3 | Register with invalid email → validation error                  | `POST /user/register`      |
| 5.4 | Logout and verify session is cleared                            | `GET /user/logout`         |
| 5.5 | Access authenticated route while logged out → redirect to login | `GET /user/account`        |
| 5.6 | Update user display preferences (theme toggle)                  | `POST /user/changedisplay` |
| 5.7 | Change password while logged in                                 | `POST /user/resetpassword` |

### 6. Dashboard (`dashboard.spec.ts`)

The logged-in user's home page, aggregating activity across the platform.

| #   | Test Case                                                   | Route(s) Exercised                 |
| --- | ----------------------------------------------------------- | ---------------------------------- |
| 6.1 | Dashboard loads and shows "Your Cubes" section              | `GET /dashboard`                   |
| 6.2 | Dashboard shows feed items (blog posts from followed cubes) | `GET /dashboard`                   |
| 6.3 | Create a new cube from the dashboard                        | `POST /cube/add`                   |
| 6.4 | Paginate feed items                                         | `POST /dashboard/getmorefeeditems` |
| 6.5 | Paginate recent decks                                       | `POST /dashboard/getmoredecks`     |

**Preconditions**: Authenticated user with at least one cube.

### 7. Cube Navigation & Views (`cube-navigation.spec.ts`)

Verifying the cube sub-page navigation works correctly across all tabs.

| #   | Test Case                                                      | Route(s) Exercised               |
| --- | -------------------------------------------------------------- | -------------------------------- |
| 7.1 | Navigate between Overview, List, Playtest, Analysis, Blog tabs | Multiple `GET /cube/*/:id`       |
| 7.2 | Cube Overview shows correct metadata (card count, name, owner) | `GET /cube/overview/:id`         |
| 7.3 | Cube List page loads and shows cards in table view             | `GET /cube/list/:id`             |
| 7.4 | Cube Analysis page loads with charts/data                      | `GET /cube/analysis/:id`         |
| 7.5 | Cube Blog page loads and shows posts                           | `GET /cube/blog/:id`             |
| 7.6 | Cube About page loads                                          | `GET /cube/about/:id`            |
| 7.7 | Cube Settings page loads (owner only)                          | `GET /cube/settings/:id`         |
| 7.8 | Compare two cubes                                              | `GET /cube/compare/:idA/to/:idB` |

### 8. Blog Posts (`blog-posts.spec.ts`)

Blog posts are auto-generated on cube changes and manually created by cube owners.

| #   | Test Case                                            | Route(s) Exercised                       |
| --- | ---------------------------------------------------- | ---------------------------------------- |
| 8.1 | Create a blog post on a cube                         | `POST /cube/blog/post/:id`               |
| 8.2 | Verify the blog post appears on the cube's blog page | `GET /cube/blog/:id`                     |
| 8.3 | View a specific blog post                            | `GET /cube/blog/blogpost/:id`            |
| 8.4 | Delete a blog post                                   | `GET /cube/blog/remove/:id`              |
| 8.5 | Paginate blog posts on a cube                        | `POST /cube/blog/getmoreblogsbycube/:id` |

### 9. Deck Viewing & Export (`deck-export.spec.ts`)

Users frequently export decks to other tools.

| #   | Test Case                           | Route(s) Exercised                        |
| --- | ----------------------------------- | ----------------------------------------- |
| 9.1 | View a completed deck page          | `GET /cube/deck/:id`                      |
| 9.2 | Download deck as plaintext (`.txt`) | `GET /cube/deck/download/txt/:id/:seat`   |
| 9.3 | Download deck for Arena             | `GET /cube/deck/download/arena/:id/:seat` |
| 9.4 | Download deck for MTGO              | `GET /cube/deck/download/mtgo/:id/:seat`  |
| 9.5 | Delete a deck                       | `DELETE /cube/deck/deletedeck/:id`        |

### 10. Cube Export (`cube-export.spec.ts`)

Users export cube lists to use in other platforms.

| #    | Test Case                         | Route(s) Exercised                 |
| ---- | --------------------------------- | ---------------------------------- |
| 10.1 | Download cube as CSV              | `GET /cube/download/csv/:id`       |
| 10.2 | Download cube as plaintext        | `GET /cube/download/plaintext/:id` |
| 10.3 | Download cube in CubeCobra format | `GET /cube/download/cubecobra/:id` |
| 10.4 | Download cube for MTGO            | `GET /cube/download/mtgo/:id`      |
| 10.5 | Download cube for Forge           | `GET /cube/download/forge/:id`     |
| 10.6 | Download cube for XMage           | `GET /cube/download/xmage/:id`     |

---

## P2 — Important

### 11. Social Features (`social.spec.ts`)

Following, notifications, and comments drive community engagement.

| #    | Test Case                    | Route(s) Exercised              |
| ---- | ---------------------------- | ------------------------------- |
| 11.1 | Follow a cube                | `POST /cube/follow/:id`         |
| 11.2 | Unfollow a cube              | `POST /cube/unfollow/:id`       |
| 11.3 | Follow a user                | `GET /user/follow/:id`          |
| 11.4 | Unfollow a user              | `GET /user/unfollow/:id`        |
| 11.5 | View social connections page | `GET /user/social`              |
| 11.6 | View notifications page      | `GET /user/notifications`       |
| 11.7 | Clear notifications          | `POST /user/clearnotifications` |

### 12. Comments (`comments.spec.ts`)

| #    | Test Case                    | Route(s) Exercised          |
| ---- | ---------------------------- | --------------------------- |
| 12.1 | Add a comment on a blog post | `POST /comment/addcomment`  |
| 12.2 | View comments on a blog post | `POST /comment/getcomments` |
| 12.3 | Edit a comment               | `POST /comment/edit`        |
| 12.4 | View a specific comment page | `GET /comment/:id`          |

### 13. Sample Packs & P1P1 (`sample-packs.spec.ts`)

| #    | Test Case                                    | Route(s) Exercised               |
| ---- | -------------------------------------------- | -------------------------------- |
| 13.1 | Generate a random sample pack from a cube    | `GET /cube/samplepack/:id`       |
| 13.2 | Generate a seeded sample pack (reproducible) | `GET /cube/samplepack/:id/:seed` |
| 13.3 | View Daily P1P1 on the dashboard             | Dashboard component              |
| 13.4 | Vote on a P1P1 pack                          | `GET /cube/p1p1/:packId`         |

### 14. Card Search (`card-search.spec.ts`)

| #    | Test Case                                    | Route(s) Exercised                       |
| ---- | -------------------------------------------- | ---------------------------------------- |
| 14.1 | Search for a card by name                    | `GET /tool/card/:id` or card search page |
| 14.2 | View a card's detail page                    | `GET /tool/card/:id`                     |
| 14.3 | Use the advanced filter syntax               | CardSearchPage filter UI                 |
| 14.4 | Card autocomplete works in search/add inputs | `GET /cube/api/cardnames`                |

### 15. User Profile (`user-profile.spec.ts`)

| #    | Test Case                        | Route(s) Exercised          |
| ---- | -------------------------------- | --------------------------- |
| 15.1 | View own profile page            | `GET /user/view/:id`        |
| 15.2 | View another user's profile page | `GET /user/view/:id`        |
| 15.3 | View another user's cube list    | `GET /user/view/:id`        |
| 15.4 | View another user's blog posts   | `GET /user/blog/:id`        |
| 15.5 | View another user's decks        | `GET /user/decks/:id`       |
| 15.6 | Update account info (username)   | `POST /user/updateuserinfo` |
| 15.7 | Update email                     | `POST /user/updateemail`    |

### 16. Grid Draft (`grid-draft.spec.ts`)

Grid draft is an alternative draft format.

| #    | Test Case                        | Route(s) Exercised                   |
| ---- | -------------------------------- | ------------------------------------ |
| 16.1 | Start a grid draft               | `POST /cube/startgriddraft/:id`      |
| 16.2 | Verify the grid draft page loads | `GET /cube/griddraft/:id`            |
| 16.3 | Make picks in a grid draft       | Client-side UI                       |
| 16.4 | Complete and submit a grid draft | `POST /cube/api/submitgriddraft/:id` |

### 17. Sealed (`sealed.spec.ts`)

| #    | Test Case                            | Route(s) Exercised           |
| ---- | ------------------------------------ | ---------------------------- |
| 17.1 | Start a sealed event                 | `POST /cube/startsealed/:id` |
| 17.2 | View the sealed pool and deckbuilder | Client-side UI               |
| 17.3 | Build and submit a sealed deck       | Deck submission flow         |

### 18. Bulk Upload & File Import (`bulk-operations.spec.ts`)

| #    | Test Case                                     | Route(s) Exercised               |
| ---- | --------------------------------------------- | -------------------------------- |
| 18.1 | Bulk upload cards via text area               | `POST /cube/bulkupload/:id`      |
| 18.2 | Bulk upload cards via CSV file                | `POST /cube/bulkuploadfile/:id`  |
| 18.3 | Bulk replace cube via file                    | `POST /cube/bulkreplacefile/:id` |
| 18.4 | Verify uploaded cards appear in the cube list | `GET /cube/list/:id`             |

---

## P3 — Nice to Have

### 19. Card Packages (`packages.spec.ts`)

| #    | Test Case                   | Route(s) Exercised                                       |
| ---- | --------------------------- | -------------------------------------------------------- |
| 19.1 | Browse card packages        | `GET /packages`                                          |
| 19.2 | View a specific package     | `GET /packages/:id`                                      |
| 19.3 | Create a new package        | `POST /packages/submit`                                  |
| 19.4 | Upvote / downvote a package | `GET /packages/upvote/:id`, `GET /packages/downvote/:id` |

### 20. Content Browsing (`content.spec.ts`)

| #    | Test Case                    | Route(s) Exercised         |
| ---- | ---------------------------- | -------------------------- |
| 20.1 | Browse all published content | `GET /content/browse`      |
| 20.2 | Browse articles              | `GET /content/articles`    |
| 20.3 | Browse videos                | `GET /content/videos`      |
| 20.4 | Browse podcasts              | `GET /content/podcasts`    |
| 20.5 | View a specific article      | `GET /content/article/:id` |

### 21. Match Records (`records.spec.ts`)

| #    | Test Case                          | Route(s) Exercised                      |
| ---- | ---------------------------------- | --------------------------------------- |
| 21.1 | View records page for a cube       | `GET /cube/records/:id`                 |
| 21.2 | Create a new match record          | `POST /cube/records/create/:id`         |
| 21.3 | Add rounds and results to a record | `POST /cube/records/edit/round/add/:id` |
| 21.4 | View a specific record             | `GET /cube/record/:id`                  |
| 21.5 | Delete a record                    | `DELETE /cube/records/remove/:id`       |

### 22. Cube Restore & History (`cube-restore.spec.ts`)

| #    | Test Case                        | Route(s) Exercised       |
| ---- | -------------------------------- | ------------------------ |
| 22.1 | View cube restore page           | `GET /cube/restore/:id`  |
| 22.2 | Restore cube to a previous state | `POST /cube/restore/:id` |
| 22.3 | Clone a cube                     | `GET /cube/clone/:id`    |

### 23. Draft Formats (`draft-formats.spec.ts`)

| #    | Test Case                           | Route(s) Exercised                           |
| ---- | ----------------------------------- | -------------------------------------------- |
| 23.1 | Add a custom draft format to a cube | `POST /cube/format/add/:id`                  |
| 23.2 | Update an existing draft format     | `POST /cube/format/update/:id`               |
| 23.3 | Remove a draft format               | `GET /cube/format/remove/:cubeid/:index`     |
| 23.4 | Set a default draft format          | `GET /cube/:id/defaultdraftformat/:formatId` |
| 23.5 | Start a draft with a custom format  | `POST /draft/start/:id` with format params   |

### 24. Static Pages (`static-pages.spec.ts`)

| #    | Test Case                   | Route(s) Exercised |
| ---- | --------------------------- | ------------------ |
| 24.1 | Contact page loads          | `GET /contact`     |
| 24.2 | Donate page loads           | `GET /donate`      |
| 24.3 | Filters help page loads     | `GET /filters`     |
| 24.4 | Markdown help page loads    | `GET /markdown`    |
| 24.5 | Terms of Service page loads | `GET /tos`         |
| 24.6 | Privacy Policy page loads   | `GET /privacy`     |
| 24.7 | Version page loads          | `GET /version`     |

### 25. Recent Drafts (`recent-drafts.spec.ts`)

| #    | Test Case               | Route(s) Exercised           |
| ---- | ----------------------- | ---------------------------- |
| 25.1 | View recent drafts page | `GET /recentdrafts`          |
| 25.2 | Paginate recent drafts  | `POST /recentdrafts/getmore` |

### 26. Short URLs (`short-urls.spec.ts`)

| #    | Test Case                              | Route(s) Exercised |
| ---- | -------------------------------------- | ------------------ |
| 26.1 | `/c/:id` redirects to `/cube/list/:id` | `GET /c/:id`       |
| 26.2 | `/d/:id` redirects to draft page       | `GET /d/:id`       |

### 27. Cube Public API (`cube-api.spec.ts`)

| #    | Test Case                            | Route(s) Exercised                       |
| ---- | ------------------------------------ | ---------------------------------------- |
| 27.1 | Fetch cube data as JSON (public API) | `GET /cube/api/cubeJSON/:id`             |
| 27.2 | Fetch card names for autocomplete    | `GET /cube/api/cardnames`                |
| 27.3 | Fetch card images endpoint           | `GET /cube/api/cardimages`               |
| 27.4 | Fetch cube card names by board       | `GET /cube/api/cubecardnames/:id/:board` |

### 28. RSS Feed (`rss.spec.ts`)

| #    | Test Case                                   | Route(s) Exercised  |
| ---- | ------------------------------------------- | ------------------- |
| 28.1 | Fetch RSS feed for a cube                   | `GET /cube/rss/:id` |
| 28.2 | Feed contains valid XML with recent changes | `GET /cube/rss/:id` |

---

## Test Infrastructure Recommendations

### Shared Fixtures & Helpers to Build

| Helper                 | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `cubeActions.ts`       | Create cube, add cards, update settings, delete cube              |
| `draftActions.ts`      | Start draft, pick cards, finish draft, submit deck                |
| `navigationActions.ts` | Navigate to cube tabs, verify page loads, breadcrumb checks       |
| `cardActions.ts`       | Add card to cube, bulk upload, verify card in list                |
| `socialActions.ts`     | Follow/unfollow cube/user, add comment                            |
| `blogActions.ts`       | Create blog post, verify blog post, delete blog post              |
| `deckActions.ts`       | View deck, download deck, delete deck                             |
| `apiActions.ts`        | Direct API calls for setup/teardown (bypass UI when seeding data) |

### Test Data Strategy

1. **Shared seed cube**: Create a well-populated cube (360 cards) once in a `globalSetup` and reuse across read-only tests to avoid slow per-test cube creation.
2. **Per-test cubes**: Tests that modify cubes (add/remove cards, delete cube) should create their own disposable cube.
3. **Card data**: Maintain a fixture file (`fixtures/cards.json`) with a reliable set of card names known to exist in the CubeCobra card database (e.g., "Lightning Bolt", "Counterspell", "Swords to Plowshares").
4. **Test user**: Continue using the generated test user from `test-config.json`. Consider creating a second test user for social interaction tests (follow, comment on another user's cube).

### Execution Strategy

```
tests/
├── setup/
│   └── global-setup.spec.ts          # Create shared test cube + seed cards (runs first)
├── p0/
│   ├── cube-lifecycle.spec.ts
│   ├── card-management.spec.ts
│   ├── draft-workflow.spec.ts
│   └── explore-discovery.spec.ts
├── p1/
│   ├── auth-extended.spec.ts
│   ├── dashboard.spec.ts
│   ├── cube-navigation.spec.ts
│   ├── blog-posts.spec.ts
│   ├── deck-export.spec.ts
│   └── cube-export.spec.ts
├── p2/
│   ├── social.spec.ts
│   ├── comments.spec.ts
│   ├── sample-packs.spec.ts
│   ├── card-search.spec.ts
│   ├── user-profile.spec.ts
│   ├── grid-draft.spec.ts
│   ├── sealed.spec.ts
│   └── bulk-operations.spec.ts
└── p3/
    ├── packages.spec.ts
    ├── content.spec.ts
    ├── records.spec.ts
    ├── cube-restore.spec.ts
    ├── draft-formats.spec.ts
    ├── static-pages.spec.ts
    ├── recent-drafts.spec.ts
    ├── short-urls.spec.ts
    ├── cube-api.spec.ts
    └── rss.spec.ts
```

### Playwright Projects (Ordering)

Use Playwright's `project.dependencies` to ensure setup runs before feature tests:

```typescript
// playwright.config.ts
projects: [
  { name: 'setup', testDir: './tests/setup' },
  { name: 'p0', testDir: './tests/p0', dependencies: ['setup'] },
  { name: 'p1', testDir: './tests/p1', dependencies: ['setup'] },
  { name: 'p2', testDir: './tests/p2', dependencies: ['setup'] },
  { name: 'p3', testDir: './tests/p3', dependencies: ['setup'] },
];
```

### CI Integration

- **PR checks**: Run P0 only (~4 tests, fast feedback).
- **Merge to main**: Run P0 + P1 (~11 test files).
- **Nightly/scheduled**: Run all tiers (P0–P3, ~28 test files).

---

## Summary

| Tier      | Test Files | Test Cases | Coverage Area                                                                |
| --------- | ---------- | ---------- | ---------------------------------------------------------------------------- |
| P0        | 4          | 27         | Cube CRUD, card management, drafting, explore/search                         |
| P1        | 6          | 30         | Auth edge cases, dashboard, navigation, blog, deck/cube export               |
| P2        | 8          | 27         | Social, comments, sample packs, card search, profiles, grid/sealed, bulk ops |
| P3        | 10         | 26         | Packages, content, records, restore, formats, static pages, API, RSS         |
| **Total** | **28**     | **110**    |                                                                              |
