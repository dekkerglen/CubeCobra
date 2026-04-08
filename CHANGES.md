Since 1.6.0

# New Features
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
- Configurable deckbuild limits — cube owners can set the target number of spells (default 23) and lands (default 17) for bot-built decks in the Draft Formats settings page, supporting non-standard deck sizes

# Bug Fixes
- Fixed default sorts saved in views not being applied on page load — view-level `defaultSorts` are now used instead of only cube-level sorts

# Technical Changes
