I'm very excited to announce a large number of changes that we have been working on the last few months. The guiding philosophy behind this update is that we want to make the site intuitive and easy to use, especially towards newcomers to Cube. I think that I have developed a sort of tunnel vision in some respects with how users are actually interacting with the site, and grown too comfortable with the current status quo of the UX. Over time we have added features that I now believe don't actually belong on the site, and also we have many features that are very useful but due to bad UX design have been misunderstood and underutilized.

### Some New Stuff

I've added a special "Voucher Card". Similar to "Custom Card" - this is a special cased card. This one allows you to add cards nested inside the voucher. When you draft a voucher, you get all the cards contained in it! Perfect for if you want a buy-one-get-four squadron hawk, or perhaps want to allow drafters to pickup a copy of Urza's Tower, Power plant, and Mine all in one pick.

"At a Glance" is a new feature heavily inspired by the work done by @haganbmj [here](https://Cube.griselbrand.com/). The existing analysis tools technically could do everything shown here, but this page makes it much easier to get some simple analysis done.

Point-in-time views have finally arrived. Our data model has always supported this, but I haven't gotten around to implementing this until now. Click on any Cube changelog and now you can look at that Cube as a point-in-time directly after that changelog was applied. Compare it with the current list, maybe export the difference. This one has definitely grown to be one of my go-tos for figuring out all the changes I made to my Cube list over a few weeks (and many small changelogs) that I now need to reflect in the physical copy.

We added a page with some API docs. About time.

### UI Changes

We have restructured the overall navigation of the site. Outside of Cube pages, there are four main sections: Landing, Explore, Resources, and Help. Resources is brand new - I do think CubeCobra should be a hub where we link and promote other projects in the Cube space. If you have or use a project you feel is appropriate to be listed there, please let me know and I will consider adding it! Help pages are a consolidation of other miscellaneous pages, now bundled into a more organized hub. These pages now feature splash images using some of the artwork I have commissioned over the years - it feels very satisfying to put those gorgeous (imo) pieces in a place they can be appreciated by more people. 

The home page has mostly been simplified. This refers to both the logged out and logged in variants. I've removed sections for recent drafts and content. A search component has been added that can be toggled between searching for Cubes, Cards, and Packages - with some example queries. I believe that putting this here will lead to more organic discovery of features.

Packages have been a feature on the site for many years, but for most of that time have been clunky and/or broken. I've now promoted packages to be a front and center entity alongside cubes. You can now quickly create a new package, view your packages, and view the packages you've liked. When you're editing a Cube, you can easily pull up those lists of packages and add them directly to your Cube. Packages have been moved under the explore menu. Of note- packages are immutable by design. Similar philosophy to sites like Twitter where we don't want to allow packages with a lot of likes to be modified.

User profile pages have been overhauled. Packages have been added as a new tab, and now it is easy to view a user's follows, followers, liked cubes, and liked packages. The Cube and deck preview component has been revised, I think it looks a little sleeker now. "Account Information" has been rebranded as "Settings" and also has an overhauled UI.

I've streamlined the new user workflow. Cubes can now be created with a simple click. When you open an empty Cube, you are now presented with a getting started guide, with a couple options for adding cards into the Cube. I think we have underestimated the gap that non-Cube designers have to experience to actually start designing a Cube. My hope is that these changes help bridge that gap, and make Cube curation more accessible and easier to get started with.

### ML Features

CubeCobra has maintained a fairly sophisticated machine learning model that has evolved a lot over the years. This model powers our draftbots, card synergy (seen on card pages), bot deckbuilder, and also the Smart Search (previously called recommender). We have just published a new version of the model, freshly trained! This model architecture has been tweaked so the draftbots now have full context of the Cube that is being drafted. The deckbuild has been overhauled, but the model is the same - we only changed the algorithm that uses the model. The results look quite good, but we're still keeping an eye out for edge cases and anomalies and will adjust as needed.

As I mentioned earlier, the Recommender has now been rebranded as Smart Search. I believe this feature has suffered from bad branding, and a UX that doesn't encourage users to use it in a useful way. This feature isn't meant to just give you cards to add to your Cube - it is a way to search for cards and use the context of the Cube to sort the cards in a more meaningful way. When I explore cards on Scryfall, I would often use "EDHRec Rank" sorting, which is fine, but not great. Using the same queries in Smart Search yields more fruitful results, in my experience.

I've created a new development tool I call "Archetype Annotater". Similar to the [Lucky Paper Cube Map](https://luckypaper.co/articles/mapping-the-magic-landscape/), it projects all decks drafted on Cobra, and then clusters them. I've tuned the tool to result in around 50 clusters, of which I've hand annotated. Now your drafts (and the bot seats) will automatically have more meaningful names, by projecting the deck into that same space and figuring out which cluster it belongs to.

Draft Simulator is a very large new feature that one of our contributors has been tinkering with over the last few months. A lot of really good engineering work has been put into making this feature a reality - including setting up a system that supports our ML model to run in-browser. This allows us to run simulated bot drafts without creating unreasonable compute costs on our end, allowing us to do several thousand drafts and do some fascinating analysis on the results. It uses the archetype annotation to label clusters, and also uses the Smart Search to find new cards for a specific discovered archetype. There is really a lot going on here, so please try it out and let us know what you think!

### Costs and Performance

Alright this section will maybe not be as fun of a read. CubeCobra does rely on advertisement revenue in order to cover our infrastructure costs. Users can opt-out of ads by just giving $1 a month on Patreon - and that makes a huge difference on our bottom line. Unfortunately, the state of the Internet and generative AI has wreaked havoc on the advertising industry. Despite having over twice as much traffic today as we did this day last year, we are bringing in about half as much from advertisements. Fortunately, affiliate traffic has grown which has helped balance the budget.

So with that context in mind, I've decided to spend a lot of time on analyzing our usage, understanding what is contributing to our costs, and making infrastructure changes to help improve costs and performance. We've implemented several new patterns, including moving a lot more of our static content into a CDN. We also changed how detailed card information hits your browser so more information is cached locally. Autocomplete has been moved completely to the server side, avoiding the need to download large files that powered those controls. We've found these changes have significantly reduced the amount of data sent from servers to your browser, which saves us in data transfer costs. The wins here have also lightened the load on servers, which has allowed us to scale back our servers while maintaining the same level of user load.

Some of the UX decisions described here have been motivated by reducing data transfer. That's why we decided to remove content and recent drafts from the home page. That is a high volume page, with slow load times due to having to perform several complex queries to fetch all the data that was shown. The functionality is still present, you just need to navigate to the appropriate page. 

### Content

The changes here are the ones I'm probably the least confident about, but these feelings have been growing for several years now. When CubeCobra was in its infancy, I looked towards deck building and other Magic websites for inspiration on what features users may want. I recognized that Cube designers want a place to share their thoughts, and may appreciate reading about other designers' thoughts. That is why I created the content sections of the site. In hindsight, I see this as a mistake. I think it is more important that CubeCobra focuses on its core product, being a Cube management platform, and other platforms dedicated for content sharing are where that happens. 

With this update, I will no longer be publishing new content on Cube Cobra. I will leave registered podcasts up on the Resources page, and I am happy to add new Cube related podcasts there as well. All content will still be accessible in our content archive, so nothing is lost. I hope that deciding to remove the suite of features will allow us to focus more on the stuff that is actually essential to the platform.


# New Features

- New API Documentation page (`/apidocs`) — reference for all public API endpoints
- New "Voucher" card type — contains a list of other cards; when drafted it expands into its contained cards instead of being picked directly. Supports custom names, `is:voucher` filter, and CSV import/export
- New "At a Glance" analysis page — dashboard of key stats, pricing, mana curve, and distribution charts
- New cubes get a random art crop from a curated card set instead of always Doubling Cube
- Changelog entries are now clickable, each linking to a detail page with the full changelog
- Point-in-time Cube list view on changelog detail pages — same view controls (table, visual spoiler, curve, stacks), filter, sort, and display sidebar as the main list, boards kept distinct (mainboard, maybeboard)
- "Download Point in Time Cube" on changelog detail pages — reconstructs the historical Cube as CSV
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
- Added `date_last_updated` to Cube exports
- New "Use Base Card Data" display option — sorts/filters use a card's original printed attributes (CMC, colors, color category, type, rarity, name) instead of overrides
- New "Disable Follow Notifications" setting — suppress notifications when users follow your Cube or you
- Bot decks get meaningful archetype names (e.g. "UW Control", "RG Aggro") from hand annotated ML cluster centers instead of generic labels
- Deck naming is back — set your own deck name in the deckbuilder; blank auto-generates a cluster-based archetype name
- New Draft Simulator (in the Cube nav) — runs hundreds of full drafts against the ML bots in your browser, then shows per-card pick stats (average pick, wheel rate, draft rating vs. Elo), the archetypes that emerged with color-pair breakdown, a draft map, and the simulated bot decks and pools; choose drafts/seats, filter and sort the stats, and drill into any archetype or deck
- Streamlined Cube creation — "Create A New Cube" creates it instantly (named `<username>'s New Cube`) and lands you on its list page, no modal; rename from the Cube hero anytime
- Edit sidebar expanded by default on desktop when viewing the list page of an empty Cube you own
- New "Welcome to your new Cube!" onboarding card on an empty owned Cube's list page, pointing to the edit sidebar, packages, or the seed crystal generator
- New "Seed Crystal" generator — bootstrap a partial or complete Cube from one seed card using the draftbot and smart search models
- Renamed the "Recommender" Analysis tab to "Smart Search" and rebuilt it to match CubeCobra's search UX: inline filter, paginated grid of card images, same context-aware sort. Core Cards panel, maybeboard toggle, and show-images checkbox removed
- Brought back "Save as Default Sort" in the display sidebar — saves the current sort as the active view's default
- New help blurbs at the bottom of the display and edit sidebars (links to Boards/Views settings and Smart Search)
- Edit sidebar's Board dropdown defaults to the first board in the current view (and follows view switches) instead of always Mainboard
- Richer link previews for shared blog posts and comments — comment links show the comment text and poster avatar; blog links show an excerpt plus a changelist summary with the Cube's image
- Redesigned landing page and dashboard with a new hero — unified search across cubes, cards, and packages with suggestion chips, and a Featured Cubes marquee. Landing is hero-only; the dashboard sits below with Daily P1P1 and Your Cubes split 50/50 and the activity feed under Daily P1P1 (standalone "Latest Content" and "Featured Cubes" cards removed)
- Redesigned Cube preview tiles — cover image fills the tile, with name, category tags, follower/card counts, and owner overlaid on a bottom gradient
- New Resources page at `/resources` (top nav) — community tools, the content archive (articles, videos, podcasts), Cube communities, Hedron Network, the Cube Map, and latest podcasts
- Restructured top nav and footer — Home is top-level, Explore is a richer sectioned dropdown with a Search Cubes shortcut, a top-level Resources entry, separate Login/Register for logged-out users; navbar Cube search and the Explore Cubes page removed; footer reorganized with Popular / Recently Updated / Recently Drafted links
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
- Reorganized the "Your Stuff" / mobile cubes dropdown into Your Cubes, Actions (create Cube/package), and More (View all, Liked, Drafts, View all packages, Liked packages)
- Pin your own cubes — a Pin toggle replaces Like on cubes you own; pinned cubes sort to the top of the Your Cubes dropdown, your dashboard, and your profile's Cubes page

# Bug Fixes

- Fixed deck data exports containing invalid -1 card values — exports now exclude cards that couldn't be mapped to valid IDs
- Fixed quarterly data exports including private/unlisted cubes — Cube and deck export jobs now only export public cubes
- Fixed blog posts from private/unlisted cubes leaking into follower feeds — blog posts, commits, package adds, and bulk imports for non-public cubes no longer publish feed items
- Fixed unlisted-Cube blog posts visible on user blog pages and dashboard feeds — display filtering now excludes private and unlisted (was private only)
- Fixed blog pagination (`getmoreblogsbycube`) missing a visibility check — now verifies the Cube exists and is viewable
- Fixed Cube JSON API (`/Cube/api/cubeJSON/:id`) using stale `Cube.defaultSorts` — now returns all boards and applies the standard default sort (Color Category → Types-Multicolor → Mana Value → Alphabetical)
- Fixed moving cards between boards keeping the card on the same board — the target board selector wasn't resetting when switching between cards on different boards
- Fixed "Cannot set properties of undefined (setting 'markedForDelete')" crash from stale localStorage changes referencing missing card indices — now treated as a version mismatch via the existing recovery flow
- Fixed sample pack/P1P1 generation failing for custom draft formats referencing non-mainboard boards — pack generation now passes all boards to the draft engine
- Fixed view-level `defaultSorts` not applied on page load (only Cube-level sorts were)
- Fixed bookmarked URLs with query params (view, sort, filters) not applied on load — the view-defaults effect was also firing on initial mount and overwriting URL values
- Fixed Scunthorpe problem in the profanity filter — spam/marketing terms use word-boundary matching while slurs use substring matching, so words like "senft" no longer falsely trigger
- Fixed list view selections persisting after removing cards — checked state used stale indices after "Edit Selected" → "Remove all" → "Save Changes"
- Improved draft creation errors — now distinguish no cards in a board, running out mid-draft (with count and suggestions), and remaining cards not matching a slot filter (with filter text and counts)
- Improved date display — within 7 days shows relative time ("3 hours ago"), older shows absolute ("Feb 7, 2026")
- Fixed Cube card count not updating in the hero as mainboard changes were saved
- Fixed selecting cards with accented characters (e.g. Lórien) when adding to a draft record
- Fixed deckbuild land/non-land count settings not being saved
- Moved bot deckbuilding to the client with a progress bar — instead of one long server request that could time out, the client makes ~31 small incremental ML calls (1 batch build + ~30 draft steps) with a live percentage/step counter
- Improved draft naming durability for unknown/malformed cards — naming skips missing card references instead of throwing during finish/update
- Fixed invalid-card image fallback pointing to an unreachable external URL — now uses the local default card image
- Fixed pick-by-pick breakdown collapsing duplicate cards when "collapse duplicates" is enabled
- Fixed board display order in Cube list views not respecting view settings
- Right Sidebar inline position now respected when adjusting Cube Table and Stacks layouts
- Fixed "Disable Clone Notifications" Cube setting not persisting
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
- Replaced `Cube.following[]` / `User.followedCubes[]` with a per-relationship hash-row model — one row per like on the Cube's partition (`PK=HASH#CUBE#{id}`, `SK=LIKE#{userId}`, `LIKE-BY#{userId}` GSI1) so both directions paginate; denormalized `Cube.likeCount` / `User.likedCubesCount` keep cheap displays cheap
- Same for user follows — `User.following` / `User.followedUsers` replaced with FOLLOWER rows on the followed user's partition + `FOLLOWING-BY#{userId}` GSI; counters on `User.followerCount` / `User.followingCount`; notification fanout (blogs, commits, package adds, bulk imports, devblog) pages hash rows instead of arrays
- Cube view routes (`/Cube/list`, `/about`, `/playtest`, `/analysis`, `/records`) ship cards without `details` via a new `{ populate: false }` on `cubeDao.getCards`; `about`/`analysis` rewritten to read details via `cardFromId(cardID)`
- New IndexedDB-backed client card detail cache (`cardDetailsCache.ts`) — 7-day per-row TTL, microtask coalescing of misses into one batch POST, `useCardDetail`/`useCardDetails` hooks
- `CubeContext` detects undetailed cards on mount, hydrates from the cache, and exposes `cardsLoading`; all client callers of `getdetailsforcards`/`getcardfromid` rerouted through the cache
- Draft Simulator runs the draft/deckbuild ML models in-browser via TensorFlow.js — model bundle fetched once from the CDN (`/model/*`), drafts/deckbuilding/clustering all client-side (no app or recommender fleet load), results cached in IndexedDB so reopening is instant; the model is a one-shot manual upload to the assets bucket (`scripts/uploadMLModel.ts`), not a per-deploy step
