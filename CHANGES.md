Since 1.6.0

# New Features

- New API Documentation page (`/apidocs`) — comprehensive reference for all public-facing API endpoints
- New "Voucher" card type — a special card that contains a list of other cards; when drafted, the voucher expands into its contained cards instead of being picked directly. Supports custom names, `is:voucher` filter, and CSV import/export.
- New "At a Glance" analysis page — a quick dashboard with key stats, pricing, mana curve, and distribution charts for your cube
- New cubes now get a random art crop from a curated set of cards instead of always using Doubling Cube
- Changelog entries are now clickable — each links to a dedicated detail page showing the full changelog
- Point-in-time cube list view on changelog detail pages — uses the same modern view controls (table, visual spoiler, curve, stacks), filter, sort, and display sidebar as the main cube list page, with boards kept distinct (mainboard, maybeboard)
- Full-width banner on the PIT list page clearly indicating you are viewing a historical snapshot, with a link back to the changelog entry
- "Download Point in Time Cube" on changelog detail pages — reconstructs the historical cube and downloads it as CSV
- "Compare Point in Time Cube with Present" on changelog detail pages — side-by-side comparison of historical vs current cube
- Export button on all compare pages (both regular cube compare and PIT compare) — downloads a structured text file with three sections: In Both, Only in Base, Only in Comparison
- New `First Year` group sort for sorting cards by the year they were first printed
- New `Keywords` group sort for sorting/grouping cards by their keywords (e.g. Flying, Trample, Deathtouch)
- New `year:`, `firstyear:`, and `fy:` filter for filtering cards by first print year (e.g. `year>2000`, `fy<=1995`)
- New `kw:`, `keyword:`, and `keywords:` filter for filtering cards by keyword (e.g. `kw:flying`, `keywords>3`)
- New `is:standard` filter for cards that were first printed in a standard expansion set
- New `is:supplemental` filter for cards that were first printed in supplemental products
- New `otag:` (oracle tag) and `atag:` (art tag) filters powered by Scryfall tagging data — filter cards by community-maintained oracle tags (e.g. `otag:removal`, `otag:ramp`) and art/illustration tags (e.g. `atag:forest`, `atag:sword`)
- New `Oracle Tags` and `Art Tags` group sorts for sorting/grouping cards by their Scryfall tags
- Improved bot deckbuilding algorithm — cards are now added one at a time using ML scores with a cumulative 10% duplicate penalty per copy, preventing bots from stacking too many copies of the same card
- New `game:arena` / `game:paper` / `game:mtgo` filter now checks across all printings of a card (any version ever available in that game), instead of only the current printing's availability
- New `game:is-arena` / `game:is-paper` / `game:is-mtgo` filter for checking whether the specific printing is available in that game (the previous strict behavior)
- Adding a user as a collaborator now creates a notification to that user
- Add `date_last_updated` to cube exports.
- New "Use Base Card Data" display option — when enabled, sorts and filters use a card's original printed attributes (CMC, colors, color category, type, rarity, name) instead of any user-set overrides, so you can see how your cube looks by the cards' base data
- New "Disable Follow Notifications" setting — suppress notifications when users follow your cube (cube-level, in Options settings) or follow you (user-level, in Display Preferences)
- Bot decks now get meaningful archetype names (e.g. "UW Control", "RG Aggro") derived from ML cluster centers, instead of generic labels
- Deck naming is back — you can set your own deck name in the deckbuilder, and if you leave it blank an archetype name is generated automatically using the same cluster-based mechanism

# Bug Fixes

