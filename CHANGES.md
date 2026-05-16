I'm very excited to announce a large number of changes that we have been working on the last few months. The guiding philosophy behind this update is that we want to make the site intuitive and easy to use, especially towards newcomers to Cube. I recently had a conversation with someone who was a long time magic player, but had never made a cube. I observed them using the website, and they often expressed confusion or even frustration at certain points. I think that I have developed a sort of tunnel vision in some respects with how users are actually interacting with the site, and grown too comfortable with the current status quo of the site. 


# New Features

- New API Documentation page (`/apidocs`) — reference for all public API endpoints
- New "Voucher" card type — contains a list of other cards; when drafted it expands into its contained cards instead of being picked directly. Supports custom names, `is:voucher` filter, and CSV import/export
- New "At a Glance" analysis page — dashboard of key stats, pricing, mana curve, and distribution charts
- New cubes get a random art crop from a curated card set instead of always Doubling Cube
- Changelog entries are now clickable, each linking to a detail page with the full changelog
- Point-in-time cube list view on changelog detail pages — same view controls (table, visual spoiler, curve, stacks), filter, sort, and display sidebar as the main list, boards kept distinct (mainboard, maybeboard)
- "Download Point in Time Cube" on changelog detail pages — reconstructs the historical cube as CSV
- "Compare Point in Time Cube with Present" — side-by-side historical vs current
- Export button on all compare pages (regular and PIT) — text file with In Both, Only in Base, Only in Comparison
- New `First Year` group sort (year a card was first printed)
- New `Keywords` group sort (group by keyword, e.g. Flying, Trample)
- New `year:`/`firstyear:`/`fy:` filter for first print year (e.g. `year>2000`, `fy<=1995`)
- New `kw:`/`keyword:`/`keywords:` filter by keyword (e.g. `kw:flying`, `keywords>3`)
- New `is:standard` filter — first printed in a standard expansion
- New `is:supplemental` filter — first printed in a supplemental product
- Improved bot deckbuilding — no changes to model but changed how we are using it
- `game:arena`/`game:paper`/`game:mtgo` now match any printing ever available in that game, not just the current printing
- New `game:is-arena`/`game:is-paper`/`game:is-mtgo` filter — only the specific printing's availability (the old strict behavior)
- Adding a collaborator now notifies that user
- Added `date_last_updated` to cube exports
- New "Use Base Card Data" display option — sorts/filters use a card's original printed attributes (CMC, colors, color category, type, rarity, name) instead of overrides
- New "Disable Follow Notifications" setting — suppress notifications when users follow your cube or you
- Bot decks get meaningful archetype names (e.g. "UW Control", "RG Aggro") from hand annotated ML cluster centers instead of generic labels
- Deck naming is back — set your own deck name in the deckbuilder; blank auto-generates a cluster-based archetype name
- New Draft Simulator (in the cube nav) — runs hundreds of full drafts against the ML bots in your browser, then shows per-card pick stats (average pick, wheel rate, draft rating vs. Elo), the archetypes that emerged with color-pair breakdown, a draft map, and the simulated bot decks and pools; choose drafts/seats, filter and sort the stats, and drill into any archetype or deck
- Streamlined cube creation — "Create A New Cube" creates it instantly (named `<username>'s New Cube`) and lands you on its list page, no modal; rename from the cube hero anytime
- Edit sidebar expanded by default on desktop when viewing the list page of an empty cube you own
- New "Welcome to your new cube!" onboarding card on an empty owned cube's list page, pointing to the edit sidebar, packages, or the seed crystal generator
- New "Seed Crystal" generator — bootstrap a partial or complete cube from one seed card using the draftbot and smart search models
- Renamed the "Recommender" Analysis tab to "Smart Search" and rebuilt it to match CubeCobra's search UX: inline filter, paginated grid of card images, same context-aware sort. Core Cards panel, maybeboard toggle, and show-images checkbox removed
- Brought back "Save as Default Sort" in the display sidebar — saves the current sort as the active view's default
- New help blurbs at the bottom of the display and edit sidebars (links to Boards/Views settings and Smart Search)
- Edit sidebar's Board dropdown defaults to the first board in the current view (and follows view switches) instead of always Mainboard
- Richer link previews for shared blog posts and comments — comment links show the comment text and poster avatar; blog links show an excerpt plus a changelist summary with the cube's image
- Redesigned landing page and dashboard with a new hero — unified search across cubes, cards, and packages with suggestion chips, and a Featured Cubes marquee. Landing is hero-only; the dashboard sits below with Daily P1P1 and Your Cubes split 50/50 and the activity feed under Daily P1P1 (standalone "Latest Content" and "Featured Cubes" cards removed)
- Redesigned cube preview tiles — cover image fills the tile, with name, category tags, follower/card counts, and owner overlaid on a bottom gradient
- New Resources page at `/resources` (top nav) — community tools, the content archive (articles, videos, podcasts), cube communities, Hedron Network, the Cube Map, and latest podcasts
- Restructured top nav and footer — Home is top-level, Explore is a richer sectioned dropdown with a Search Cubes shortcut, a top-level Resources entry, separate Login/Register for logged-out users; navbar cube search and the Explore Cubes page removed; footer reorganized with Popular / Recently Updated / Recently Drafted links
- Redesigned Cube Search, Card Search, and Packages pages with the Landing/Dashboard hero treatment; Top Cards consolidated into Search Cards with a **Card Images** / **Info Rows** toggle (sortable table: Cost, Type, Elo, Total Picks, Cube Count)
- Packages are created on a dedicated page; users get a Packages profile tab; navbar gains a `+` quick-create dropdown and a Your Packages menu
- New Help hub at `/help` with a shared layout — Filter Syntax, Markdown Guide, API Docs, Card Updates, Contact, and Donate share a hero with a sticky pill nav
- Liked Packages — upvoting a package also records a like (browse Packages You've Liked). Cube edit sidebar gains "Add Package" (Import): a modal with your packages and liked packages dropdowns that adds the package's cards to your changelist
- Liked Cubes page — browsable list of cubes you've liked, previously followed (also viewable for any user)
- Followers and Following pages — each its own page with the new profile layout, replacing /user/social
- Redesigned user profile pages — left side card (avatar, name, supporter badges, follower/following/liked-cubes/liked-packages count links, Edit Profile or Follow/Report, markdown bio); right-side floating tabs (Cubes/Packages/Drafts/Blog) across all profile sub-pages including Liked and Followers/Following. "Decks" tab renamed "Drafts"
- Supporter badges — active Patreon supporters get an animated "Patron" pill; tiered supporters (Cobra Hatchling, Coiling Oracle, Lotus Cobra) get a tier-coloured pill that shimmers on hover
- Settings page restyled like the Help hub — root shows section tiles (Profile, Change Password, Update Email, Display Preferences, Patreon Integration, Delete Account); picking one collapses to left pill buttons with content on the right
- Your Cubes and Packages navbar dropdowns each gain a "Liked" link
- Username menu cleanup — "Your Profile" → **Profile**, "Account Information" → **Settings**, redundant "Followed and Followers" link removed (moved to the new Followers/Following pages)
- Drafts of your cubes get their own full-width page (from the Your Cubes dropdown) with a responsive grid up to 6 per row
- Dashboard activity feed loads asynchronously after the page, uses "Show More" instead of pagination, and its empty state links to Popular Cubes; non-supporters get a banner ad every 10 posts
- Reorganized the "Your Stuff" / mobile cubes dropdown into Your Cubes, Actions (create cube/package), and More (View all, Liked, Drafts, View all packages, Liked packages)
- Pin your own cubes — a Pin toggle replaces Like on cubes you own; pinned cubes sort to the top of the Your Cubes dropdown, your dashboard, and your profile's Cubes page

# Bug Fixes

- Fixed deck data exports containing invalid -1 card values — exports now exclude cards that couldn't be mapped to valid IDs
- Fixed quarterly data exports including private/unlisted cubes — cube and deck export jobs now only export public cubes
- Fixed blog posts from private/unlisted cubes leaking into follower feeds — blog posts, commits, package adds, and bulk imports for non-public cubes no longer publish feed items
- Fixed unlisted-cube blog posts visible on user blog pages and dashboard feeds — display filtering now excludes private and unlisted (was private only)
- Fixed blog pagination (`getmoreblogsbycube`) missing a visibility check — now verifies the cube exists and is viewable
- Fixed cube JSON API (`/cube/api/cubeJSON/:id`) using stale `cube.defaultSorts` — now returns all boards and applies the standard default sort (Color Category → Types-Multicolor → Mana Value → Alphabetical)
- Fixed moving cards between boards keeping the card on the same board — the target board selector wasn't resetting when switching between cards on different boards
- Fixed "Cannot set properties of undefined (setting 'markedForDelete')" crash from stale localStorage changes referencing missing card indices — now treated as a version mismatch via the existing recovery flow
- Fixed sample pack/P1P1 generation failing for custom draft formats referencing non-mainboard boards — pack generation now passes all boards to the draft engine
- Fixed view-level `defaultSorts` not applied on page load (only cube-level sorts were)
- Fixed bookmarked URLs with query params (view, sort, filters) not applied on load — the view-defaults effect was also firing on initial mount and overwriting URL values
- Fixed Scunthorpe problem in the profanity filter — spam/marketing terms use word-boundary matching while slurs use substring matching, so words like "senft" no longer falsely trigger
- Fixed list view selections persisting after removing cards — checked state used stale indices after "Edit Selected" → "Remove all" → "Save Changes"
- Improved draft creation errors — now distinguish no cards in a board, running out mid-draft (with count and suggestions), and remaining cards not matching a slot filter (with filter text and counts)
- Improved date display — within 7 days shows relative time ("3 hours ago"), older shows absolute ("Feb 7, 2026")
- Fixed cube card count not updating in the hero as mainboard changes were saved
- Fixed selecting cards with accented characters (e.g. Lórien) when adding to a draft record
- Fixed deckbuild land/non-land count settings not being saved
- Moved bot deckbuilding to the client with a progress bar — instead of one long server request that could time out, the client makes ~31 small incremental ML calls (1 batch build + ~30 draft steps) with a live percentage/step counter
- Improved draft naming durability for unknown/malformed cards — naming skips missing card references instead of throwing during finish/update
- Fixed invalid-card image fallback pointing to an unreachable external URL — now uses the local default card image
- Fixed pick-by-pick breakdown collapsing duplicate cards when "collapse duplicates" is enabled
- Fixed board display order in cube list views not respecting view settings
- Right Sidebar inline position now respected when adjusting Cube Table and Stacks layouts
- Fixed "Disable Clone Notifications" cube setting not persisting
- Fixed edit/remove card only searching the filtered list — name lookup now searches the full unfiltered list
- Fixed card edits inflating +/- counts — edited cards now show as a separate count with a wrench icon (e.g. "+5, -3, 🔧2") in the pending panel and committed changelogs
- Fixed committing large changelogs (e.g. bulk uploads) timing out
- Improved performance of saving large updates — card data fetched in a single batch instead of one-at-a-time
- Fixed newly-released cards missing "Drafted With" and other cross-card data after being added
- Fixed Top Cards deduping rows by card name — distinct cards sharing a name (e.g. Everythingamajig) appear separately, while alternate-name printings of one card (e.g. omenpath) collapse into one
- Fixed Card Search infinite spinner on first load with no filter
- Fixed stale "0 results" while a fetch was in flight — now shows "Searching…"
- Fixed open dropdown nav menus going white-on-white in light mode on transparent-navbar hero pages
- Fixed automatic deck archetype names not applied in production — cluster-center and annotation data files were missing from production deploys, so decks fell back to a blank archetype
- Fixed draft bots making worse picks than the pick-by-pick breakdown for the same state — the live path sent raw oracle IDs while the breakdown sent normalized ones; substitution fallbacks are now skipped when the card is already known to the model, fixing stale pointers from the previous model

# Technical Changes

- Static assets (JS, CSS, fonts, images) now served via S3 + CloudFront instead of the app servers — less fleet load, better cache hit rates and latency
- Reduced the production main app fleet from 5/6 to 3/4 instances after offloading static assets to CloudFront
- Card catalog files (`imagedict`, `full_names`, `cardtree`, `cardimages`) now ship from the assets bucket via CloudFront as content-hashed objects with a small `cards/manifest.json` mapping names to hashes; the four legacy server routes are gone and the server no longer loads `full_names`/`cardtree` in memory
- Replaced `Cube.following[]` / `User.followedCubes[]` with a per-relationship hash-row model — one row per like on the cube's partition (`PK=HASH#CUBE#{id}`, `SK=LIKE#{userId}`, `LIKE-BY#{userId}` GSI1) so both directions paginate; denormalized `Cube.likeCount` / `User.likedCubesCount` keep cheap displays cheap
- Same for user follows — `User.following` / `User.followedUsers` replaced with FOLLOWER rows on the followed user's partition + `FOLLOWING-BY#{userId}` GSI; counters on `User.followerCount` / `User.followingCount`; notification fanout (blogs, commits, package adds, bulk imports, devblog) pages hash rows instead of arrays
- Cube view routes (`/cube/list`, `/about`, `/playtest`, `/analysis`, `/records`) ship cards without `details` via a new `{ populate: false }` on `cubeDao.getCards`; `about`/`analysis` rewritten to read details via `cardFromId(cardID)`
- New IndexedDB-backed client card detail cache (`cardDetailsCache.ts`) — 7-day per-row TTL, microtask coalescing of misses into one batch POST, `useCardDetail`/`useCardDetails` hooks
- `CubeContext` detects undetailed cards on mount, hydrates from the cache, and exposes `cardsLoading`; all client callers of `getdetailsforcards`/`getcardfromid` rerouted through the cache
- Draft Simulator runs the draft/deckbuild ML models in-browser via TensorFlow.js — model bundle fetched once from the CDN (`/model/*`), drafts/deckbuilding/clustering all client-side (no app or recommender fleet load), results cached in IndexedDB so reopening is instant; the model is a one-shot manual upload to the assets bucket (`scripts/uploadMLModel.ts`), not a per-deploy step
