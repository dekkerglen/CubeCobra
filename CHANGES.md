Since 1.6.0

# New Features
- Changelog entries are now clickable — each links to a dedicated detail page showing the full changelog
- Point-in-time cube list view on changelog detail pages — uses the same modern view controls (table, visual spoiler, curve, stacks), filter, sort, and display sidebar as the main cube list page, with boards kept distinct (mainboard, maybeboard)
- Full-width banner on the PIT list page clearly indicating you are viewing a historical snapshot, with a link back to the changelog entry
- "Download Point in Time Cube" on changelog detail pages — reconstructs the historical cube and downloads it as CSV
- "Compare Point in Time Cube with Present" on changelog detail pages — side-by-side comparison of historical vs current cube
- Export button on all compare pages (both regular cube compare and PIT compare) — downloads a structured text file with three sections: In Both, Only in Base, Only in Comparison

# Bug Fixes
- Fixed default sorts saved in views not being applied on page load — view-level `defaultSorts` are now used instead of only cube-level sorts
- PIT list page no longer shows the Edit button (read-only view)

# Technical Changes