- Fixed quarterly data exports including private and unlisted cubes — the cube export and deck export jobs now only export data from public cubes
- Fixed blog posts from private and unlisted cubes leaking into follower feeds — blog posts, cube commits, package additions, and bulk imports for non-public cubes no longer publish feed items to followers
- Fixed blog posts from unlisted cubes being visible on user blog pages and in dashboard feeds — display-side filtering now excludes both private and unlisted cube blogs (previously only private was filtered)
- Fixed blog post pagination endpoint (`getmoreblogsbycube`) missing a cube visibility check — it now verifies the cube exists and is viewable before returning posts
- Fixed cube JSON API (`/cube/api/cubeJSON/:id`) using stale `cube.defaultSorts` (which moved to views) — the API now returns all boards and applies the standard default sort (Color Category → Types-Multicolor → Mana Value → Alphabetical) instead of relying on sorts that are no longer set on the cube object
- Fixed moving cards between boards (e.g. maybeboard → mainboard) incorrectly keeping the card on the same board — the target board selector was not resetting when switching between cards on different boards
- Fixed "Cannot set properties of undefined (setting 'markedForDelete')" crash caused by stale pending changes in localStorage referencing card indices that no longer exist — now detected as a version mismatch and handled by the existing stale changes recovery flow
- Fixed sample pack and P1P1 generation failing when a cube uses a custom draft format that references non-mainboard boards (e.g. maybeboard) — pack generation now passes all boards to the draft engine instead of only mainboard
- Fixed default sorts saved in views not being applied on page load — view-level `defaultSorts` are now used instead of only cube-level sorts
- Fixed bookmarked URLs with query parameters (display view, sort order, filters) not being applied on page load — an effect that applies view defaults when switching views was also firing on initial mount, overwriting URL-sourced values before they could be read
- Fixed Scunthorpe problem in profanity filter — words like "senft" no longer falsely trigger on substring matches (e.g. "nft"). Spam/marketing terms now use word-boundary matching while slurs use substring matching to prevent evasion.
- Fixed list view selections persisting incorrectly after removing cards — when cards were removed via "Edit Selected" → "Remove all" → "Save Changes," the checked state used stale card indices, causing a different card to appear selected after the commit
- Improved draft creation error messages — instead of the generic "no cards in board" message, errors now distinguish between a board having no cards at all, running out of cards mid-draft (with the original count and a suggestion to add more cards or reduce players/packs), and having remaining cards that don't match a slot filter (with the filter text and card counts)
- Improved date display — dates within the last 7 days now show relative time (e.g. "3 hours ago"), while older dates show an absolute format (e.g. "Feb 7, 2026")
- Fixed Cube card count not updating in the hero as mainboard changes were saved
- Fixed problem selecting cards with accented charcters (eg Lórien) when adding to a draft record for cards in the cube
- Fixed deckbuild land count and non-land count settings not being saved
- Added a loading indicator when a draft finishes while bot decks are being built
- Moved bot deckbuilding to the client side with a progress bar — instead of one long server request that could time out, the client now makes ~31 small incremental ML calls (1 batch build + ~30 draft steps), showing a live percentage and step counter during the process
- Fixed draft finish returning HTTP 400 when unknown cards produced empty oracle IDs in iterative bot deckbuilding — empty/invalid oracle IDs are now filtered before building and submitting bot decks
- Improved draft naming durability for unknown or malformed cards — cluster/archetype naming now skips missing card references instead of throwing during finish/update flows
- Fixed invalid-card image fallback pointing to an unreachable external URL — placeholder cards now use the local default card image path
- Fixed pick-by-pick breakdown collapsing duplicate cards in packs when "collapse duplicates" is enabled for the cube
- Fixed board display order in cube list views not respecting the order configured in view settings
- Respect Right Sidebar inline position when adjusting Cube Table and Stacks layouts.
- Fixed "Disable Clone Notifications" cube setting not persisting — the setting would revert after saving
- Fixed edit/remove card only searching the filtered card list — when a filter was active, removing or replacing a card by name would fail if the card wasn't in the filtered results; the lookup now searches the full unfiltered card list
- Fixed card edits (property changes) inflating +/- counts in the edit pane — edits no longer count as both an addition and a removal. Instead, edited cards are shown as a separate count with a wrench icon (e.g. "+5, -3, 🔧2"), both in the pending changes panel and in committed changelogs
- Fixed committing large changelogs (e.g. bulk uploads with many cards) causing request timeouts
- Improved performance of saving changes for large updates — card data is now fetched in a single batch request instead of one-at-a-time

# Technical Changes

- Added a new `archetypeAnnotater` package — a standalone tool for manually labeling draft/deck datasets and building the cluster-center annotations that power automatic archetype naming
