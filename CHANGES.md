As of 1.4.57

# New Features

- Added a mechanism to auto +1 packages when added to a cube
- Increased password limit to 1024 (there is no technical limitation here, some folks just wanted to be able to use longer passwords than we anticipated when we set an arbritrary limit.)
- Add panning to card elo and play rate graphs
- Created scheduled jobs for card updates, scryfall migrations (removing/merging cards), and exports
- Added a new page (find it under Cards->Card Updates) to display scheduled job statuses
- Made data exports public, added instructions under the Card Updates page on how to access them

# Bug Fixes

- Fixed an issue where paginating cube search results would sometimes not go to the next page
- Fixed a bug where updating user fields would delete password
- Fixed a bug where seat owner names were not showing up
- Fixed a bug with RSS feeds erroring
- Removed video ads from banner, as those occasionally went outside the bounding box and affected site UX.
- Fixed the "All-time" graph on elo and play rate pages

# Technical Changes

- Added codepipeline with integration tests
- Added integration tests to pull requests, split up checks to make it easier to see failures
- Fixed docker development setup
- Rebuilt card import pipeline to reduce max data staleness from 48 hours to less than 12
- Created public assets bucket for first time developer setup for a faster and better setup experience
