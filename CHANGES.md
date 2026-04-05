Since 1.6.0

# New Features
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
- Improved bot deckbuilding algorithm — cards are now added one at a time using ML scores with a cumulative 10% duplicate penalty per copy, preventing bots from stacking too many copies of the same card
- New `game:arena` / `game:paper` / `game:mtgo` filter now checks across all printings of a card (any version ever available in that game), instead of only the current printing's availability
- New `game:is-arena` / `game:is-paper` / `game:is-mtgo` filter for checking whether the specific printing is available in that game (the previous strict behavior)
- Adding a user as a collaborator now creates a notification to that user

# Bug Fixes
- Fixed default sorts saved in views not being applied on page load — view-level `defaultSorts` are now used instead of only cube-level sorts
- Fixed bookmarked URLs with query parameters (display view, sort order, filters) not being applied on page load — an effect that applies view defaults when switching views was also firing on initial mount, overwriting URL-sourced values before they could be read
- Fixed Scunthorpe problem in profanity filter — words like "senft" no longer falsely trigger on substring matches (e.g. "nft"). Spam/marketing terms now use word-boundary matching while slurs use substring matching to prevent evasion.
- Fixed list view selections persisting incorrectly after removing cards — when cards were removed via "Edit Selected" → "Remove all" → "Save Changes," the checked state used stale card indices, causing a different card to appear selected after the commit

# Technical Changes
