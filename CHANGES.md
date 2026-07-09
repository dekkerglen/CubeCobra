The changes here are concise, one liners to be put in a future user facing blogpost. Focus on the effect of the new feature, no technical details.

## New Features

- Added a quick-access cube tray in the bottom-left corner where you can pin your cubes' boards and add cards to them in one motion.
- You can now drag a card from card search, smart search, or any cube's card list (both image and table views) and drop it onto a pinned board to add it instantly.
- Smart Search now works on empty cubes, falling back to a card search sorted by Elo so you can start building right away.
- Cube owners can now edit a cube's overview — name, category and tags, image, description, and custom URL — straight from the cube header, without leaving the page.
- When pinning a board to the cube tray, you can set default tags, a status, and a note that get applied to every card you drop onto it.
- Card name autocomplete now matches anywhere in a card's name and ignores punctuation and spacing, so partial searches like "moonsage" find "Tamiyo, the Moon Sage".
- Refactored winrate analytics for records with a much more comprehensive dashboard
- Snap or upload a photo of a physical deck and Cube Cobra reads every card name straight from the image, right in your browser, and matches each one to your cube — no more typing out a decklist by hand.
- The photo scanner flags any card it isn't sure about for a quick review, offers one-click suggestions for the most likely match, and even catches cards that have since been cut from your cube, so the final decklist is accurate before you add it.
- Share a link to a record so the players in your event can submit their own decks and results, without needing edit access to your cube.
- Import a whole event straight from a Hedron Network export — players, rounds, results, and deck photos all come in together.
- Cube owners can now manually set a player's win/loss/draw record on an event when the logged matches don't capture it.
- Add Artist to the CSV export of Cube cards and Tokens
- Add tooltips to better describe what "Specify Versions" and "Include Extras" do in Cube Edit card search
- Browse a new Sets page that lists every Magic set with its set symbol — sort by release date, name, or card count, and click through to see all of a set's cards.
- Lotus Cobra patrons (and admins) can now upload and host their own images on Cube Cobra and use them as custom card art, profile pictures, and cube images, all managed from a new image library in your account settings.
- Card name search fields now include "Specify Versions" and "Include Extras" toggles, so you control which printings show up when adding cards on the bulk upload and package pages.
- The draft breakdown export now includes an Archetype column, so you can see each drafter's archetype right alongside their picks.
- Choose "Cheapest" as your default printing so cards get added in their least expensive version.
- New "Default" printing option picks the most normal version of each card — standard frame with up-to-date rules text — and you can find those printings in search with `is:default`.
- Card search now hides "extras" — tokens, art cards, emblems, planes, memorabilia, digital-only, and Unknown Event cards — by default, so results are cleaner. Check "Include extras" or add `include:extras` to your search to bring them back.
- Finishing a draft is now instant — you go straight to building your own deck instead of waiting on the bots, and their decks fill in behind the scenes with a banner that lets you know when they're ready to view.

## Bug Fixes

- Fix Cube comparison export not bucketing cards by in both, only A, or only B when there is a filter set
- Fixed sample pack, Pack 1 Pick 1, and daily homepage pack images sometimes failing to load.
- Fixed Draft Reports and Import Records only showing the first page of results.
- Fixed the wrong player name appearing on draft reports.
- Fixed manually-set win/loss/draw records on events not saving or loading correctly.
- Fixed replacing your cube in the Featured Cubes queue creating duplicate entries.
- Fixed autocard getting stuck open in tablet view during a draft.
- Fixed Pack height jumping between picks which was a janky UI.
- Fixed Patreon membership changes not always syncing to your Cube Cobra supporter perks.
- Fixed a bug where registration errors weren't surfaced to end users.
