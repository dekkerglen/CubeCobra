Since 1.5.0

In our last update, we did a pretty major UX overhaul. While it was widely well received, there was also a lot of constructive critical feedback, so you may have seen some tweaks trickle out over the weeks following that release. A few weeks ago I did start on some larger changes and needed to test in our beta server, and I paused prod deployments - of which I am now opening the floodgates! So, there are a lot of changes here that are related to the feedback, and some of them are quite large. I really hope this update addresses any remaining concerns you had with the UX changes, and if not, please let me know! I have been trying to be really receptive and generally have had quick turnarounds.

First things first, the settings "gear icon" menu is gone. I found users didn't really like have so many different types of menus in different places - and this was the kind of thing we were trying to reduce with our UX overhaul. Settings are now a new section in the cube navbar, here you can edit the overview (what's shown in the banner and preview), options (various settings), draft formats, and restore. Additionally, there are three new sections here, each with a major new feature: Collaboraters, Boards and Views, and Custom Sorts.

Multi user collaboration support is here! Now the owner of a cube can provision edit permissions as they wish. Control the collaborator access in the aforementioned section.

Boards and Views is a major shift in how we can present our cubes. Currently we support Maybeboard and Mainboard (and this will remain the default), but now we have also moved the basic lands to a new "Basics" board. This means you can now customize your basics with the full control you have to customize the rest of your cube. You can also upload all your custom alters, signatures, to show off, and inventory in this tab. Boards are no longer confined to presets - in the Boards and Views tab, you can create and delete boards as you please. Views is a new concept, and this is where a lot of the default display prefences now lives. You can configure a View of your cube with default sorts, a filter, display, and boards. The room for customization is very large here, and I'm very excited to see how users utilize this!

Custom Sorts is another feature I've dreamed of having for a long time, but finally found the time implement it. Do you feel limited by the current sorting options? You can now define your own sort, by specifying labels and a filter expression for what cards get sorted into each category. These can be used anywhere within the context of the cube - which complements the new Views concept nicely.

Alongside the boards changes - we have a lot of updates for custom draft formats. Each slot can now specify which board it is pulling cards from, defaulting to mainboard. You can also specify which board to pull basics from, defaulting to Basics of course. 

# New Features

- Add comprehensive board customization and management
- Imports can now specify which board to import cards into
- Add custom sorts
- Add tokens csv export
- Add tokens Manapool purchase button
- New Cube view: card stacks
- Added support for multiple collaborators working on the same cube list
- Removed Gear Icon menu from cube hero in favor of a Settings section
- Moved draft format management to settings page and expanded customization
- Tweaked Cube hero minified view - same size but now always shows action links
- In Cube table view, Added the card item hover effect to each item in the group when hovering over the card group header
- Added a shareable link to generate a random sample pack each time
- allow urls in cube compare input
- Refactored dashboard and landing pages mobile UX
- Added "View More" links to explore page
- Added user level display option to show text over icons where possible
- Edit Primer now moved out of a modal, into an in-place editing of primer and cube tags
- New Cube export type: "Print and Play"

# Bug Fixes

- Fixed a bug where deck dropdowns weren't working
- Fixed a bug where cube exports didn't use sort/filter correctly
- Fix transforming card full name (both faces) not able to bulk import
- Fixed a bug where the cube search index sort would fall out of sync with reality
- Fixed a bug where the card tags on hover were being displayed on mobile

# Technical Changes

- Service now runs in a VPC
