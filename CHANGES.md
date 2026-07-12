The changes here are concise, one liners to be put in a future user facing blogpost. Focus on the effect of the new feature, no technical details.

## New Features

- Modal double-faced cards (like spell // land cards) can now be added to your cube pre-flipped by their back face name, so you can feature the back as the primary side while still being able to see both faces.
- Search and sort by Scryfall's community tags: use `otag:` to find cards by what they do (like `otag:removal` or `otag:ramp`) and `atag:` to find cards by what's in their artwork (like `atag:dragon`), and group your cube by Oracle Tags or Art Tags.
- Search, sort, and group by EDHREC data: use `rank:` to filter by a card's play-rate rank (like `rank<=100` for the most-played cards) and `salt:` to filter by how salty a card is (like `salt>1.5`), and sort or group your cube by EDHREC Rank or Salt.
- When editing a card, the version picker now previews each printing's image as you hover over it, and lets you filter a long list of printings by name — so you can find the exact art or set you want without looking up set codes elsewhere.
- Added a Keywords analysis tab that lists every keyword in your cube with reminder text for what it does, a keyword word cloud, a color-weight breakdown, and a density-by-color heatmap so you can see which mechanics live in which colors.
- Custom draft formats can now be exported to a JSON file and imported into any cube, so you can share a format with others or reuse it across your own cubes.
- Custom draft formats can now randomize the card order within a pack, so cards no longer reveal which slot they came from and packs aren't always in the same order.
- Added an on-site Wiki with guides and how-tos for using Cube Cobra, browsable from the navigation bar and organized by topic. The Filter Syntax and Markdown references now live here too.
- Added a quick-access cube tray in the bottom-left corner where you can pin your cubes' boards and add cards to them in one motion.
- You can now drag a card from card search, smart search, or any cube's card list (both image and table views) and drop it onto a pinned board to add it instantly.
- Smart Search now works on empty cubes, falling back to a card search sorted by Elo so you can start building right away.
- Cube owners can now edit a cube's overview — name, category and tags, image, description, and custom URL — straight from the cube header, without leaving the page.
- When pinning a board to the cube tray, you can set default tags, a status, and a note that get applied to every card you drop onto it.
- Card name autocomplete now matches anywhere in a card's name and ignores punctuation and spacing, so partial searches like "moonsage" find "Tamiyo, the Moon Sage".
- Refactored winrate analytics for records with a much more comprehensive dashboard
- Rebuilt the Analysis playtest data tab into a rich, on-demand report: click Run to pull your cube's human drafts and see pick rates, first-pick and wheel behavior, deck shapes, and archetype clusters — all built fresh in your browser and saved locally.
- Snap or upload a photo of a physical deck and Cube Cobra reads every card name straight from the image, right in your browser, and matches each one to your cube — no more typing out a decklist by hand.
- The photo scanner flags any card it isn't sure about for a quick review, offers one-click suggestions for the most likely match, and even catches cards that have since been cut from your cube, so the final decklist is accurate before you add it.
- Share a link to a record so the players in your event can submit their own decks and results, without needing edit access to your cube.
- Import a whole event straight from a Hedron Network export — players, rounds, results, and deck photos all come in together.
- Cube owners can now manually set a player's win/loss/draw record on an event when the logged matches don't capture it.
- Add Artist to the CSV export of Cube cards and Tokens
- Export a drafted deck as a Comma-Separated (.csv) file in the same format as a cube export, including card image links — so custom cards and alters keep their artwork when you reload the decklist elsewhere.
- Download your card search results as a CSV, with name, cost, type, color, set, rarity, Elo, total picks, and cube count for every matching card.
- Add tooltips to better describe what "Specify Versions" and "Include Extras" do in Cube Edit card search
- Browse a new Sets page that lists every Magic set with its set symbol — sort by release date, name, or card count, and click through to see all of a set's cards.
- Lotus Cobra patrons (and admins) can now upload and host their own images on Cube Cobra and use them as custom card art, profile pictures, and cube images, all managed from a new image library in your account settings.
- Card name search fields now include "Specify Versions" and "Include Extras" toggles, so you control which printings show up when adding cards on the bulk upload and package pages.
- The draft breakdown export now includes an Archetype column, so you can see each drafter's archetype right alongside their picks.
- Choose "Cheapest" as your default printing so cards get added in their least expensive version.
- New "Default" printing option picks the most normal version of each card — standard frame with up-to-date rules text — and you can find those printings in search with `is:default`.
- Card search now hides "extras" — tokens, art cards, emblems, planes, memorabilia, digital-only, and Unknown Event cards — by default, so results are cleaner. Check "Include extras" or add `include:extras` to your search to bring them back.
- Finishing a draft is now instant — you go straight to building your own deck instead of waiting on the bots, and their decks fill in behind the scenes with a banner that lets you know when they're ready to view.
- Cube owners can now set a default number of seats for their cube, so drafts and simulations start with the right player count instead of always defaulting to 8.
- Card search and cube filtering now show a plain-English summary of your filter, so you can tell at a glance whether a query like `c:w mv>=3 -t:land` is doing what you intended.
- Added `is:adventure`, `is:omen`, and `is:prepared` search filters to find Adventure, Omen, and Prepared cards.
- Bulk paste now understands the edition, so exports from tools like Delver Lens and ManaPools that tag each card with its set (e.g. `1 Agent of the Fates [ths]` or `4 Plains (M20) 261`) add the exact printing you specified.
- Added a new Prices analysis tab that breaks down your cube's total value by card status and finish — see what you've already spent, what it would cost to finish the cube, and what foiling the rest would run, with pie charts for card status and value.
- The Compare Cubes dialog now lets you pick one of your own cubes or a cube you follow from a list, instead of only pasting in a cube ID.
- Added a Rotisserie Draft card to the playtest page that links to Lucky Paper's guide and points you to the list page's Display menu to connect your draft spreadsheet back to Cube Cobra.
- Play Housman Draft against bots right on Cube Cobra: a hidden-information format for 2 to 5 players where you swap cards between your hand and a shared face-up pool each round, then keep your hand to build a focused deck. When it's done, replay the whole draft exchange by exchange with a pick-by-pick breakdown.
- Advanced Search's Set, Rarity, and Artist filters are now dropdowns populated from the cards in your cube, so you can pick from what's actually there instead of typing.
- The cube list's List View has a new Columns button that lets you pick exactly which fields to show — including Color Category, Rarity, and Notes — and set the page size, with your choices remembered for next time.
- The deckbuilder now has quick-sort buttons that instantly reorganize your deck's columns by color, mana value, rarity, or card type, plus a button that splits creatures and non-creatures into two rows.
- Tag colors are no longer limited to a fixed palette — pick any color for a tag with a color picker, preview it live, and Cube Cobra automatically chooses readable light or dark text so your tags stay legible.
- Notifications of the same kind now collapse into one line — several drafts of the same cube, replies to the same post, or new followers show up as a single "There are 3 new drafts of My Cube" entry instead of cluttering your list.
- While drafting, you can now turn your very first pack into a shareable Pack 1 Pick 1 with one click — no screenshot needed — and send it to friends to vote on your pick.
- Card and group edit dialogs now have a "Restore to Default" button that resets a card's overridden type, mana value, rarity, color, color category, and images back to the printing's real values, leaving your status, tags, and notes untouched.
- While drafting, you can now choose how many cards show per row in the pack, so you can make them larger and easier to read — handy on mobile where you can drop down to two or three per row.
- The Edit Selected dialog now shows cents on combined prices under $10, so ultra-budget totals like $1.50 and $2.49 no longer both round to "$2".
- A cube edit and its change history entry are now saved together, so a save that gets interrupted can no longer leave your cube updated with a missing entry in its change history.


## Bug Fixes

- Shared cube links now show a clean plain-text description in social media previews instead of raw markdown symbols.
- The Compare view now groups cards using your full sort settings instead of always grouping by mana value.
- Browser back and forward buttons now restore the filters and sorts stored in the page URL.
- Fixed bulk upload failing on single-column CSV exports and on card names containing commas, like "Adeline, Resplendent Cathar".
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
- Foil versions of white-bordered cards now show a black border, matching how they actually print.